"""
Views de autenticação multi-tenant
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django_tenants.utils import schema_context
from django.db import connection
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from .models import UserProfile, TenantMembership
from .decorators import rate_limit_login, rate_limit_password_reset
from tenants.models import Empresa, Filial

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
@rate_limit_login
def login(request):
    """
    Login multi-tenant com identificação de tenant pela URL/subdomínio
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    
    if not username or not password:
        return Response(
            {'error': 'Username e senha são obrigatórios'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Identificar tenant pela URL/subdomínio ou pelo header/body
    tenant = getattr(connection, 'tenant', None)
    
    # Se não identificou pelo Host, tentar pelo header ou body (para desenvolvimento)
    if not tenant:
        domain = request.headers.get('X-Tenant-Domain') or request.data.get('domain')
        if domain:
            from tenants.models import Domain as TenantDomain
            try:
                # Buscar o tenant pelo domínio (no schema público)
                tenant_domain = TenantDomain.objects.select_related('tenant').get(domain=domain)
                tenant = tenant_domain.tenant
                # Configurar o tenant na connection para uso posterior
                # O django-tenants usa connection.set_tenant() para definir o schema
                connection.set_tenant(tenant)
            except TenantDomain.DoesNotExist:
                return Response(
                    {'error': f'Domínio "{domain}" não encontrado. Verifique o domínio e tente novamente.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado. Acesse através do domínio do seu tenant ou forneça o domínio.'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar se tenant está ativo
    if not tenant.is_active:
        return Response(
            {'error': 'Tenant inativo. Entre em contato com o suporte.'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Verificar membership primeiro (no schema público)
    # O usuário deve existir no schema público para ter membership
    try:
        membership = TenantMembership.objects.filter(
            user__username=username,
            tenant=tenant, 
            is_active=True
        ).first()
        
        if not membership:
            return Response(
                {'error': 'Usuário não tem acesso a este tenant'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Usar o user do membership (schema público)
        user_public = membership.user
        
        # Verificar senha autenticando no schema do tenant
        with schema_context(tenant.schema_name):
            user_tenant = authenticate(username=username, password=password)
            if not user_tenant:
                return Response(
                    {'error': 'Credenciais inválidas'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # Usar o user do schema público para o resto da lógica
        user = user_public
        
    except Exception as e:
        return Response(
            {'error': f'Erro ao autenticar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Atualizar perfil do usuário com tenant atual
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.current_tenant = tenant
    profile.save()
    
    # Obter empresas e filiais do usuário neste tenant
    empresas = []
    with schema_context(tenant.schema_name):
        empresas = list(Empresa.objects.filter(tenant=tenant, is_active=True))
    
    # Gerar tokens JWT
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    
    # Adicionar informações do tenant no token
    access['tenant_id'] = tenant.id
    access['tenant_name'] = tenant.name
    access['tenant_schema'] = tenant.schema_name
    access['role'] = membership.role
    
    response_data = {
        'access': str(access),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': membership.role,
        },
        'tenant': {
            'id': tenant.id,
            'name': tenant.name,
            'schema_name': tenant.schema_name,
        },
    }
    
    # Se múltiplas empresas, retornar lista para seleção
    if len(empresas) > 1:
        empresas_data = []
        with schema_context(tenant.schema_name):
            for emp in empresas:
                filiais = list(Filial.objects.filter(empresa=emp, is_active=True))
                empresas_data.append({
                    'id': emp.id,
                    'nome': emp.nome,
                    'razao_social': emp.razao_social,
                    'cnpj': emp.cnpj,
                    'filiais': [
                        {'id': fil.id, 'nome': fil.nome, 'codigo_filial': fil.codigo_filial}
                        for fil in filiais
                    ]
                })
        response_data['empresas'] = empresas_data
        response_data['requires_selection'] = True
    elif len(empresas) == 1:
        # Se apenas uma empresa, definir como atual
        empresa = empresas[0]
        filiais = []
        with schema_context(tenant.schema_name):
            filiais = list(Filial.objects.filter(empresa=empresa, is_active=True))
        
        profile.current_empresa = empresa
        response_data['empresa'] = {
            'id': empresa.id,
            'nome': empresa.nome,
            'razao_social': empresa.razao_social,
        }
        
        if len(filiais) == 1:
            # Se apenas uma filial, definir como atual
            filial = filiais[0]
            profile.current_filial = filial
            response_data['filial'] = {
                'id': filial.id,
                'nome': filial.nome,
            }
            response_data['requires_selection'] = False
        elif len(filiais) > 1:
            # Se múltiplas filiais, retornar lista
            response_data['filiais'] = [
                {'id': fil.id, 'nome': fil.nome, 'codigo_filial': fil.codigo_filial}
                for fil in filiais
            ]
            response_data['requires_selection'] = True
        else:
            response_data['requires_selection'] = False
        
        profile.save()
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def select_empresa_filial(request):
    """
    Seleciona empresa e filial após login
    """
    empresa_id = request.data.get('empresa_id')
    filial_id = request.data.get('filial_id')
    
    if not empresa_id:
        return Response(
            {'error': 'empresa_id é obrigatório'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        profile = request.user.profile
        if not profile.current_tenant:
            return Response(
                {'error': 'Nenhum tenant selecionado'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tenant = profile.current_tenant
        
        # Verificar empresa no schema do tenant
        with schema_context(tenant.schema_name):
            empresa = Empresa.objects.get(id=empresa_id, tenant=tenant, is_active=True)
        
        profile.current_empresa = empresa
        
        if filial_id:
            with schema_context(tenant.schema_name):
                filial = Filial.objects.get(id=filial_id, empresa=empresa, is_active=True)
            profile.current_filial = filial
        else:
            profile.current_filial = None
        
        profile.save()
        
        response_data = {
            'empresa': {
                'id': empresa.id,
                'nome': empresa.nome,
                'razao_social': empresa.razao_social,
            },
        }
        
        if profile.current_filial:
            response_data['filial'] = {
                'id': profile.current_filial.id,
                'nome': profile.current_filial.nome,
            }
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Empresa.DoesNotExist:
        return Response(
            {'error': 'Empresa não encontrada ou inativa'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Filial.DoesNotExist:
        return Response(
            {'error': 'Filial não encontrada ou inativa'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Erro ao selecionar empresa/filial: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Retorna informações do usuário atual e contexto (tenant, empresa, filial)
    """
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    response_data = {
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
    }
    
    if profile.current_tenant:
        membership = TenantMembership.objects.filter(
            user=request.user,
            tenant=profile.current_tenant,
            is_active=True
        ).first()
        
        response_data['tenant'] = {
            'id': profile.current_tenant.id,
            'name': profile.current_tenant.name,
            'schema_name': profile.current_tenant.schema_name,
        }
        
        if membership:
            response_data['user']['role'] = membership.role
        
        if profile.current_empresa:
            response_data['empresa'] = {
                'id': profile.current_empresa.id,
                'nome': profile.current_empresa.nome,
            }
            
            if profile.current_filial:
                response_data['filial'] = {
                    'id': profile.current_filial.id,
                    'nome': profile.current_filial.nome,
                }
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@rate_limit_password_reset
def password_reset_request(request):
    """
    Solicita reset de senha
    Envia email com link para redefinir senha
    """
    email = request.data.get('email', '').strip().lower()
    
    if not email:
        return Response(
            {'error': 'Email é obrigatório'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Identificar tenant pela URL
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Buscar usuário pelo membership no schema público
    # O usuário deve ter membership no tenant para poder resetar senha
    user = None
    try:
        membership = TenantMembership.objects.filter(
            user__email=email,
            tenant=tenant,
            is_active=True
        ).first()
        if membership:
            user = membership.user
    except Exception:
        pass
    
    # Sempre retornar sucesso (não revelar se email existe)
    if user:
        try:
            # Gerar token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # URL de reset (frontend)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_url = f"{frontend_url}/reset-password/{uid}/{token}/"
            
            # Enviar email
            send_mail(
                subject='Redefinição de Senha - SISCR',
                message=f'''
Olá,

Você solicitou a redefinição de senha para sua conta no SISCR.

Clique no link abaixo para redefinir sua senha:
{reset_url}

Este link é válido por 24 horas.

Se você não solicitou esta redefinição, ignore este email.

Atenciosamente,
Equipe SISCR
                ''',
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@siscr.com.br'),
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            # Log do erro mas não revelar ao usuário
            pass
    
    # Sempre retornar sucesso (segurança)
    return Response({
        'message': 'Se o email existir, você receberá instruções para redefinir sua senha.'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@rate_limit_password_reset
def password_reset_confirm(request):
    """
    Confirma reset de senha com token
    """
    uid = request.data.get('uid', '').strip()
    token = request.data.get('token', '').strip()
    new_password = request.data.get('new_password', '')
    
    if not all([uid, token, new_password]):
        return Response(
            {'error': 'uid, token e new_password são obrigatórios'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validar força da senha
    if len(new_password) < 8:
        return Response(
            {'error': 'Senha deve ter no mínimo 8 caracteres'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Decodificar uid
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
        
        # Verificar token
        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'Token inválido ou expirado'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Identificar tenant (se possível)
        tenant = get_tenant_from_request(request)
        
        # Atualizar senha no schema público
        user.set_password(new_password)
        user.save()
        
        # Atualizar senha no schema do tenant (se houver)
        if tenant:
            with schema_context(tenant.schema_name):
                try:
                    user_tenant = User.objects.get(username=user.username)
                    user_tenant.set_password(new_password)
                    user_tenant.save()
                except User.DoesNotExist:
                    # Usuário pode não existir no tenant ainda
                    pass
        
        return Response({
            'message': 'Senha redefinida com sucesso'
        }, status=status.HTTP_200_OK)
        
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {'error': 'Link inválido'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Erro ao redefinir senha: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

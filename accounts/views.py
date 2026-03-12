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
from tenants.models import Empresa, Filial, Tenant

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
@rate_limit_login
def login(request):
    """
    Login multi-tenant com identificação de tenant pela URL/subdomínio
    """
    import logging
    logger = logging.getLogger(__name__)
    
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    
    logger.info(f'[LOGIN] ========== INÍCIO DO LOGIN ========== username="{username}"')
    
    if not username or not password:
        return Response(
            {'error': 'Username e senha são obrigatórios'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Identificar tenant pela URL/subdomínio ou pelo header/body
    tenant = getattr(connection, 'tenant', None)
    
    # Verificar se é um FakeTenant (objeto mock do django-tenants quando não há tenant)
    from tenants.models import Tenant
    if tenant and not isinstance(tenant, Tenant):
        # Se for FakeTenant, considerar como None
        tenant = None
    
    # Se não identificou pelo Host, tentar pelo header ou body (para desenvolvimento)
    if not tenant:
        domain = request.headers.get('X-Tenant-Domain') or request.data.get('domain')
        if domain:
            from tenants.models import Domain as TenantDomain
            try:
                # Buscar o tenant pelo domínio (no schema público)
                with schema_context('public'):
                    tenant_domain = TenantDomain.objects.select_related('tenant').get(domain=domain)
                    tenant = tenant_domain.tenant
                # Configurar o tenant na connection para uso posterior
                # O django-tenants usa connection.set_tenant() para definir o schema
                connection.set_tenant(tenant)
                logger.info(f'[LOGIN] Tenant identificado pelo domínio fornecido: "{tenant.name}" ({domain})')
            except TenantDomain.DoesNotExist:
                # Domínio não encontrado - tentar buscar pelo username (pode ser domínio antigo em cache)
                logger.warning(f'[LOGIN] Domínio "{domain}" não encontrado. Tentando buscar tenant pelo username...')
                tenant = None  # Continuar para buscar pelo username abaixo
    
    # IMPORTANTE: Se o tenant foi identificado pelo domínio fornecido,
    # verificar se o usuário realmente tem acesso a esse tenant
    # Se não tiver, buscar o tenant correto do usuário
    if tenant:
        with schema_context('public'):
            # Verificar se o usuário tem membership neste tenant
            try:
                user_check = User.objects.get(username=username)
                membership_check = TenantMembership.objects.filter(
                    user=user_check,
                    tenant=tenant,
                    is_active=True
                ).first()
                
                if not membership_check:
                    # Usuário não tem acesso ao tenant fornecido
                    # Buscar o tenant correto do usuário
                    logger.info(f'[LOGIN] Usuário "{username}" não tem acesso ao tenant "{tenant.name}" fornecido. Buscando tenant correto...')
                    tenant = None  # Resetar para buscar o tenant correto
            except User.DoesNotExist:
                # Usuário não existe ainda, deixar passar para verificar depois
                pass
    
    # Se ainda não identificou o tenant ou o tenant fornecido não é válido para o usuário,
    # tentar buscar pelo username (último recurso)
    if not tenant:
        with schema_context('public'):
            # Buscar tenant pelo membership do usuário
            try:
                user_public = User.objects.get(username=username)
                memberships = TenantMembership.objects.filter(
                    user=user_public,
                    is_active=True
                ).select_related('tenant')
                
                if memberships.count() == 1:
                    # Se o usuário tem apenas um tenant, usar esse
                    membership = memberships.first()
                    tenant = membership.tenant
                    logger.info(f'[LOGIN] Tenant identificado pelo membership: "{tenant.name}" (único tenant do usuário)')
                    # Configurar o tenant na connection
                    connection.set_tenant(tenant)
                elif memberships.count() > 1:
                    # Se o usuário tem múltiplos tenants, retornar erro pedindo para especificar
                    tenant_names = [m.tenant.name for m in memberships]
                    logger.warning(f'[LOGIN] Usuário "{username}" tem múltiplos tenants: {tenant_names}')
                    return Response(
                        {
                            'error': 'Múltiplos tenants encontrados',
                            'message': f'O usuário "{username}" possui acesso a múltiplos tenants. Por favor, especifique o domínio do tenant desejado.',
                            'tenants': tenant_names,
                        }, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    return Response(
                        {'error': 'Tenant não identificado. Acesse através do domínio do seu tenant, forneça o domínio, ou verifique se o usuário existe em algum tenant.'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except User.DoesNotExist:
                # Usuário não existe, deixar passar para verificar credenciais depois
                pass
    
    # Verificar se tenant está ativo ANTES de tentar autenticar
    # IMPORTANTE: Recarregar o tenant do banco para garantir que temos o status atualizado
    tenant_is_active = True
    if isinstance(tenant, Tenant):
        with schema_context('public'):
            tenant.refresh_from_db()
            tenant_is_active = tenant.is_active
            # NÃO bloquear login se tenant estiver inativo
            # Permitir login mas marcar que o tenant está inativo para redirecionamento
    
    # Verificar membership primeiro (no schema público)
    # O usuário deve existir no schema público para ter membership
    logger.info(f'[LOGIN] 📍 ANTES DO TRY - Verificando membership para username="{username}", tenant="{tenant.name if tenant else None}"')
    try:
        # IMPORTANTE: TenantMembership está no schema público, não no schema do tenant
        # Precisamos garantir que estamos buscando no schema público
        logger.info(f'[LOGIN] 📍 DENTRO DO TRY - Acessando schema público')
        with schema_context('public'):
            # Log para debug
            logger.info(f'[LOGIN] Buscando membership para username="{username}", tenant_id={tenant.id}, tenant_name="{tenant.name}"')
            
            # Primeiro, verificar se o usuário existe
            try:
                user_public = User.objects.get(username=username)
                logger.info(f'[LOGIN] Usuário encontrado no schema público: {user_public.id}')
            except User.DoesNotExist:
                logger.warning(f'[LOGIN] Usuário "{username}" não encontrado no schema público')
                return Response(
                    {
                        'error': 'Credenciais inválidas',
                        'message': 'Usuário ou senha incorretos.',
                    }, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Buscar membership
            membership = TenantMembership.objects.filter(
                user=user_public,
                tenant=tenant, 
                is_active=True
            ).first()
            
            # Se não encontrou membership ativo, verificar se existe mas está inativo
            if not membership:
                membership_inactive = TenantMembership.objects.filter(
                    user=user_public,
                    tenant=tenant,
                    is_active=False
                ).first()
                
                if membership_inactive:
                    logger.warning(f'[LOGIN] Membership encontrado mas está inativo para username="{username}", tenant="{tenant.name}"')
                    return Response(
                        {
                            'error': 'Acesso negado',
                            'message': f'Seu acesso ao tenant "{tenant.name}" foi desativado. Entre em contato com o suporte.',
                        }, 
                        status=status.HTTP_403_FORBIDDEN
                    )
                else:
                    logger.warning(f'[LOGIN] Nenhum membership encontrado para username="{username}", tenant="{tenant.name}"')
                    # Listar todos os tenants do usuário para debug
                    all_memberships = TenantMembership.objects.filter(user=user_public).select_related('tenant')
                    tenant_names = [m.tenant.name for m in all_memberships]
                    logger.info(f'[LOGIN] Tenants do usuário "{username}": {tenant_names}')
                    
                    return Response(
                        {
                            'error': 'Usuário não tem acesso a este tenant',
                            'message': f'O usuário "{username}" não possui acesso ao tenant "{tenant.name}". Verifique suas credenciais ou entre em contato com o suporte.',
                        }, 
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            logger.info(f'[LOGIN] Membership encontrado e ativo para username="{username}", tenant="{tenant.name}"')
            
            # Usar o user do membership (schema público)
            user_public = membership.user
        
        # Verificar senha autenticando no schema do tenant
        # IMPORTANTE: Se o tenant estiver desativado, pode não conseguir acessar o schema
        # Por isso verificamos antes e tratamos o erro
        logger.info(f'[LOGIN] 🔄 Iniciando autenticação no schema do tenant: username="{username}", tenant="{tenant.schema_name}"')
        user_tenant = None
        try:
            logger.info(f'[LOGIN] 🔄 Tentando acessar schema do tenant "{tenant.schema_name}"')
            with schema_context(tenant.schema_name):
                logger.info(f'[LOGIN] ✅ Schema do tenant "{tenant.schema_name}" acessado com sucesso')
                # Verificar se o usuário existe no schema do tenant antes de autenticar
                user_exists_in_tenant = User.objects.filter(username=username).exists()
                logger.info(f'[LOGIN] 🔍 Verificando usuário no schema do tenant: username="{username}", tenant="{tenant.schema_name}", existe={user_exists_in_tenant}')
                
                if not user_exists_in_tenant:
                    # Usuário não existe no schema do tenant - criar agora
                    logger.warning(f'[LOGIN] Usuário "{username}" não existe no schema do tenant "{tenant.schema_name}". Criando usuário no schema do tenant...')
                    try:
                        logger.info(f'[LOGIN] Criando usuário com dados: username="{username}", email="{user_public.email}", first_name="{user_public.first_name}", last_name="{user_public.last_name}"')
                        user_tenant = User.objects.create_user(
                            username=username,
                            email=user_public.email,
                            password=password,  # Usar a senha fornecida
                            first_name=user_public.first_name,
                            last_name=user_public.last_name,
                            is_staff=False,
                            is_superuser=False,
                        )
                        logger.info(f'[LOGIN] ✅ Usuário "{username}" criado no schema do tenant "{tenant.schema_name}" com ID={user_tenant.id}')
                        # Verificar se a senha foi definida corretamente
                        if user_tenant.has_usable_password():
                            logger.info(f'[LOGIN] ✅ Senha do usuário "{username}" foi definida corretamente')
                        else:
                            logger.warning(f'[LOGIN] ⚠️ Senha do usuário "{username}" NÃO foi definida!')
                    except Exception as create_error:
                        logger.error(f'[LOGIN] ❌ Erro ao criar usuário no schema do tenant: {str(create_error)}', exc_info=True)
                        # Tentar autenticar mesmo assim (pode ser que o usuário tenha sido criado em outro momento)
                        logger.info(f'[LOGIN] Tentando autenticar usuário "{username}" mesmo após erro na criação...')
                        user_tenant = authenticate(username=username, password=password)
                        if user_tenant:
                            logger.info(f'[LOGIN] ✅ Autenticação bem-sucedida após erro na criação')
                        else:
                            logger.warning(f'[LOGIN] ⚠️ Autenticação falhou após erro na criação')
                else:
                    # Usuário existe, tentar autenticar
                    logger.info(f'[LOGIN] Usuário "{username}" existe no schema do tenant. Tentando autenticar...')
                    # Verificar se o usuário tem senha definida
                    user_in_tenant = User.objects.filter(username=username).first()
                    if user_in_tenant:
                        if user_in_tenant.has_usable_password():
                            logger.info(f'[LOGIN] ✅ Usuário "{username}" tem senha definida no schema do tenant')
                            # Verificar senha manualmente antes de autenticar
                            password_check = user_in_tenant.check_password(password)
                            logger.info(f'[LOGIN] 🔍 Verificação manual de senha: {password_check}')
                            logger.info(f'[LOGIN] 🔍 User is_active: {user_in_tenant.is_active}')
                            # Tentar autenticar
                            user_tenant = authenticate(username=username, password=password)
                            if user_tenant:
                                logger.info(f'[LOGIN] ✅ Autenticação bem-sucedida para usuário existente')
                            else:
                                logger.warning(f'[LOGIN] ⚠️ Autenticação falhou para usuário existente. Verificando senha...')
                                # Verificar se a senha do schema público funciona
                                with schema_context('public'):
                                    user_public_check = User.objects.filter(username=username).first()
                                    if user_public_check:
                                        public_password_check = user_public_check.check_password(password)
                                        logger.info(f'[LOGIN] 🔍 Verificação de senha no schema público: {public_password_check}')
                                        if public_password_check:
                                            logger.warning(f'[LOGIN] ⚠️ Senha do schema público está correta, mas senha do schema do tenant está diferente!')
                                            logger.warning(f'[LOGIN] ⚠️ Atualizando senha do schema do tenant para corresponder ao schema público...')
                                            # Atualizar senha no schema do tenant
                                            with schema_context(tenant.schema_name):
                                                user_in_tenant.set_password(password)
                                                user_in_tenant.save()
                                                logger.info(f'[LOGIN] ✅ Senha do schema do tenant atualizada! Tentando autenticar novamente...')
                                                user_tenant = authenticate(username=username, password=password)
                                                if user_tenant:
                                                    logger.info(f'[LOGIN] ✅ Autenticação bem-sucedida após atualização da senha!')
                                                else:
                                                    logger.error(f'[LOGIN] ❌ Autenticação ainda falha após atualização da senha!')
                                        else:
                                            logger.warning(f'[LOGIN] ⚠️ Senha incorreta também no schema público')
                                    else:
                                        logger.warning(f'[LOGIN] ⚠️ Usuário não encontrado no schema público')
                        else:
                            logger.warning(f'[LOGIN] ⚠️ Usuário "{username}" NÃO tem senha definida no schema do tenant! Definindo senha...')
                            # Definir senha usando a senha fornecida
                            user_in_tenant.set_password(password)
                            user_in_tenant.save()
                            logger.info(f'[LOGIN] ✅ Senha definida para usuário "{username}" no schema do tenant')
                            # Tentar autenticar
                            user_tenant = authenticate(username=username, password=password)
                            if user_tenant:
                                logger.info(f'[LOGIN] ✅ Autenticação bem-sucedida após definir senha')
                            else:
                                logger.error(f'[LOGIN] ❌ Autenticação ainda falha após definir senha!')
                    else:
                        logger.error(f'[LOGIN] ❌ Usuário "{username}" não encontrado no schema do tenant após verificação de existência!')
                        user_tenant = None
        except Exception as e:
            # Se houver erro ao acessar o schema (tenant desativado), tentar autenticar no schema público
            logger.error(f'[LOGIN] ❌ EXCEÇÃO ao acessar schema do tenant "{tenant.schema_name}": {str(e)}', exc_info=True)
            if not tenant_is_active:
                # Se o tenant está desativado, permitir login mesmo sem autenticação no schema
                # O usuário será redirecionado para tela de assinatura expirada
                logger.info(f'[LOGIN] Tenant "{tenant.name}" está desativado. Permitindo login para redirecionamento.')
                user_tenant = user_public  # Usar o usuário do schema público
            else:
                # Se o tenant está ativo mas houve erro, retornar erro
                logger.error(f'[LOGIN] Erro inesperado ao acessar schema do tenant ativo: {str(e)}')
                return Response(
                    {
                        'error': 'Erro ao acessar tenant',
                        'message': 'Ocorreu um erro ao acessar o tenant. Tente novamente ou entre em contato com o suporte.',
                    }, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        if not user_tenant:
            logger.warning(f'[LOGIN] ⚠️ user_tenant é None após tentativa de autenticação')
            # Verificar novamente se o tenant está ativo (pode ter mudado durante o processo)
            with schema_context('public'):
                tenant.refresh_from_db()
                tenant_is_active = tenant.is_active
            
            # Se não conseguiu autenticar e o tenant está ativo, retornar erro de credenciais
            if tenant_is_active:
                logger.warning(f'[LOGIN] Falha na autenticação para username="{username}" no tenant ativo "{tenant.name}"')
                # Verificar se o usuário existe no schema do tenant
                try:
                    with schema_context(tenant.schema_name):
                        user_exists = User.objects.filter(username=username).exists()
                        if not user_exists:
                            logger.error(f'[LOGIN] ❌ Usuário "{username}" NÃO existe no schema do tenant "{tenant.schema_name}"')
                            return Response(
                                {
                                    'error': 'Usuário não encontrado no tenant',
                                    'message': f'O usuário "{username}" não foi encontrado no tenant "{tenant.name}". Entre em contato com o suporte.',
                                }, 
                                status=status.HTTP_404_NOT_FOUND
                            )
                except Exception as e:
                    logger.error(f'[LOGIN] Erro ao verificar existência do usuário no schema: {str(e)}')
                
                return Response(
                    {
                        'error': 'Credenciais inválidas',
                        'message': 'Usuário ou senha incorretos. Verifique suas credenciais e tente novamente.',
                    }, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                # Se o tenant está desativado, permitir login mesmo sem autenticação no schema
                # O usuário será redirecionado para tela de assinatura expirada
                logger.info(f'[LOGIN] Tenant "{tenant.name}" está desativado. Permitindo login sem autenticação no schema.')
                user_tenant = user_public  # Usar o usuário do schema público
        
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
            'domain': tenant.domains.filter(is_primary=True).first().domain if tenant.domains.filter(is_primary=True).exists() else f'{tenant.schema_name}.localhost',
            'is_active': tenant_is_active,  # Informar se o tenant está ativo
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
        
        # Salvar empresa e filial usando os setters (que armazenam apenas os IDs)
        profile.current_tenant = tenant
        profile.current_empresa = empresa  # Usa o setter que armazena apenas o ID
        response_data['empresa'] = {
            'id': empresa.id,
            'nome': empresa.nome,
            'razao_social': empresa.razao_social,
        }
        
        if len(filiais) == 1:
            # Se apenas uma filial, definir como atual
            filial = filiais[0]
            profile.current_filial = filial  # Usa o setter que armazena apenas o ID
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
        
        # Salvar o perfil com tenant, empresa_id e filial_id
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
        
        # Salvar empresa e filial usando os setters (que armazenam apenas os IDs)
        profile.current_tenant = tenant
        profile.current_empresa = empresa  # Usa o setter que armazena apenas o ID
        
        if filial_id:
            with schema_context(tenant.schema_name):
                filial = Filial.objects.get(id=filial_id, empresa=empresa, is_active=True)
            profile.current_filial = filial  # Usa o setter que armazena apenas o ID
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


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    GET: Retorna informações do usuário atual e contexto (tenant, empresa, filial)
    PUT/PATCH: Atualiza informações do usuário e perfil
    """
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
    
    if request.method in ['PUT', 'PATCH']:
        # Atualizar dados do usuário
        user_data = request.data.get('user', {})
        if 'first_name' in user_data:
            request.user.first_name = user_data['first_name']
        if 'last_name' in user_data:
            request.user.last_name = user_data['last_name']
        if 'email' in user_data:
            request.user.email = user_data['email']
        request.user.save()
        
        # Atualizar dados do perfil
        profile_data = request.data.get('profile', {})
        if 'phone' in profile_data:
            profile.phone = profile_data['phone']
        profile.save()
        
        return Response({
            'message': 'Perfil atualizado com sucesso',
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'profile': {
                'phone': profile.phone or '',
            },
        }, status=status.HTTP_200_OK)
    
    # GET - retornar dados
    response_data = {
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'is_staff': request.user.is_staff,
            'is_active': request.user.is_active,
            'date_joined': request.user.date_joined.isoformat() if request.user.date_joined else None,
        },
        'profile': {
            'phone': profile.phone or '',
            'created_at': profile.created_at.isoformat() if profile.created_at else None,
            'updated_at': profile.updated_at.isoformat() if profile.updated_at else None,
        },
    }
    
    # Buscar tenant usando only() para evitar buscar colunas que podem não existir
    tenant = None
    if profile.current_tenant_id:
        try:
            with schema_context('public'):
                # Usar only() para buscar apenas colunas que sabemos que existem
                # Evitar buscar created_at/updated_at que podem causar problemas
                tenant = Tenant.objects.only('id', 'name', 'schema_name', 'is_active').get(id=profile.current_tenant_id)
        except Tenant.DoesNotExist:
            tenant = None
        except Exception as e:
            # Se houver erro ao buscar tenant (ex: colunas faltantes), tentar buscar sem only()
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Erro ao buscar tenant {profile.current_tenant_id} com only(): {e}. Tentando sem only()...")
            try:
                with schema_context('public'):
                    # Tentar buscar usando SQL direto para evitar problemas com colunas
                    from django.db import connection as db_connection
                    with db_connection.cursor() as cursor:
                        cursor.execute("""
                            SELECT id, name, schema_name, is_active 
                            FROM tenants_tenant 
                            WHERE id = %s
                        """, [profile.current_tenant_id])
                        row = cursor.fetchone()
                        if row:
                            # Criar objeto Tenant mínimo
                            tenant = Tenant(id=row[0], name=row[1], schema_name=row[2], is_active=row[3])
                            tenant._state.adding = False
            except Exception as e2:
                logger.error(f"Erro ao buscar tenant {profile.current_tenant_id} via SQL: {e2}")
                tenant = None
    
    if tenant:
        membership = TenantMembership.objects.filter(
            user=request.user,
            tenant=tenant,
            is_active=True
        ).first()
        
        response_data['tenant'] = {
            'id': tenant.id,
            'name': tenant.name,
            'schema_name': tenant.schema_name,
        }
        
        if membership:
            response_data['user']['role'] = membership.role
            response_data['user']['role_display'] = membership.get_role_display()
            
            # Incluir informações de permissões se for role customizado
            from accounts.models_roles import CustomRole
            system_roles = [choice[0] for choice in TenantMembership.ROLE_CHOICES]
            if membership.role not in system_roles:
                try:
                    custom_role = CustomRole.objects.get(
                        tenant=tenant,
                        code=membership.role,
                        is_active=True
                    )
                    response_data['user']['is_custom_role'] = True
                    response_data['user']['custom_role_id'] = custom_role.id
                except CustomRole.DoesNotExist:
                    response_data['user']['is_custom_role'] = False
        
        # Buscar empresa e filial usando os métodos helper
        empresa = profile.get_current_empresa()
        if empresa:
            response_data['empresa'] = {
                'id': empresa.id,
                'nome': empresa.nome,
                'razao_social': empresa.razao_social if hasattr(empresa, 'razao_social') else None,
            }
            
            filial = profile.get_current_filial()
            if filial:
                response_data['filial'] = {
                    'id': filial.id,
                    'nome': filial.nome,
                    'codigo_filial': filial.codigo_filial if hasattr(filial, 'codigo_filial') else None,
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

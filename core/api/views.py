"""
API Views for core app
"""
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.http import HttpResponse, Http404
from django.core.management import call_command
from accounts.permissions import IsTenantAdmin
from django_tenants.utils import schema_context
from tenants.models import Tenant
from django.utils import timezone
import os
import tempfile
import glob
from datetime import datetime

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_root(request):
    """
    Root endpoint da API
    """
    return Response({
        'message': 'SISCR API',
        'version': '1.0.0',
        'user': request.user.username,
        'endpoints': {
            'auth': '/api/auth/',
            # Add more endpoints as they are created
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def backup_tenant(request):
    """
    Endpoint para o admin do tenant fazer backup do seu tenant
    Retorna o arquivo ZIP para download
    
    Esta view funciona mesmo quando o tenant não é identificado pelo middleware,
    buscando o tenant pelo usuário autenticado (similar ao login).
    """
    try:
        # Obter tenant atual do usuário (sempre no schema público)
        with schema_context('public'):
            from accounts.models import UserProfile, TenantMembership
            
            # Criar perfil se não existir
            try:
                profile = request.user.profile
            except UserProfile.DoesNotExist:
                profile = UserProfile.objects.create(user=request.user)
            
            tenant = profile.current_tenant
            
            # Se não tiver tenant no perfil, buscar pelo primeiro membership ativo
            if not tenant:
                membership = TenantMembership.objects.filter(
                    user=request.user,
                    is_active=True
                ).first()
                
                if membership:
                    tenant = membership.tenant
                    # Atualizar o perfil com o tenant encontrado
                    profile.current_tenant = tenant
                    profile.save(update_fields=['current_tenant'])
            
            if not tenant:
                return Response(
                    {'error': 'Tenant não encontrado para este usuário'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Verificar se o usuário é admin do tenant
            membership = TenantMembership.objects.filter(
                user=request.user,
                tenant=tenant,
                is_active=True
            ).first()
            
            if not membership or not membership.is_tenant_admin():
                return Response(
                    {'error': 'Apenas administradores do tenant podem fazer backup'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Criar backup usando o comando de management
        temp_dir = tempfile.gettempdir()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'backup_{tenant.schema_name}_{timestamp}.zip'
        backup_path = os.path.join(temp_dir, backup_filename)
        
        # Executar comando de backup
        call_command('backup_tenant', tenant.schema_name, output_dir=temp_dir)
        
        # Verificar se o arquivo foi criado
        if not os.path.exists(backup_path):
            # Tentar encontrar o arquivo com o nome correto
            pattern = os.path.join(temp_dir, f'backup_{tenant.schema_name}_*.zip')
            files = glob.glob(pattern)
            if files:
                # Pegar o mais recente
                backup_path = max(files, key=os.path.getctime)
            else:
                return Response(
                    {'error': 'Arquivo de backup não foi criado'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Ler o arquivo e retornar para download
        with open(backup_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="{backup_filename}"'
            response['Content-Length'] = os.path.getsize(backup_path)
        
        # Atualizar data do último backup
        with schema_context('public'):
            tenant.last_backup_at = timezone.now()
            tenant.save(update_fields=['last_backup_at'])
        
        # Remover arquivo temporário após enviar
        try:
            os.remove(backup_path)
        except:
            pass  # Ignorar erro ao remover arquivo temporário
        
        return response
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Erro ao criar backup: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_backup_info(request):
    """
    Retorna informações sobre o último backup do tenant
    """
    try:
        with schema_context('public'):
            from accounts.models import UserProfile, TenantMembership
            
            try:
                profile = request.user.profile
            except UserProfile.DoesNotExist:
                return Response(
                    {'error': 'Perfil de usuário não encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            tenant = profile.current_tenant
            
            # Se não tiver tenant no perfil, buscar pelo primeiro membership ativo
            if not tenant:
                membership = TenantMembership.objects.filter(
                    user=request.user,
                    is_active=True
                ).first()
                
                if membership:
                    tenant = membership.tenant
            
            if not tenant:
                return Response(
                    {'error': 'Tenant não encontrado para este usuário'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response({
                'last_backup_at': tenant.last_backup_at.isoformat() if tenant.last_backup_at else None,
                'has_backup': tenant.last_backup_at is not None,
            })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Erro ao obter informações do backup: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


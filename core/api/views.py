"""
API Views for core app
"""
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.http import HttpResponse, Http404
from django.core.management import call_command
from django.db import connection
from django.core.cache import cache
from accounts.permissions import IsTenantAdmin
from django_tenants.utils import schema_context
from tenants.models import Tenant
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail, EmailMessage
from public.models import EmailSettings
from core.api.serializers import EmailSettingsSerializer
import os
import tempfile
import glob
from datetime import datetime, timedelta
import redis
import json as json_lib
import re
from collections import defaultdict, Counter

# Tentar importar psutil (opcional)
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint para monitoramento e deploy
    Verifica status de serviços críticos (DB, Redis, Celery, Stripe, etc.)
    """
    import time
    start_time = time.time()
    
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'version': os.environ.get('APP_VERSION', '1.0.0'),
        'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
        'services': {}
    }
    
    overall_healthy = True
    
    # Verificar banco de dados
    try:
        db_start = time.time()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_duration = round((time.time() - db_start) * 1000, 2)
        health_status['services']['database'] = {
            'status': 'healthy',
            'message': 'Database connection successful',
            'response_time_ms': db_duration
        }
    except Exception as e:
        overall_healthy = False
        health_status['services']['database'] = {
            'status': 'unhealthy',
            'message': f'Database connection failed: {str(e)}'
        }
    
    # Verificar Redis/Cache
    try:
        cache_start = time.time()
        cache.set('health_check', 'ok', 10)
        cache_result = cache.get('health_check')
        cache_duration = round((time.time() - cache_start) * 1000, 2)
        if cache_result == 'ok':
            health_status['services']['cache'] = {
                'status': 'healthy',
                'message': 'Cache (Redis) connection successful',
                'response_time_ms': cache_duration
            }
        else:
            raise Exception('Cache test failed')
    except Exception as e:
        overall_healthy = False
        health_status['services']['cache'] = {
            'status': 'unhealthy',
            'message': f'Cache (Redis) connection failed: {str(e)}'
        }
    
    # Verificar Celery (opcional - apenas se configurado)
    try:
        from celery import current_app
        celery_start = time.time()
        # Verificar se há workers ativos
        inspect = current_app.control.inspect()
        active_workers = inspect.active()
        celery_duration = round((time.time() - celery_start) * 1000, 2)
        
        if active_workers is not None:
            worker_count = len(active_workers)
            health_status['services']['celery'] = {
                'status': 'healthy',
                'message': f'Celery is running with {worker_count} worker(s)',
                'workers': worker_count,
                'response_time_ms': celery_duration
            }
        else:
            health_status['services']['celery'] = {
                'status': 'degraded',
                'message': 'Celery workers not responding (may be normal if no workers are running)',
                'response_time_ms': celery_duration
            }
    except Exception as e:
        # Celery não é crítico, apenas avisar
        health_status['services']['celery'] = {
            'status': 'unknown',
            'message': f'Could not check Celery status: {str(e)}'
        }
    
    # Verificar Stripe (opcional - apenas se configurado)
    try:
        stripe_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
        if stripe_key:
            health_status['services']['stripe'] = {
                'status': 'configured',
                'message': 'Stripe is configured',
                'mode': getattr(settings, 'STRIPE_MODE', 'unknown')
            }
        else:
            health_status['services']['stripe'] = {
                'status': 'not_configured',
                'message': 'Stripe is not configured'
            }
    except Exception as e:
        health_status['services']['stripe'] = {
            'status': 'unknown',
            'message': f'Could not check Stripe status: {str(e)}'
        }
    
    # Verificar configurações básicas
    try:
        required_settings = ['SECRET_KEY', 'DATABASES']
        missing_settings = []
        for setting in required_settings:
            if not hasattr(settings, setting) or not getattr(settings, setting, None):
                missing_settings.append(setting)
        
        if missing_settings:
            raise Exception(f'Missing required settings: {", ".join(missing_settings)}')
        
        health_status['services']['configuration'] = {
            'status': 'healthy',
            'message': 'Required settings are configured'
        }
    except Exception as e:
        overall_healthy = False
        health_status['services']['configuration'] = {
            'status': 'unhealthy',
            'message': f'Configuration check failed: {str(e)}'
        }
    
    # Verificar Sentry (se configurado)
    sentry_dsn = getattr(settings, 'SENTRY_DSN', None)
    if sentry_dsn:
        health_status['services']['sentry'] = {
            'status': 'configured',
            'message': 'Sentry error tracking is configured'
        }
    else:
        health_status['services']['sentry'] = {
            'status': 'not_configured',
            'message': 'Sentry is not configured'
        }
    
    # Calcular tempo total do health check
    total_duration = round((time.time() - start_time) * 1000, 2)
    health_status['health_check_duration_ms'] = total_duration
    
    # Atualizar status geral
    health_status['status'] = 'healthy' if overall_healthy else 'unhealthy'
    
    # Retornar status HTTP apropriado
    http_status = status.HTTP_200_OK if overall_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return Response(health_status, status=http_status)


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
            'health': '/api/health/',
            # Add more endpoints as they are created
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def metrics(request):
    """
    Retorna métricas de uso e quotas do tenant atual
    """
    from django.db import connection
    from subscriptions.models import Subscription, QuotaUsage
    from django_tenants.utils import schema_context
    
    tenant = getattr(connection, 'tenant', None)
    if not tenant:
        # Tentar buscar pelo usuário (schema público)
        with schema_context('public'):
            from accounts.models import UserProfile
            try:
                profile = request.user.profile
                tenant = profile.current_tenant
            except UserProfile.DoesNotExist:
                return Response(
                    {'error': 'Tenant não identificado'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
    
    if not tenant:
        return Response(
            {'error': 'Tenant não identificado'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Buscar assinatura e quota usage (sempre no schema público)
    with schema_context('public'):
        subscription = Subscription.objects.filter(tenant=tenant).first()
        quota_usage = QuotaUsage.objects.filter(tenant=tenant).first()
        
        if not subscription:
            return Response({
                'subscription': None,
                'quota_usage': None,
                'message': 'Nenhuma assinatura encontrada'
            })
        
        plan = subscription.plan
        
        # Calcular métricas de quota
        quotas = []
        
        if quota_usage:
            # Usuários
            users_percent = (quota_usage.users_count / plan.max_users * 100) if plan.max_users > 0 else 0
            quotas.append({
                'type': 'users',
                'name': 'Usuários',
                'used': quota_usage.users_count,
                'limit': plan.max_users,
                'percentage': min(100, round(users_percent, 1)),
                'warning': users_percent >= 80,
                'critical': users_percent >= 95,
            })
            
            # Empresas
            empresas_percent = (quota_usage.empresas_count / plan.max_empresas * 100) if plan.max_empresas > 0 else 0
            quotas.append({
                'type': 'empresas',
                'name': 'Empresas',
                'used': quota_usage.empresas_count,
                'limit': plan.max_empresas,
                'percentage': min(100, round(empresas_percent, 1)),
                'warning': empresas_percent >= 80,
                'critical': empresas_percent >= 95,
            })
            
            # Filiais
            filiais_percent = (quota_usage.filiais_count / plan.max_filiais * 100) if plan.max_filiais > 0 else 0
            quotas.append({
                'type': 'filiais',
                'name': 'Filiais',
                'used': quota_usage.filiais_count,
                'limit': plan.max_filiais,
                'percentage': min(100, round(filiais_percent, 1)),
                'warning': filiais_percent >= 80,
                'critical': filiais_percent >= 95,
            })
            
            # Storage (converter MB para GB)
            storage_gb_used = quota_usage.storage_mb / 1024
            storage_percent = (storage_gb_used / plan.max_storage_gb * 100) if plan.max_storage_gb > 0 else 0
            quotas.append({
                'type': 'storage',
                'name': 'Armazenamento',
                'used': round(storage_gb_used, 2),
                'limit': plan.max_storage_gb,
                'used_raw': quota_usage.storage_mb,
                'limit_raw': plan.max_storage_gb * 1024,
                'unit': 'GB',
                'percentage': min(100, round(storage_percent, 1)),
                'warning': storage_percent >= 80,
                'critical': storage_percent >= 95,
            })
        
        return Response({
            'subscription': {
                'id': subscription.id,
                'plan_name': plan.name,
                'plan_slug': plan.slug,
                'status': subscription.status,
                'is_active': subscription.is_active,
                'is_trial': subscription.is_trial,
                'expires_at': subscription.expires_at.isoformat() if subscription.expires_at else None,
                'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
                'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            },
            'plan': {
                'id': plan.id,
                'name': plan.name,
                'description': plan.description,
                'price_monthly': str(plan.price_monthly),
                'max_users': plan.max_users,
                'max_empresas': plan.max_empresas,
                'max_filiais': plan.max_filiais,
                'max_storage_gb': plan.max_storage_gb,
            },
            'quotas': quotas,
            'has_warnings': any(q.get('warning', False) for q in quotas),
            'has_critical': any(q.get('critical', False) for q in quotas),
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
@permission_classes([AllowAny])
def observability_dashboard(request):
    """
    Dashboard de observabilidade - mostra métricas e status do sistema
    Acessível sem autenticação para facilitar monitoramento
    
    Retorna HTML se Accept: text/html, ou JSON se Accept: application/json
    """
    import os
    import logging
    from pathlib import Path
    from django.conf import settings
    from django.shortcuts import render
    
    logger = logging.getLogger(__name__)
    
    try:
        # Informações básicas do sistema
        dashboard_data = {
            'system': {
                'version': os.environ.get('APP_VERSION', '1.0.0'),
                'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
                'debug': settings.DEBUG,
                'timestamp': timezone.now().isoformat(),
            },
            'services': {},
            'logging': {},
            'sentry': {},
            'health': None,
        }
        
        # Status dos serviços (chamar health_check diretamente)
        try:
            # Criar uma requisição fake para o health check
            from django.test import RequestFactory
            factory = RequestFactory()
            health_request = factory.get('/api/health/')
            health_response = health_check(health_request)
            dashboard_data['health'] = health_response.data
        except Exception as e:
            dashboard_data['health'] = {'error': str(e)}
        
        # Informações de logging
        logs_dir = Path(settings.BASE_DIR) / 'logs'
        if logs_dir.exists():
            django_log = logs_dir / 'django.log'
            errors_log = logs_dir / 'errors.log'
            
            dashboard_data['logging'] = {
                'enabled': True,
                'logs_directory': str(logs_dir),
                'django_log': {
                    'exists': django_log.exists(),
                    'size_mb': round(django_log.stat().st_size / (1024 * 1024), 2) if django_log.exists() else 0,
                },
                'errors_log': {
                    'exists': errors_log.exists(),
                    'size_mb': round(errors_log.stat().st_size / (1024 * 1024), 2) if errors_log.exists() else 0,
                },
            }
            
            # Tentar ler últimas linhas do log de erros
            if errors_log.exists():
                try:
                    with open(errors_log, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                        last_errors = lines[-5:] if len(lines) > 5 else lines
                        dashboard_data['logging']['last_errors'] = [
                            line.strip() for line in last_errors if line.strip()
                        ][-3:]  # Últimos 3 erros
                except:
                    dashboard_data['logging']['last_errors'] = []
        else:
            dashboard_data['logging'] = {
                'enabled': False,
                'message': 'Diretório de logs não encontrado',
            }
        
        # Status do Sentry
        sentry_dsn = getattr(settings, 'SENTRY_DSN', None)
        if sentry_dsn:
            dashboard_data['sentry'] = {
                'enabled': True,
                'configured': True,
                'message': 'Sentry está configurado e ativo',
            }
        else:
            dashboard_data['sentry'] = {
                'enabled': False,
                'configured': False,
                'message': 'Sentry não está configurado (opcional)',
                'how_to_enable': 'Configure a variável SENTRY_DSN no .env para ativar',
            }
        
        # Métricas básicas do cache
        try:
            cache.set('observability_test', 'ok', 10)
            cache_test = cache.get('observability_test')
            dashboard_data['services']['cache'] = {
                'status': 'working' if cache_test == 'ok' else 'error',
            }
        except:
            dashboard_data['services']['cache'] = {
                'status': 'error',
            }
    
        # Estatísticas do banco de dados
        try:
            from django_tenants.utils import schema_context
            from tenants.models import Tenant
            from django.contrib.auth import get_user_model
            
            User = get_user_model()
            
            with schema_context('public'):
                # Estatísticas básicas
                tenants_count = Tenant.objects.count()
                active_tenants = Tenant.objects.filter(is_active=True).count()
                inactive_tenants = tenants_count - active_tenants
                
                # Contar usuários (no schema público)
                users_count = User.objects.count()
                
                # Tamanho do banco de dados
                db_size = None
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            SELECT pg_size_pretty(pg_database_size(current_database()))
                        """)
                        db_size = cursor.fetchone()[0]
                except:
                    pass
                
                dashboard_data['database_stats'] = {
                    'tenants_total': tenants_count,
                    'tenants_active': active_tenants,
                    'tenants_inactive': inactive_tenants,
                    'users_total': users_count,
                    'database_size': db_size or 'N/A',
                }
                
                # Estatísticas de tenants (top 5 por atividade)
                try:
                    from subscriptions.models import Subscription
                    
                    # Tenants com assinaturas ativas (status='active' ou 'trial' e não expiradas)
                    now = timezone.now()
                    active_subscriptions = Subscription.objects.filter(
                        status__in=['active', 'trial'],
                        current_period_end__gt=now
                    ).count()
                    
                    # Tenants com assinaturas expiradas/canceladas
                    expired_subscriptions = Subscription.objects.filter(
                        status__in=['canceled', 'expired', 'past_due']
                    ).count()
                    
                    # Tenants com assinaturas pendentes
                    pending_subscriptions = Subscription.objects.filter(
                        status='pending'
                    ).count()
                    
                    # Tenants sem assinatura
                    tenants_with_subscription = Subscription.objects.values('tenant').distinct().count()
                    tenants_without_subscription = tenants_count - tenants_with_subscription
                    
                    dashboard_data['tenants_stats'] = {
                        'with_active_subscription': active_subscriptions,
                        'with_expired_subscription': expired_subscriptions,
                        'with_pending_subscription': pending_subscriptions,
                        'without_subscription': tenants_without_subscription,
                        'total_with_subscription': tenants_with_subscription,
                    }
                    
                    # Top 5 tenants (por nome)
                    top_tenants = Tenant.objects.all()[:5].values('id', 'name', 'schema_name', 'is_active')
                    dashboard_data['tenants_stats']['top_tenants'] = list(top_tenants)
                    
                except Exception as e:
                    dashboard_data['tenants_stats'] = {
                        'error': f'Erro ao buscar estatísticas: {str(e)}'
                    }
                    
        except Exception as e:
            dashboard_data['database_stats'] = {
                'error': f'Erro ao buscar estatísticas: {str(e)}'
            }
            dashboard_data['tenants_stats'] = {
                'error': f'Erro ao buscar estatísticas: {str(e)}'
            }
    
        # Análise de erros para gráfico
        try:
            logs_dir = Path(settings.BASE_DIR) / 'logs'
            errors_log = logs_dir / 'errors.log'
            
            if errors_log.exists():
                try:
                    with open(errors_log, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                        
                        # Analisar todas as linhas (não apenas últimas 100)
                        # para ter dados das últimas 24 horas
                        now = timezone.now()
                        twenty_four_hours_ago = now - timedelta(hours=24)
                        
                        # Estruturas para análise
                        errors_by_hour = defaultdict(int)  # {hora: quantidade}
                        error_types = Counter()  # {tipo: quantidade}
                        error_count = 0
                        warning_count = 0
                        
                        # Inicializar todas as horas das últimas 24h com 0
                        for i in range(24):
                            hour_key = (now - timedelta(hours=i)).strftime('%Y-%m-%d %H:00')
                            errors_by_hour[hour_key] = 0
                        
                        # Processar linhas (de trás para frente para otimizar)
                        for line in reversed(lines):
                            if not line.strip():
                                continue
                            
                            # Verificar se é erro ou warning
                            is_error = 'ERROR' in line.upper()
                            is_warning = 'WARNING' in line.upper()
                            
                            if is_error:
                                error_count += 1
                            elif is_warning:
                                warning_count += 1
                            
                            # Tentar extrair timestamp e tipo de exceção
                            timestamp = None
                            exception_type = None
                            
                            # Formato JSON (produção)
                            try:
                                # Tentar parsear como JSON
                                log_data = json_lib.loads(line.strip())
                                
                                # Extrair timestamp
                                if 'asctime' in log_data:
                                    try:
                                        timestamp = datetime.fromisoformat(log_data['asctime'].replace('Z', '+00:00'))
                                        # Garantir que é timezone-aware
                                        if timestamp.tzinfo is None:
                                            timestamp = timezone.make_aware(timestamp)
                                    except:
                                        # Tentar outros formatos
                                        try:
                                            timestamp = datetime.strptime(log_data['asctime'], '%Y-%m-%d %H:%M:%S,%f')
                                            # Converter para timezone-aware
                                            if timestamp.tzinfo is None:
                                                timestamp = timezone.make_aware(timestamp)
                                        except:
                                            pass
                                
                                # Extrair tipo de exceção
                                if 'exception_type' in log_data:
                                    exception_type = log_data['exception_type']
                                elif 'message' in log_data:
                                    # Tentar extrair do message
                                    msg = log_data['message']
                                    # Procurar por padrões como "ValueError", "KeyError", etc.
                                    match = re.search(r'(\w+Error|\w+Exception)', msg)
                                    if match:
                                        exception_type = match.group(1)
                                
                            except (json_lib.JSONDecodeError, ValueError):
                                # Formato texto (desenvolvimento)
                                # Tentar extrair timestamp de formatos comuns
                                # Exemplo: "2024-01-15 10:30:45,123 ERROR ..."
                                timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})', line)
                                if timestamp_match:
                                    try:
                                        timestamp_str = timestamp_match.group(1)
                                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                                        # Converter para timezone-aware
                                        if timestamp.tzinfo is None:
                                            timestamp = timezone.make_aware(timestamp)
                                    except:
                                        pass
                                
                                # Tentar extrair tipo de exceção do texto
                                exception_match = re.search(r'(\w+Error|\w+Exception)', line)
                                if exception_match:
                                    exception_type = exception_match.group(1)
                            
                            # Se encontrou timestamp e está nas últimas 24h
                            # Garantir que timestamp é timezone-aware antes de comparar
                            if timestamp:
                                if timestamp.tzinfo is None:
                                    timestamp = timezone.make_aware(timestamp)
                                if timestamp >= twenty_four_hours_ago:
                                    # Agrupar por hora
                                    hour_key = timestamp.replace(minute=0, second=0, microsecond=0).strftime('%Y-%m-%d %H:00')
                                    if is_error:
                                        errors_by_hour[hour_key] += 1
                            
                            # Contar tipos de exceção (top 5)
                            if exception_type and is_error:
                                error_types[exception_type] += 1
                        
                        # Preparar dados para gráfico de erros por hora
                        # Ordenar por hora (mais antigo primeiro)
                        sorted_hours = sorted([k for k in errors_by_hour.keys() if errors_by_hour[k] > 0])
                        if not sorted_hours:
                            # Se não há erros, mostrar últimas 24 horas vazias
                            sorted_hours = sorted(errors_by_hour.keys())[-24:]
                        
                        errors_by_hour_data = {
                            'labels': sorted_hours[-24:],  # Últimas 24 horas
                            'data': [errors_by_hour[h] for h in sorted_hours[-24:]]
                        }
                        
                        # Top 5 tipos de erro
                        top_error_types = error_types.most_common(5)
                        top_error_types_data = {
                            'labels': [t[0] for t in top_error_types],
                            'data': [t[1] for t in top_error_types]
                        }
                        
                        dashboard_data['errors_analysis'] = {
                            'total_recent_errors': error_count,
                            'total_recent_warnings': warning_count,
                            'ok_lines': max(0, len(lines) - error_count - warning_count),
                            'lines_analyzed': len(lines),
                            'errors_by_hour': errors_by_hour_data,
                            'top_error_types': top_error_types_data,
                        }
                        
                except Exception as e:
                    dashboard_data['errors_analysis'] = {
                        'total_recent_errors': 0,
                        'total_recent_warnings': 0,
                        'ok_lines': 0,
                        'lines_analyzed': 0,
                        'errors_by_hour': {'labels': [], 'data': []},
                        'top_error_types': {'labels': [], 'data': []},
                        'error': f'Erro ao ler arquivo: {str(e)}'
                    }
            else:
                dashboard_data['errors_analysis'] = {
                    'total_recent_errors': 0,
                    'total_recent_warnings': 0,
                    'ok_lines': 0,
                    'lines_analyzed': 0,
                    'errors_by_hour': {'labels': [], 'data': []},
                    'top_error_types': {'labels': [], 'data': []},
                }
        except Exception as e:
            dashboard_data['errors_analysis'] = {
                'error': f'Erro ao analisar logs: {str(e)}',
                'errors_by_hour': {'labels': [], 'data': []},
                'top_error_types': {'labels': [], 'data': []},
            }
        
        # Métricas de Sistema (CPU, Memória, Disco)
        try:
            system_metrics = {}
            
            if PSUTIL_AVAILABLE:
                try:
                    # CPU
                    cpu_percent = psutil.cpu_percent(interval=0.1)  # Intervalo curto para não demorar
                    cpu_count = psutil.cpu_count()
                    
                    # Memória
                    memory = psutil.virtual_memory()
                    memory_total_gb = round(memory.total / (1024 ** 3), 2)
                    memory_used_gb = round(memory.used / (1024 ** 3), 2)
                    memory_percent = memory.percent
                    memory_available_gb = round(memory.available / (1024 ** 3), 2)
                    
                    # Disco (usar raiz do sistema ou diretório atual)
                    import os
                    disk_path = os.path.abspath(os.sep) if os.name != 'nt' else os.path.splitdrive(os.path.abspath('.'))[0] + '\\'
                    disk = psutil.disk_usage(disk_path)
                    disk_total_gb = round(disk.total / (1024 ** 3), 2)
                    disk_used_gb = round(disk.used / (1024 ** 3), 2)
                    disk_free_gb = round(disk.free / (1024 ** 3), 2)
                    disk_percent = disk.percent
                    
                    # Uptime do sistema
                    try:
                        boot_time = datetime.fromtimestamp(psutil.boot_time())
                        uptime_delta = datetime.now() - boot_time
                        uptime_days = uptime_delta.days
                        uptime_hours = uptime_delta.seconds // 3600
                        uptime_minutes = (uptime_delta.seconds % 3600) // 60
                        uptime_str = f"{uptime_days}d {uptime_hours}h {uptime_minutes}m"
                    except:
                        uptime_str = "N/A"
                    
                    system_metrics = {
                        'cpu': {
                            'percent': round(cpu_percent, 2),
                            'count': cpu_count,
                            'status': 'warning' if cpu_percent > 80 else 'healthy' if cpu_percent < 50 else 'degraded',
                        },
                        'memory': {
                            'total_gb': memory_total_gb,
                            'used_gb': memory_used_gb,
                            'available_gb': memory_available_gb,
                            'percent': round(memory_percent, 2),
                            'status': 'warning' if memory_percent > 80 else 'healthy' if memory_percent < 50 else 'degraded',
                        },
                        'disk': {
                            'total_gb': disk_total_gb,
                            'used_gb': disk_used_gb,
                            'free_gb': disk_free_gb,
                            'percent': round(disk_percent, 2),
                            'status': 'warning' if disk_percent > 80 else 'healthy' if disk_percent < 50 else 'degraded',
                        },
                        'uptime': uptime_str,
                    }
                except Exception as e:
                    logger.debug(f'Erro ao coletar métricas de sistema: {str(e)}')
                    system_metrics = {
                        'error': f'Erro ao coletar métricas: {str(e)}'
                    }
            else:
                system_metrics = {
                    'error': 'psutil não está instalado. Execute: pip install psutil>=5.9.0'
                }
            
            dashboard_data['system_metrics'] = system_metrics
            
        except Exception as e:
            logger.error(f'Erro ao coletar métricas de sistema: {str(e)}', exc_info=True)
            dashboard_data['system_metrics'] = {
                'error': f'Erro ao coletar métricas: {str(e)}'
            }
        
        # Métricas de Redis/Cache
        try:
            redis_metrics = {}
            
            try:
                # Obter conexão Redis
                redis_client = None
                if hasattr(cache, 'client') and hasattr(cache.client, 'get_client'):
                    redis_client = cache.client.get_client(write=False)
                elif hasattr(settings, 'CACHES'):
                    cache_config = settings.CACHES.get('default', {})
                    if 'LOCATION' in cache_config:
                        import redis as redis_lib
                        redis_url = cache_config.get('LOCATION', '')
                        if redis_url.startswith('redis://'):
                            redis_client = redis_lib.from_url(redis_url)
                
                if redis_client:
                    # Informações do Redis
                    info = redis_client.info('stats')
                    memory_info = redis_client.info('memory')
                    
                    # Estatísticas de cache
                    keyspace_hits = info.get('keyspace_hits', 0)
                    keyspace_misses = info.get('keyspace_misses', 0)
                    total_requests = keyspace_hits + keyspace_misses
                    hit_rate = (keyspace_hits / total_requests * 100) if total_requests > 0 else 0
                    
                    # Memória do Redis
                    used_memory = memory_info.get('used_memory', 0)
                    used_memory_mb = round(used_memory / (1024 ** 2), 2)
                    used_memory_human = memory_info.get('used_memory_human', 'N/A')
                    
                    # Número de chaves
                    try:
                        # Tentar obter informações de keyspace
                        all_info = redis_client.info()
                        total_keys = 0
                        # Procurar por informações de database (db0, db1, etc.)
                        for key, value in all_info.items():
                            if key.startswith('db') and isinstance(value, str):
                                # Formato: "keys=123,expires=0,avg_ttl=0"
                                if 'keys=' in value:
                                    try:
                                        keys_count = int(value.split('keys=')[1].split(',')[0])
                                        total_keys += keys_count
                                    except:
                                        pass
                        # Se não encontrou, tentar contar diretamente (pode ser lento)
                        if total_keys == 0:
                            try:
                                total_keys = redis_client.dbsize()
                            except:
                                total_keys = 'N/A'
                    except:
                        # Fallback: tentar contar chaves (pode ser lento)
                        try:
                            total_keys = redis_client.dbsize()
                        except:
                            try:
                                total_keys = len(redis_client.keys('*'))
                            except:
                                total_keys = 'N/A'
                    
                    redis_metrics = {
                        'hit_rate': round(hit_rate, 2),
                        'miss_rate': round(100 - hit_rate, 2),
                        'keyspace_hits': keyspace_hits,
                        'keyspace_misses': keyspace_misses,
                        'total_requests': total_requests,
                        'used_memory_mb': used_memory_mb,
                        'used_memory_human': used_memory_human,
                        'total_keys': total_keys,
                        'status': 'healthy' if hit_rate > 70 else 'degraded' if hit_rate > 50 else 'warning',
                    }
                else:
                    redis_metrics = {
                        'error': 'Não foi possível conectar ao Redis para obter métricas'
                    }
                    
            except Exception as e:
                logger.debug(f'Erro ao coletar métricas do Redis: {str(e)}')
                redis_metrics = {
                    'error': f'Erro ao coletar métricas: {str(e)}'
                }
            
            dashboard_data['redis_metrics'] = redis_metrics
            
        except Exception as e:
            logger.error(f'Erro ao coletar métricas do Redis: {str(e)}', exc_info=True)
            dashboard_data['redis_metrics'] = {
                'error': f'Erro ao coletar métricas: {str(e)}'
            }
        
        # Métricas de Celery
        try:
            celery_metrics = {}
            
            try:
                from celery import current_app
                inspect = current_app.control.inspect()
                
                # Verificar se há workers ativos
                active_workers = inspect.active()
                reserved_tasks = inspect.reserved()
                scheduled_tasks = inspect.scheduled()
                stats = inspect.stats()
                
                if active_workers is not None:
                    # Contar tarefas ativas (em execução)
                    total_active_tasks = sum(len(tasks) for tasks in active_workers.values())
                    
                    # Contar tarefas reservadas (em fila)
                    total_reserved_tasks = sum(len(tasks) for tasks in reserved_tasks.values()) if reserved_tasks else 0
                    
                    # Contar tarefas agendadas
                    total_scheduled_tasks = sum(len(tasks) for tasks in scheduled_tasks.values()) if scheduled_tasks else 0
                    
                    # Número de workers
                    worker_count = len(active_workers)
                    
                    # Estatísticas agregadas dos workers
                    total_tasks_processed = 0
                    total_tasks_failed = 0
                    worker_names = []
                    
                    if stats:
                        for worker_name, worker_stats in stats.items():
                            worker_names.append(worker_name)
                            # Total de tarefas processadas (formato pode variar)
                            if 'total' in worker_stats:
                                total_stats = worker_stats.get('total', {})
                                # Tentar diferentes formatos
                                total_tasks_processed += total_stats.get('tasks.succeeded', 0) or total_stats.get('tasks_completed', 0) or 0
                                total_tasks_failed += total_stats.get('tasks.failed', 0) or total_stats.get('tasks_failed', 0) or 0
                            # Também tentar formato direto
                            if 'tasks' in worker_stats:
                                tasks_stats = worker_stats.get('tasks', {})
                                total_tasks_processed += tasks_stats.get('succeeded', 0) or tasks_stats.get('completed', 0) or 0
                                total_tasks_failed += tasks_stats.get('failed', 0) or 0
                    
                    # Listar tarefas ativas (primeiras 10)
                    active_tasks_list = []
                    if active_workers:
                        for worker_name, tasks in active_workers.items():
                            for task in tasks[:5]:  # Limitar a 5 por worker
                                active_tasks_list.append({
                                    'name': task.get('name', 'unknown'),
                                    'id': task.get('id', 'unknown'),
                                    'worker': worker_name,
                                    'args': str(task.get('args', []))[:50],  # Limitar tamanho
                                })
                    
                    celery_metrics = {
                        'workers': {
                            'count': worker_count,
                            'names': worker_names,
                            'status': 'healthy' if worker_count > 0 else 'degraded',
                        },
                        'tasks': {
                            'active': total_active_tasks,  # Em execução agora
                            'reserved': total_reserved_tasks,  # Em fila
                            'scheduled': total_scheduled_tasks,  # Agendadas
                            'total_in_queue': total_reserved_tasks + total_scheduled_tasks,
                        },
                        'statistics': {
                            'processed': total_tasks_processed,
                            'failed': total_tasks_failed,
                            'success_rate': round((total_tasks_processed / (total_tasks_processed + total_tasks_failed) * 100) if (total_tasks_processed + total_tasks_failed) > 0 else 100, 2),
                        },
                        'active_tasks_list': active_tasks_list[:10],  # Top 10
                        'status': 'healthy' if worker_count > 0 else 'degraded',
                    }
                else:
                    celery_metrics = {
                        'workers': {
                            'count': 0,
                            'names': [],
                            'status': 'degraded',
                        },
                        'tasks': {
                            'active': 0,
                            'reserved': 0,
                            'scheduled': 0,
                            'total_in_queue': 0,
                        },
                        'statistics': {
                            'processed': 0,
                            'failed': 0,
                            'success_rate': 0,
                        },
                        'active_tasks_list': [],
                        'status': 'degraded',
                        'message': 'Celery workers não estão respondendo (pode ser normal se não houver workers rodando)',
                    }
                    
            except ImportError:
                celery_metrics = {
                    'error': 'Celery não está instalado ou configurado'
                }
            except Exception as e:
                logger.debug(f'Erro ao coletar métricas do Celery: {str(e)}')
                celery_metrics = {
                    'error': f'Erro ao coletar métricas: {str(e)}'
                }
            
            dashboard_data['celery_metrics'] = celery_metrics
            
        except Exception as e:
            logger.error(f'Erro ao coletar métricas do Celery: {str(e)}', exc_info=True)
            dashboard_data['celery_metrics'] = {
                'error': f'Erro ao coletar métricas: {str(e)}'
            }
        
        # Métricas de Performance
        try:
            import json
            
            # 1. Tempos de resposta (últimas 100 requisições)
            response_times = []
            try:
                times = cache.lrange('metrics:response_times', 0, -1)
                response_times = [float(t) for t in times]  # Converter para float
            except:
                pass
            
            # Calcular estatísticas
            if response_times:
                dashboard_data['performance'] = {
                    'response_times': response_times[-50:],  # Últimas 50 para o gráfico
                    'avg_response_time': round(sum(response_times) / len(response_times), 2),
                    'min_response_time': round(min(response_times), 2),
                    'max_response_time': round(max(response_times), 2),
                    'total_requests': len(response_times),
                }
            else:
                dashboard_data['performance'] = {
                    'response_times': [],
                    'avg_response_time': 0,
                    'min_response_time': 0,
                    'max_response_time': 0,
                    'total_requests': 0,
                }
            
            # 2. Top 10 Requisições Mais Lentas
            slow_requests = []
            try:
                slow_data = cache.lrange('metrics:slow_requests', 0, -1)
                slow_requests = [json_lib.loads(r) for r in slow_data]
                # Ordenar por duração (mais lento primeiro)
                slow_requests.sort(key=lambda x: x.get('duration_ms', 0), reverse=True)
            except Exception as e:
                logger.debug(f'Erro ao buscar requisições lentas: {str(e)}')
            
            dashboard_data['performance']['slow_requests'] = slow_requests[:10]  # Top 10
            
            # 3. Endpoints Mais Acessados
            try:
                # Buscar todas as chaves de endpoints
                # Nota: Redis não tem comando direto para buscar por padrão
                # Vamos usar uma abordagem alternativa: armazenar lista de endpoints
                endpoints_list_key = 'metrics:endpoints_list'
                endpoints_data = cache.get(endpoints_list_key)
                
                top_endpoints = []
                if endpoints_data:
                    endpoints_list = json_lib.loads(endpoints_data)
                    for endpoint_info in endpoints_list[:10]:  # Top 10
                        method = endpoint_info.get('method', '')
                        path = endpoint_info.get('path', '')
                        count_key = f'metrics:endpoint:{method}:{path}'
                        avg_key = f'metrics:endpoint_avg:{method}:{path}'
                        
                        count = cache.get(count_key, 0)
                        avg_time = cache.get(avg_key, 0)
                        
                        if count > 0:
                            top_endpoints.append({
                                'path': path,
                                'method': method,
                                'count': int(count),
                                'avg_time_ms': round(float(avg_time), 2) if avg_time else 0,
                            })
                    
                    # Ordenar por número de requisições
                    top_endpoints.sort(key=lambda x: x['count'], reverse=True)
                
                dashboard_data['performance']['top_endpoints'] = top_endpoints[:10]
            except Exception as e:
                logger.debug(f'Erro ao buscar endpoints: {str(e)}')
                dashboard_data['performance']['top_endpoints'] = []
                
        except Exception as e:
            logger.error(f'Erro ao coletar métricas de performance: {str(e)}', exc_info=True)
            dashboard_data['performance'] = {
                'error': f'Erro ao coletar métricas: {str(e)}'
            }
        
        # Verificar se o cliente quer HTML ou JSON
        accept_header = request.META.get('HTTP_ACCEPT', '')
        format_param = request.GET.get('format', '')
        
        # Se pedir HTML explicitamente ou Accept contém text/html
        if format_param == 'html' or 'text/html' in accept_header:
            try:
                return render(request, 'observability_dashboard.html', {
                    'data': dashboard_data
                })
            except Exception as e:
                logger.error(f'Erro ao renderizar template: {str(e)}', exc_info=True)
                # Se falhar, retorna JSON com erro
                dashboard_data['template_error'] = str(e)
                return Response(dashboard_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Caso contrário, retorna JSON
        return Response(dashboard_data)
        
    except Exception as e:
        logger.error(f'Erro crítico no dashboard de observabilidade: {str(e)}', exc_info=True)
        # Retornar resposta de erro básica
        error_data = {
            'error': 'Erro ao gerar dashboard de observabilidade',
            'message': str(e),
            'system': {
                'version': os.environ.get('APP_VERSION', '1.0.0'),
                'timestamp': timezone.now().isoformat(),
            }
        }
        
        # Tentar retornar HTML de erro se possível
        accept_header = request.META.get('HTTP_ACCEPT', '')
        format_param = request.GET.get('format', '')
        if format_param == 'html' or 'text/html' in accept_header:
            try:
                from django.template import Template, Context
                error_html = """
                <!DOCTYPE html>
                <html>
                <head><title>Erro - Dashboard</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>Erro ao carregar dashboard</h1>
                    <p>{{ message }}</p>
                    <p><a href="/api/observability/?format=json">Ver JSON</a></p>
                </body>
                </html>
                """
                template = Template(error_html)
                return HttpResponse(template.render(Context({'message': str(e)})))
            except:
                pass
        
        return Response(error_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


class EmailSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciar configurações de email
    Apenas admins podem acessar
    EmailSettings está no schema público (shared)
    """
    serializer_class = EmailSettingsSerializer
    permission_classes = [IsAuthenticated, IsTenantAdmin]
    
    def get_queryset(self):
        """Retorna configurações do schema público"""
        with schema_context('public'):
            return EmailSettings.objects.filter(is_active=True).order_by('-created_at')
    
    def get_object(self):
        """Buscar objeto no schema público"""
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        with schema_context('public'):
            return EmailSettings.objects.get(**lookup)
    
    def perform_create(self, serializer):
        """Criar no schema público"""
        with schema_context('public'):
            serializer.save()
    
    def perform_update(self, serializer):
        """Atualizar no schema público"""
        with schema_context('public'):
            serializer.save()
    
    def perform_destroy(self, instance):
        """Deletar no schema público"""
        with schema_context('public'):
            instance.delete()
    
    @action(detail=False, methods=['post'], url_path='test', url_name='test-email')
    def test_email(self, request):
        """
        Endpoint para testar envio de email
        Recebe: { "to_email": "email@exemplo.com" }
        """
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[EmailSettings] test_email chamado com data: {request.data}")
        
        to_email = request.data.get('to_email')
        if not to_email:
            return Response(
                {'error': 'Email de destino é obrigatório'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Buscar configuração ativa no schema público
        with schema_context('public'):
            email_settings = EmailSettings.objects.filter(is_active=True).order_by('-created_at').first()
            
            if not email_settings:
                return Response(
                    {'error': 'Nenhuma configuração de email ativa encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        try:
            # Aplicar configurações temporariamente
            settings_dict = email_settings.get_settings_dict()
            original_settings = {}
            
            # Salvar configurações originais
            for key, value in settings_dict.items():
                original_settings[key] = getattr(settings, key, None)
                setattr(settings, key, value)
            
            # Enviar email de teste
            subject = 'Teste de Email - SISCR'
            message = f'''
Este é um email de teste do sistema SISCR.

Configurações utilizadas:
- Backend: {email_settings.get_backend_display()}
- Servidor: {email_settings.host or 'N/A'}
- Porta: {email_settings.port}
- Remetente: {email_settings.from_email}

Se você recebeu este email, a configuração está funcionando corretamente!

Data/Hora: {timezone.now().strftime("%d/%m/%Y %H:%M:%S")}
            '''
            
            send_mail(
                subject=subject,
                message=message,
                from_email=email_settings.from_email,
                recipient_list=[to_email],
                fail_silently=False,
            )
            
            # Restaurar configurações originais
            for key, value in original_settings.items():
                if value is not None:
                    setattr(settings, key, value)
            
            return Response({
                'success': True,
                'message': f'Email de teste enviado com sucesso para {to_email}',
                'settings_used': {
                    'backend': email_settings.get_backend_display(),
                    'host': email_settings.host,
                    'port': email_settings.port,
                    'from_email': email_settings.from_email,
                }
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {
                    'success': False,
                    'error': f'Erro ao enviar email: {str(e)}',
                    'details': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


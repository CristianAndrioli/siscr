"""
Admin para modelos de Tenant
"""
from django.contrib import admin
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.db import connection, transaction
from django.shortcuts import redirect
from django.http import HttpResponse, Http404
from django.utils.html import format_html
from django.urls import reverse, path
from django.utils.safestring import mark_safe
from django_tenants.admin import TenantAdminMixin
from django_tenants.utils import schema_context
from .models import Tenant, Domain, Empresa, Filial
import os
import tempfile
import zipfile
from datetime import datetime
from django.conf import settings
from django.utils import timezone


@admin.register(Tenant)
class TenantAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = (
        'name', 
        'schema_name', 
        'domains_display',
        'is_active',
        'created_at',
        'last_backup_display',
        'actions_display'
    )
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'schema_name')
    readonly_fields = (
        'schema_name', 
        'created_at', 
        'updated_at',
        'last_backup_at',
        'last_backup_at_display',
        'domains_list',
        'subscription_info',
        'statistics'
    )
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('name', 'schema_name', 'description', 'is_active')
        }),
        ('Domínios', {
            'fields': ('domains_list',),
            'classes': ('collapse',)
        }),
        ('Assinatura', {
            'fields': ('subscription_info',),
            'classes': ('collapse',)
        }),
        ('Estatísticas', {
            'fields': ('statistics',),
            'classes': ('collapse',)
        }),
        ('Datas', {
            'fields': ('created_at', 'updated_at', 'last_backup_at_display')
        }),
    )
    
    actions = ['delete_tenant_completely']
    
    # Desabilitar a ação padrão de exclusão do Django Admin
    # para forçar o uso da nossa action customizada
    def get_actions(self, request):
        actions = super().get_actions(request)
        # Remover a ação padrão 'delete_selected' se existir
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions
    
    def domains_display(self, obj):
        """Exibe os domínios do tenant"""
        domains = Domain.objects.filter(tenant=obj)
        if domains.exists():
            domain_list = ', '.join([d.domain for d in domains])
            primary = domains.filter(is_primary=True).first()
            if primary:
                return format_html(
                    '<strong>{}</strong>{}',
                    primary.domain,
                    f' (+{domains.count() - 1})' if domains.count() > 1 else ''
                )
            return domain_list
        return '-'
    domains_display.short_description = 'Domínios'
    
    def domains_list(self, obj):
        """Lista todos os domínios do tenant"""
        domains = Domain.objects.filter(tenant=obj)
        if domains.exists():
            html = '<ul>'
            for domain in domains:
                primary_badge = ' <span style="color: green;">(Principal)</span>' if domain.is_primary else ''
                html += f'<li>{domain.domain}{primary_badge}</li>'
            html += '</ul>'
            return format_html(html)
        return 'Nenhum domínio cadastrado'
    domains_list.short_description = 'Lista de Domínios'
    
    def subscription_info(self, obj):
        """Informações da assinatura"""
        try:
            from subscriptions.models import Subscription
            subscription = Subscription.objects.filter(tenant=obj).first()
            if subscription:
                status_colors = {
                    'active': 'green',
                    'trial': 'blue',
                    'pending': 'orange',
                    'canceled': 'red',
                    'expired': 'gray',
                }
                color = status_colors.get(subscription.status, 'gray')
                return format_html(
                    '<div>'
                    '<p><strong>Plano:</strong> {}</p>'
                    '<p><strong>Status:</strong> <span style="color: {};">{}</span></p>'
                    '<p><strong>Ciclo:</strong> {}</p>'
                    '<p><strong>Válido até:</strong> {}</p>'
                    '</div>',
                    subscription.plan.name if subscription.plan else 'N/A',
                    color,
                    subscription.get_status_display(),
                    subscription.get_billing_cycle_display(),
                    subscription.current_period_end.strftime('%d/%m/%Y') if subscription.current_period_end else 'N/A'
                )
        except ImportError:
            pass
        return 'Nenhuma assinatura encontrada'
    subscription_info.short_description = 'Informações da Assinatura'
    
    def statistics(self, obj):
        """Estatísticas do tenant"""
        try:
            from django_tenants.utils import schema_context
            from django.contrib.auth import get_user_model
            from accounts.models import TenantMembership
            
            User = get_user_model()
            
            # Contar usuários no schema público
            users_count = TenantMembership.objects.filter(tenant=obj, is_active=True).count()
            
            # Contar empresas e filiais no schema do tenant
            empresas_count = 0
            filiais_count = 0
            
            try:
                with schema_context(obj.schema_name):
                    empresas_count = Empresa.objects.filter(tenant=obj).count()
                    filiais_count = Filial.objects.filter(empresa__tenant=obj).count()
            except Exception:
                pass
            
            return format_html(
                '<div>'
                '<p><strong>Usuários:</strong> {}</p>'
                '<p><strong>Empresas:</strong> {}</p>'
                '<p><strong>Filiais:</strong> {}</p>'
                '</div>',
                users_count,
                empresas_count,
                filiais_count
            )
        except Exception as e:
            return f'Erro ao carregar estatísticas: {str(e)}'
    statistics.short_description = 'Estatísticas'
    
    def last_backup_display(self, obj):
        """Exibe a data do último backup no fuso horário local (listagem)"""
        if obj.last_backup_at:
            from django.utils import timezone
            from django.utils.dateformat import format
            # Converter UTC para fuso horário local
            local_time = timezone.localtime(obj.last_backup_at)
            return format(local_time, 'd/m/Y H:i')
        return '-'
    last_backup_display.short_description = 'Último Backup'
    
    def last_backup_at_display(self, obj):
        """Exibe a data do último backup no fuso horário local (formulário)"""
        if obj.last_backup_at:
            from django.utils import timezone
            from django.utils.dateformat import format
            # Converter UTC para fuso horário local
            local_time = timezone.localtime(obj.last_backup_at)
            return format(local_time, 'd/m/Y H:i:s')
        return 'Nunca'
    last_backup_at_display.short_description = 'Último Backup Manual'
    
    def actions_display(self, obj):
        """Botões de ações"""
        delete_url = reverse('admin:tenants_tenant_delete', args=[obj.pk])
        backup_url = reverse('admin:tenants_tenant_backup', args=[obj.pk])
        return format_html(
            '<a href="{}" class="button" style="background-color: #28a745; color: white; padding: 5px 10px; text-decoration: none; border-radius: 3px; margin-right: 5px;">💾 Backup</a> '
            '<a href="{}" class="button" style="background-color: #dc3545; color: white; padding: 5px 10px; text-decoration: none; border-radius: 3px;">🗑️ Excluir</a>',
            backup_url, delete_url
        )
    actions_display.short_description = 'Ações'
    
    def delete_tenant_completely(self, request, queryset):
        """
        Action para excluir completamente um tenant e todos os dados relacionados.
        Remove: schema do banco, domínios, assinaturas, usuários, empresas, filiais, etc.
        """
        if not request.user.is_superuser:
            self.message_user(
                request,
                'Apenas superusuários podem excluir tenants.',
                level='error'
            )
            return
        
        count = 0
        errors = []
        
        for tenant in queryset:
            try:
                schema_name = tenant.schema_name
                tenant_name = tenant.name
                tenant_id = tenant.id  # Salvar ID antes de deletar
                
                # Usar transação atômica para garantir que tudo seja feito ou nada
                with transaction.atomic():
                    # 1. Remover domínios associados
                    domains = Domain.objects.filter(tenant=tenant)
                    domain_count = domains.count()
                    domains.delete()
                    
                    # 2. Cancelar assinatura no Stripe antes de remover (no schema público)
                    try:
                        from subscriptions.models import Subscription, QuotaUsage
                        from payments.services import StripeService
                        
                        subscription = Subscription.objects.filter(tenant=tenant).first()
                        if subscription and subscription.payment_gateway_id:
                            # Tentar cancelar imediatamente no Stripe (não espera fim do período)
                            try:
                                stripe_service = StripeService()
                                stripe_service.cancel_subscription_immediately(subscription.payment_gateway_id)
                                self.message_user(
                                    request,
                                    f'✅ Assinatura cancelada imediatamente no Stripe para o tenant "{tenant_name}"',
                                    level='info'
                                )
                            except Exception as stripe_error:
                                # Log do erro mas continua com a exclusão
                                error_msg = f'Aviso: Não foi possível cancelar assinatura no Stripe para "{tenant_name}": {str(stripe_error)}'
                                errors.append(error_msg)
                                self.message_user(request, error_msg, level='warning')
                        
                        # Remover assinaturas e quotas do banco local
                        Subscription.objects.filter(tenant=tenant).delete()
                        QuotaUsage.objects.filter(tenant=tenant).delete()
                    except Exception as e:
                        errors.append(f'Erro ao remover assinaturas: {str(e)}')
                    
                    # Remover pagamentos, faturas, métodos de pagamento e outros dados relacionados ao tenant
                    try:
                        sid = transaction.savepoint()
                        with connection.cursor() as cursor:
                            # Remover faturas (Invoice) - elas referenciam Payment e Subscription
                            cursor.execute(
                                "DELETE FROM payments_invoice WHERE tenant_id = %s",
                                [tenant_id]
                            )
                            
                            # Remover pagamentos (Payment) - eles referenciam Subscription e PaymentMethod
                            cursor.execute(
                                "DELETE FROM payments_payment WHERE tenant_id = %s",
                                [tenant_id]
                            )
                            
                            # Remover métodos de pagamento (PaymentMethod)
                            cursor.execute(
                                "DELETE FROM payments_paymentmethod WHERE tenant_id = %s",
                                [tenant_id]
                            )
                            
                            # Remover pending signups (se a tabela existir)
                            try:
                                cursor.execute(
                                    "DELETE FROM public_pendingsignup WHERE tenant_id = %s",
                                    [tenant_id]
                                )
                            except Exception:
                                # Tabela pode não existir, ignorar
                                pass
                        transaction.savepoint_commit(sid)
                    except Exception as e:
                        transaction.savepoint_rollback(sid)
                        errors.append(f'Erro ao remover pagamentos: {str(e)}')
                    
                    # 3. Atualizar perfis de usuário para remover referências a empresas e filiais
                    # Isso é necessário porque UserProfile tem ForeignKey para Empresa e Filial
                    try:
                        sid = transaction.savepoint()
                        with connection.cursor() as cursor:
                            # Primeiro, atualizar perfis para remover referências a filiais das empresas do tenant
                            cursor.execute("""
                                UPDATE accounts_userprofile 
                                SET current_filial_id = NULL 
                                WHERE current_filial_id IN (
                                    SELECT id FROM tenants_filial 
                                    WHERE empresa_id IN (
                                        SELECT id FROM tenants_empresa WHERE tenant_id = %s
                                    )
                                )
                            """, [tenant_id])
                            
                            # Depois, atualizar perfis para remover referências a empresas do tenant
                            cursor.execute("""
                                UPDATE accounts_userprofile 
                                SET current_empresa_id = NULL 
                                WHERE current_empresa_id IN (
                                    SELECT id FROM tenants_empresa WHERE tenant_id = %s
                                )
                            """, [tenant_id])
                        transaction.savepoint_commit(sid)
                    except Exception as e:
                        # Fazer rollback do savepoint em caso de erro, mas continuar
                        transaction.savepoint_rollback(sid)
                        errors.append(f'Erro ao atualizar perfis de usuário: {str(e)}')
                    
                    # 4. Remover empresas e filiais do schema público usando SQL direto
                    # Isso é necessário porque Empresa tem ForeignKey para Tenant no schema público
                    # Usamos SQL direto para evitar que o Django tente verificar objetos relacionados
                    # que podem estar no schema do tenant
                    # Usamos savepoint para isolar operações que podem falhar
                    try:
                        sid = transaction.savepoint()
                        with connection.cursor() as cursor:
                            # Primeiro remover filiais (elas referenciam empresas)
                            cursor.execute(
                                "DELETE FROM tenants_filial WHERE empresa_id IN (SELECT id FROM tenants_empresa WHERE tenant_id = %s)",
                                [tenant_id]
                            )
                            filiais_removed = cursor.rowcount
                            
                            # Depois remover empresas
                            cursor.execute(
                                "DELETE FROM tenants_empresa WHERE tenant_id = %s",
                                [tenant_id]
                            )
                            empresas_removed = cursor.rowcount
                        transaction.savepoint_commit(sid)
                    except Exception as e:
                        # Fazer rollback do savepoint em caso de erro, mas continuar
                        transaction.savepoint_rollback(sid)
                        errors.append(f'Erro ao remover empresas do schema público: {str(e)}')
                    
                    # 5. Remover memberships, profiles e usuários relacionados
                    # Usamos SQL direto para evitar que o Django tente verificar objetos relacionados
                    try:
                        sid = transaction.savepoint()
                        with connection.cursor() as cursor:
                            # Obter IDs dos usuários que têm membership apenas neste tenant
                            cursor.execute("""
                                SELECT user_id FROM accounts_tenantmembership 
                                WHERE tenant_id = %s
                                AND user_id NOT IN (
                                    SELECT DISTINCT user_id FROM accounts_tenantmembership 
                                    WHERE tenant_id != %s
                                )
                            """, [tenant_id, tenant_id])
                            user_ids_to_delete = [row[0] for row in cursor.fetchall()]
                            
                            # Remover memberships
                            cursor.execute(
                                "DELETE FROM accounts_tenantmembership WHERE tenant_id = %s",
                                [tenant_id]
                            )
                            
                            # Atualizar profiles para remover referência ao tenant
                            cursor.execute(
                                "UPDATE accounts_userprofile SET current_tenant_id = NULL WHERE current_tenant_id = %s",
                                [tenant_id]
                            )
                            
                            # Remover perfis de usuários que não têm mais nenhum membership
                            if user_ids_to_delete:
                                cursor.execute("""
                                    DELETE FROM accounts_userprofile 
                                    WHERE user_id IN %s
                                """, [tuple(user_ids_to_delete)])
                            
                            # Remover usuários que não têm mais nenhum membership usando SQL direto
                            # Isso evita que o Django tente fazer cascade delete em objetos relacionados
                            # que podem estar em schemas de tenants
                            if user_ids_to_delete:
                                # Primeiro, remover todas as referências relacionadas aos usuários no schema público
                                # 1. Remover permissões do usuário
                                cursor.execute("""
                                    DELETE FROM auth_user_user_permissions 
                                    WHERE user_id IN %s
                                """, [tuple(user_ids_to_delete)])
                                
                                # 2. Remover grupos do usuário
                                cursor.execute("""
                                    DELETE FROM auth_user_groups 
                                    WHERE user_id IN %s
                                """, [tuple(user_ids_to_delete)])
                                
                                # 3. Remover sessões do usuário (se houver)
                                for user_id in user_ids_to_delete:
                                    cursor.execute("""
                                        DELETE FROM django_session 
                                        WHERE session_data LIKE %s
                                    """, [f'%"_auth_user_id","{user_id}"%'])
                                
                                # 4. Limpar referências de last_login
                                cursor.execute("""
                                    UPDATE auth_user 
                                    SET last_login = NULL 
                                    WHERE id IN %s
                                """, [tuple(user_ids_to_delete)])
                                
                                # 5. Deletar os usuários diretamente usando SQL
                                cursor.execute("""
                                    DELETE FROM auth_user 
                                    WHERE id IN %s
                                """, [tuple(user_ids_to_delete)])
                        transaction.savepoint_commit(sid)
                    except Exception as e:
                        # Fazer rollback do savepoint em caso de erro, mas continuar
                        transaction.savepoint_rollback(sid)
                        errors.append(f'Erro ao remover memberships: {str(e)}')
                    
                    # 6. Remover o schema do banco de dados ANTES de deletar o objeto
                    # Isso é crítico: o schema deve ser removido antes para evitar que o Django
                    # tente verificar objetos relacionados no schema do tenant
                    schema_removed = False
                    with connection.cursor() as cursor:
                        try:
                            cursor.execute(
                                "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                                [schema_name]
                            )
                            if cursor.fetchone():
                                cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                                schema_removed = True
                        except Exception as e:
                            errors.append(f'Erro ao remover schema {schema_name}: {str(e)}')
                    
                    # 7. Remover o tenant diretamente do banco usando SQL
                    # Isso evita que o Django tente verificar objetos relacionados
                    with connection.cursor() as cursor:
                        try:
                            cursor.execute(
                                "DELETE FROM tenants_tenant WHERE id = %s",
                                [tenant_id]
                            )
                        except Exception as e:
                            # Se falhar, tentar usar o método delete padrão
                            try:
                                tenant.delete()
                            except Exception as delete_error:
                                errors.append(f'Erro ao remover tenant {tenant_name} do banco: {str(delete_error)}')
                                continue
                    
                    count += 1
                    self.message_user(
                        request,
                        f'✅ Tenant "{tenant_name}" ({schema_name}) excluído com sucesso! '
                        f'Schema removido: {schema_removed}, Domínios removidos: {domain_count}',
                        level='success'
                    )
                    
            except Exception as e:
                errors.append(f'Erro ao excluir tenant {tenant.name}: {str(e)}')
        
        if errors:
            for error in errors:
                self.message_user(request, error, level='error')
        
        if count > 0:
            self.message_user(
                request,
                f'{count} tenant(s) excluído(s) completamente com todos os dados relacionados.',
                level='success'
            )
    
    delete_tenant_completely.short_description = "🗑️ Excluir tenant completamente (irreversível)"
    
    def get_deleted_objects(self, objs, request):
        """
        Sobrescreve get_deleted_objects para evitar tentar coletar objetos do schema do tenant.
        Como os dados do tenant estão em um schema separado, não podemos coletá-los aqui.
        Retorna lista vazia de objetos relacionados.
        O aviso será exibido via extra_context no delete_view.
        """
        # Retornar lista vazia para evitar erros no template
        # Os dados do tenant estão em outro schema e serão removidos via DROP SCHEMA CASCADE
        deleted_objects = []
        model_count = {}
        perms_needed = set()
        
        # Não retornar warning_message aqui, será exibido via extra_context
        return deleted_objects, model_count, perms_needed, []
    
    def delete_view(self, request, object_id, extra_context=None):
        """
        Sobrescreve delete_view para adicionar contexto de aviso e evitar erros com schema do tenant.
        """
        from django.contrib.admin.utils import unquote
        
        obj = self.get_object(request, unquote(object_id))
        
        if obj is None:
            raise self.model.DoesNotExist
        
        if not self.has_delete_permission(request, obj):
            raise PermissionDenied
        
        if not request.user.is_superuser:
            messages.error(request, 'Apenas superusuários podem excluir tenants.')
            return redirect('admin:tenants_tenant_changelist')
        
        # Adicionar aviso ao contexto (será exibido no template)
        extra_context = extra_context or {}
        warning_html = format_html(
            '<div style="background-color: #f8d7da; border: 3px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">'
            '<h2 style="color: #721c24; margin-top: 0;">⚠️ EXCLUSÃO IRREVERSÍVEL</h2>'
            '<p style="color: #721c24; font-size: 16px; font-weight: bold;">'
            'Você está prestes a excluir o tenant <strong>"{name}"</strong> (schema: <strong>{schema}</strong>)'
            '</p>'
            '<p style="color: #721c24; font-size: 14px;">'
            'Esta ação irá remover <strong>PERMANENTEMENTE</strong> e de forma <strong>IRREVERSÍVEL</strong>:'
            '</p>'
            '<ul style="color: #721c24; margin-left: 30px; font-size: 14px;">'
            '<li>Todo o schema do banco de dados e todas as suas tabelas</li>'
            '<li>Todos os usuários vinculados ao tenant</li>'
            '<li>Todas as empresas e filiais</li>'
            '<li>Todos os cadastros (pessoas, produtos, serviços, contas, etc.)</li>'
            '<li>Todos os domínios vinculados</li>'
            '<li>Todas as assinaturas e quotas</li>'
            '<li>Todos os dados financeiros e históricos</li>'
            '</ul>'
            '<div style="background-color: #fff; border: 2px solid #dc3545; padding: 15px; margin-top: 15px; border-radius: 3px;">'
            '<p style="color: #721c24; font-size: 18px; font-weight: bold; text-align: center; margin: 0;">'
            '🚨 <strong>NÃO HÁ COMO RECUPERAR OS DADOS APÓS A EXCLUSÃO!</strong> 🚨'
            '</p>'
            '</div>'
            '<p style="color: #721c24; margin-top: 15px; font-size: 14px;">'
            '<strong>Recomendação:</strong> Faça backup do banco de dados antes de continuar.'
            '</p>'
            '</div>',
            name=obj.name,
            schema=obj.schema_name
        )
        # Usar mark_safe para garantir que o HTML seja renderizado
        extra_context['warning_message'] = mark_safe(warning_html)
        extra_context['tenant_warning'] = mark_safe(warning_html)  # Nome alternativo caso o template use outro nome
        
        # Chamar o método padrão do Django Admin, mas com nosso get_deleted_objects customizado
        return super().delete_view(request, object_id, extra_context)
    
    def save_model(self, request, obj, form, change):
        """
        Sobrescreve save_model para garantir que estamos no schema público ao salvar
        """
        # Garantir que estamos no schema público
        with schema_context('public'):
            super().save_model(request, obj, form, change)
    
    def delete_model(self, request, obj):
        """
        Sobrescreve o método delete_model para usar a mesma lógica de exclusão completa
        """
        if not request.user.is_superuser:
            messages.error(request, 'Apenas superusuários podem excluir tenants.')
            return
        
        schema_name = obj.schema_name
        tenant_name = obj.name
        tenant_id = obj.id  # Salvar ID antes de deletar
        
        # Usar transação atômica para garantir que tudo seja feito ou nada
        # Mas usar savepoints para isolar operações que podem falhar
        try:
            with transaction.atomic():
                # 1. Remover domínios associados
                domains = Domain.objects.filter(tenant=obj)
                domain_count = domains.count()
                domains.delete()
                
                # 2. Cancelar assinatura no Stripe antes de remover (no schema público)
                try:
                    from subscriptions.models import Subscription, QuotaUsage
                    from payments.services import StripeService
                    
                    subscription = Subscription.objects.filter(tenant=obj).first()
                    if subscription and subscription.payment_gateway_id:
                        # Tentar cancelar imediatamente no Stripe (não espera fim do período)
                        try:
                            stripe_service = StripeService()
                            stripe_service.cancel_subscription_immediately(subscription.payment_gateway_id)
                            messages.info(request, f'✅ Assinatura cancelada imediatamente no Stripe para o tenant "{tenant_name}"')
                        except Exception as stripe_error:
                            # Log do erro mas continua com a exclusão
                            messages.warning(request, f'Aviso: Não foi possível cancelar assinatura no Stripe para "{tenant_name}": {str(stripe_error)}')
                    
                    # Remover assinaturas e quotas do banco local
                    Subscription.objects.filter(tenant=obj).delete()
                    QuotaUsage.objects.filter(tenant=obj).delete()
                except Exception as e:
                    messages.warning(request, f'Erro ao remover assinaturas: {str(e)}')
                
                # Remover pagamentos, faturas, métodos de pagamento e outros dados relacionados ao tenant
                try:
                    sid = transaction.savepoint()
                    with connection.cursor() as cursor:
                        # Remover faturas (Invoice) - elas referenciam Payment e Subscription
                        cursor.execute(
                            "DELETE FROM payments_invoice WHERE tenant_id = %s",
                            [tenant_id]
                        )
                        
                        # Remover pagamentos (Payment) - eles referenciam Subscription e PaymentMethod
                        cursor.execute(
                            "DELETE FROM payments_payment WHERE tenant_id = %s",
                            [tenant_id]
                        )
                        
                        # Remover métodos de pagamento (PaymentMethod)
                        cursor.execute(
                            "DELETE FROM payments_paymentmethod WHERE tenant_id = %s",
                            [tenant_id]
                        )
                        
                        # Remover pending signups (se a tabela existir)
                        try:
                            cursor.execute(
                                "DELETE FROM public_pendingsignup WHERE tenant_id = %s",
                                [tenant_id]
                            )
                        except Exception:
                            # Tabela pode não existir, ignorar
                            pass
                    transaction.savepoint_commit(sid)
                except Exception as e:
                    transaction.savepoint_rollback(sid)
                    messages.warning(request, f'Erro ao remover pagamentos: {str(e)}')
                
                # 3. Atualizar perfis de usuário para remover referências a empresas e filiais
                # Isso é necessário porque UserProfile tem ForeignKey para Empresa e Filial
                try:
                    sid = transaction.savepoint()
                    with connection.cursor() as cursor:
                        # Primeiro, atualizar perfis para remover referências a filiais das empresas do tenant
                        cursor.execute("""
                            UPDATE accounts_userprofile 
                            SET current_filial_id = NULL 
                            WHERE current_filial_id IN (
                                SELECT id FROM tenants_filial 
                                WHERE empresa_id IN (
                                    SELECT id FROM tenants_empresa WHERE tenant_id = %s
                                )
                            )
                        """, [tenant_id])
                        
                        # Depois, atualizar perfis para remover referências a empresas do tenant
                        cursor.execute("""
                            UPDATE accounts_userprofile 
                            SET current_empresa_id = NULL 
                            WHERE current_empresa_id IN (
                                SELECT id FROM tenants_empresa WHERE tenant_id = %s
                            )
                        """, [tenant_id])
                    transaction.savepoint_commit(sid)
                except Exception as e:
                    # Fazer rollback do savepoint em caso de erro, mas continuar
                    transaction.savepoint_rollback(sid)
                    messages.warning(request, f'Erro ao atualizar perfis de usuário: {str(e)}')
                
                # 4. Remover empresas e filiais do schema público usando SQL direto
                # Isso é necessário porque Empresa tem ForeignKey para Tenant no schema público
                # Usamos SQL direto para evitar que o Django tente verificar objetos relacionados
                # que podem estar no schema do tenant
                try:
                    sid = transaction.savepoint()
                    with connection.cursor() as cursor:
                        # Primeiro remover filiais (elas referenciam empresas)
                        cursor.execute(
                            "DELETE FROM tenants_filial WHERE empresa_id IN (SELECT id FROM tenants_empresa WHERE tenant_id = %s)",
                            [tenant_id]
                        )
                        filiais_removed = cursor.rowcount
                        
                        # Depois remover empresas
                        cursor.execute(
                            "DELETE FROM tenants_empresa WHERE tenant_id = %s",
                            [tenant_id]
                        )
                        empresas_removed = cursor.rowcount
                    transaction.savepoint_commit(sid)
                except Exception as e:
                    # Fazer rollback do savepoint em caso de erro, mas continuar
                    transaction.savepoint_rollback(sid)
                    messages.warning(request, f'Erro ao remover empresas do schema público: {str(e)}')
                
                # 5. Remover memberships e profiles relacionados usando SQL direto
                # Usamos SQL direto para evitar que o Django tente verificar objetos relacionados
                try:
                    sid = transaction.savepoint()
                    with connection.cursor() as cursor:
                        # Obter IDs dos usuários que têm membership apenas neste tenant
                        cursor.execute("""
                            SELECT user_id FROM accounts_tenantmembership 
                            WHERE tenant_id = %s
                            AND user_id NOT IN (
                                SELECT DISTINCT user_id FROM accounts_tenantmembership 
                                WHERE tenant_id != %s
                            )
                        """, [tenant_id, tenant_id])
                        user_ids_to_delete = [row[0] for row in cursor.fetchall()]
                        
                        # Remover memberships
                        cursor.execute(
                            "DELETE FROM accounts_tenantmembership WHERE tenant_id = %s",
                            [tenant_id]
                        )
                        
                        # Atualizar profiles para remover referência ao tenant
                        cursor.execute(
                            "UPDATE accounts_userprofile SET current_tenant_id = NULL WHERE current_tenant_id = %s",
                            [tenant_id]
                        )
                        
                        # Remover perfis de usuários que não têm mais nenhum membership
                        if user_ids_to_delete:
                            cursor.execute("""
                                DELETE FROM accounts_userprofile 
                                WHERE user_id IN %s
                            """, [tuple(user_ids_to_delete)])
                        
                        # Remover usuários que não têm mais nenhum membership usando SQL direto
                        # Isso evita que o Django tente fazer cascade delete em objetos relacionados
                        # que podem estar em schemas de tenants
                        if user_ids_to_delete:
                            # Primeiro, remover todas as referências relacionadas aos usuários no schema público
                            # 1. Remover permissões do usuário
                            cursor.execute("""
                                DELETE FROM auth_user_user_permissions 
                                WHERE user_id IN %s
                            """, [tuple(user_ids_to_delete)])
                            
                            # 2. Remover grupos do usuário
                            cursor.execute("""
                                DELETE FROM auth_user_groups 
                                WHERE user_id IN %s
                            """, [tuple(user_ids_to_delete)])
                            
                            # 3. Remover sessões do usuário
                            cursor.execute("""
                                DELETE FROM django_session 
                                WHERE session_data LIKE %s
                            """, [f'%"_auth_user_id","{user_ids_to_delete[0]}"%'])
                            
                            # 4. Limpar referências de last_login
                            cursor.execute("""
                                UPDATE auth_user 
                                SET last_login = NULL 
                                WHERE id IN %s
                            """, [tuple(user_ids_to_delete)])
                            
                            # 5. Deletar os usuários diretamente usando SQL
                            cursor.execute("""
                                DELETE FROM auth_user 
                                WHERE id IN %s
                            """, [tuple(user_ids_to_delete)])
                    transaction.savepoint_commit(sid)
                except Exception as e:
                    # Fazer rollback do savepoint em caso de erro, mas continuar
                    transaction.savepoint_rollback(sid)
                    messages.warning(request, f'Erro ao remover memberships: {str(e)}')
                
                # 6. Remover o schema do banco de dados ANTES de deletar o objeto
                # Isso é crítico: o schema deve ser removido antes para evitar que o Django
                # tente verificar objetos relacionados no schema do tenant
                schema_removed = False
                with connection.cursor() as cursor:
                    try:
                        cursor.execute(
                            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                            [schema_name]
                        )
                        if cursor.fetchone():
                            cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                            schema_removed = True
                    except Exception as e:
                        messages.error(request, f'Erro ao remover schema {schema_name}: {str(e)}')
                
                # 7. Remover o tenant diretamente do banco usando SQL
                # Isso evita que o Django tente verificar objetos relacionados
                # que podem estar em schemas que já foram removidos
                with connection.cursor() as cursor:
                    try:
                        cursor.execute(
                            "DELETE FROM tenants_tenant WHERE id = %s",
                            [tenant_id]
                        )
                    except Exception as e:
                        # Se falhar, tentar usar o método delete padrão
                        # mas isso pode falhar se houver referências
                        try:
                            obj.delete()
                        except Exception as delete_error:
                            messages.error(request, f'Erro ao remover tenant do banco: {str(delete_error)}')
                            return
                
                # Mensagem de sucesso personalizada (substitui a mensagem padrão do Django Admin)
                # Usamos messages.set_level para garantir que nossa mensagem seja exibida
                messages.success(
                    request,
                    f'✅ Tenant "{tenant_name}" ({schema_name}) excluído com sucesso! '
                    f'Schema removido: {schema_removed}, Domínios removidos: {domain_count}',
                    extra_tags='safe'  # Permite HTML seguro se necessário
                )
        except Exception as e:
            # Fazer rollback completo em caso de erro
            transaction.rollback()
            messages.error(request, f'Erro ao excluir tenant {tenant_name}: {str(e)}')
    
    def delete_queryset(self, request, queryset):
        """
        Sobrescreve delete_queryset para usar nossa lógica customizada de exclusão
        quando múltiplos tenants são selecionados para exclusão
        """
        if not request.user.is_superuser:
            messages.error(request, 'Apenas superusuários podem excluir tenants.')
            return
        
        # Usar nossa action customizada para exclusão em massa
        self.delete_tenant_completely(request, queryset)
    
    def get_urls(self):
        """Adiciona URLs customizadas para backup"""
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/backup/',
                self.admin_site.admin_view(self.backup_view),
                name='tenants_tenant_backup',
            ),
        ]
        return custom_urls + urls
    
    def backup_view(self, request, object_id):
        """
        View para fazer backup do tenant e fazer download do arquivo
        """
        if not request.user.is_superuser:
            messages.error(request, 'Apenas superusuários podem fazer backup de tenants.')
            return redirect('admin:tenants_tenant_changelist')
        
        try:
            obj = self.get_object(request, object_id)
        except Tenant.DoesNotExist:
            raise Http404
        
        if obj is None:
            raise Http404
        
        try:
            # Criar backup usando o comando de management
            from django.core.management import call_command
            import glob
            
            # Criar arquivo temporário para o backup
            temp_dir = tempfile.gettempdir()
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f'backup_{obj.schema_name}_{timestamp}.zip'
            backup_path = os.path.join(temp_dir, backup_filename)
            
            # Executar comando de backup
            call_command('backup_tenant', obj.schema_name, output_dir=temp_dir)
            
            # Verificar se o arquivo foi criado
            if not os.path.exists(backup_path):
                # Tentar encontrar o arquivo com o nome correto
                pattern = os.path.join(temp_dir, f'backup_{obj.schema_name}_*.zip')
                files = glob.glob(pattern)
                if files:
                    # Pegar o mais recente
                    backup_path = max(files, key=os.path.getctime)
                else:
                    raise FileNotFoundError('Arquivo de backup não foi criado')
            
            # Ler o arquivo e retornar para download
            with open(backup_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = f'attachment; filename="{backup_filename}"'
                response['Content-Length'] = os.path.getsize(backup_path)
            
            # Atualizar data do último backup
            with schema_context('public'):
                obj.last_backup_at = timezone.now()
                obj.save(update_fields=['last_backup_at'])
            
            # Remover arquivo temporário após enviar
            try:
                os.remove(backup_path)
            except:
                pass  # Ignorar erro ao remover arquivo temporário
            
            messages.success(request, f'✅ Backup do tenant "{obj.name}" criado e baixado com sucesso!')
            return response
            
        except Exception as e:
            messages.error(request, f'Erro ao criar backup: {str(e)}')
            import traceback
            traceback.print_exc()
            return redirect('admin:tenants_tenant_change', object_id=object_id)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ('domain', 'tenant', 'is_primary')
    list_filter = ('is_primary', 'tenant')
    search_fields = ('domain', 'tenant__name')


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'tenant', 'is_active', 'created_at')
    list_filter = ('is_active', 'tenant', 'created_at')
    search_fields = ('nome', 'razao_social', 'cnpj', 'tenant__name')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tenant', 'nome', 'razao_social', 'cnpj')
        }),
        ('Endereço', {
            'fields': ('endereco', 'cidade', 'estado', 'cep')
        }),
        ('Contato', {
            'fields': ('telefone', 'email')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(Filial)
class FilialAdmin(admin.ModelAdmin):
    list_display = ('nome', 'codigo_filial', 'empresa', 'is_active', 'created_at')
    list_filter = ('is_active', 'empresa__tenant', 'created_at')
    search_fields = ('nome', 'codigo_filial', 'cnpj', 'empresa__nome')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('empresa', 'nome', 'codigo_filial', 'cnpj')
        }),
        ('Endereço', {
            'fields': ('endereco', 'cidade', 'estado', 'cep')
        }),
        ('Contato', {
            'fields': ('telefone', 'email')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )

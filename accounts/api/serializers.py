"""
Serializers para gerenciamento de usuários do tenant
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django_tenants.utils import schema_context
from accounts.models import UserProfile, TenantMembership
from tenants.models import Tenant

User = get_user_model()


class TenantMembershipSerializer(serializers.ModelSerializer):
    """Serializer para TenantMembership"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    
    class Meta:
        model = TenantMembership
        fields = [
            'id', 'user', 'tenant', 'role', 'role_display', 'is_active', 'joined_at',
            'user_username', 'user_email', 'tenant_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'joined_at', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    """Serializer para User com informações do tenant"""
    profile = serializers.SerializerMethodField()
    membership = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    is_active_membership = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'date_joined', 'last_login',
            'profile', 'membership', 'role', 'is_active_membership'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def get_profile(self, obj):
        """Retorna informações do perfil do usuário no tenant atual"""
        try:
            profile = obj.profile
            tenant = self.context.get('tenant')
            if tenant and profile.current_tenant == tenant:
                return {
                    'phone': profile.phone,
                    'current_tenant_id': profile.current_tenant.id if profile.current_tenant else None,
                    'current_empresa_id': profile.current_empresa.id if profile.current_empresa else None,
                    'current_filial_id': profile.current_filial.id if profile.current_filial else None,
                }
        except UserProfile.DoesNotExist:
            pass
        return None
    
    def get_membership(self, obj):
        """Retorna informações do membership no tenant atual"""
        tenant = self.context.get('tenant')
        if tenant:
            with schema_context('public'):
                membership = TenantMembership.objects.filter(
                    user=obj,
                    tenant=tenant
                ).first()
                if membership:
                    return {
                        'id': membership.id,
                        'role': membership.role,
                        'role_display': membership.get_role_display(),
                        'is_active': membership.is_active,
                        'joined_at': membership.joined_at,
                    }
        return None
    
    def get_role(self, obj):
        """Retorna a role do usuário no tenant atual"""
        membership = self.get_membership(obj)
        return membership.get('role') if membership else None
    
    def get_is_active_membership(self, obj):
        """Retorna se o membership está ativo"""
        membership = self.get_membership(obj)
        return membership.get('is_active') if membership else False


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer para criação de usuário"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    role = serializers.CharField(
        write_only=True,
        required=True,
        max_length=50,
        help_text="Papel do usuário no tenant (roles do sistema: admin, manager, user, viewer ou código de role customizado)"
    )
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'is_active', 'role'
        ]
    
    def validate_role(self, value):
        """Valida se o role é válido (sistema ou customizado)"""
        from accounts.models_roles import CustomRole
        from django.db import connection
        
        # Roles do sistema são sempre válidos
        system_roles = [choice[0] for choice in TenantMembership.ROLE_CHOICES]
        if value in system_roles:
            return value
        
        # Verificar se é um role customizado válido
        tenant = self.context.get('tenant')
        if not tenant:
            try:
                tenant = getattr(connection, 'tenant', None)
            except:
                pass
        
        if tenant:
            try:
                custom_role = CustomRole.objects.get(tenant=tenant, code=value, is_active=True)
                return value
            except CustomRole.DoesNotExist:
                raise serializers.ValidationError(
                    f'Role customizado "{value}" não encontrado ou inativo para este tenant.'
                )
        
        raise serializers.ValidationError(
            f'Role inválido. Use um dos roles do sistema ({", ".join(system_roles)}) ou um código de role customizado válido.'
        )
    
    def validate(self, attrs):
        """Valida se as senhas coincidem"""
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({
                'password_confirm': 'As senhas não coincidem.'
            })
        return attrs
    
    def create(self, validated_data):
        """Cria o usuário e o membership no tenant"""
        password = validated_data.pop('password')
        password_confirm = validated_data.pop('password_confirm')
        role = validated_data.pop('role')
        tenant = self.context.get('tenant')
        
        if not tenant:
            raise serializers.ValidationError('Tenant não identificado')
        
        # Criar usuário no schema público
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            is_active=validated_data.get('is_active', True),
            is_staff=False,
            is_superuser=False,
        )
        
        # Criar usuário no schema do tenant
        with schema_context(tenant.schema_name):
            User.objects.create_user(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=password,
                first_name=validated_data.get('first_name', ''),
                last_name=validated_data.get('last_name', ''),
                is_active=validated_data.get('is_active', True),
                is_staff=False,
                is_superuser=False,
            )
        
        # Criar ou atualizar UserProfile
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={'current_tenant': tenant}
        )
        if not created:
            profile.current_tenant = tenant
            profile.save()
        
        # Criar TenantMembership
        with schema_context('public'):
            membership, created = TenantMembership.objects.get_or_create(
                user=user,
                tenant=tenant,
                defaults={
                    'role': role,
                    'is_active': True,
                }
            )
            if not created:
                membership.role = role
                membership.is_active = True
                membership.save()
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualização de usuário"""
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=False)
    role = serializers.CharField(
        write_only=True,
        required=False,
        max_length=50,
        help_text="Papel do usuário no tenant (roles do sistema: admin, manager, user, viewer ou código de role customizado)"
    )
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'is_active', 'role'
        ]
    
    def validate_role(self, value):
        """Valida se o role é válido (sistema ou customizado)"""
        if not value:
            return value  # Role é opcional na atualização
            
        from accounts.models_roles import CustomRole
        from django.db import connection
        
        # Roles do sistema são sempre válidos
        system_roles = [choice[0] for choice in TenantMembership.ROLE_CHOICES]
        if value in system_roles:
            return value
        
        # Verificar se é um role customizado válido
        tenant = self.context.get('tenant')
        if not tenant:
            try:
                tenant = getattr(connection, 'tenant', None)
            except:
                pass
        
        if tenant:
            try:
                custom_role = CustomRole.objects.get(tenant=tenant, code=value, is_active=True)
                return value
            except CustomRole.DoesNotExist:
                raise serializers.ValidationError(
                    f'Role customizado "{value}" não encontrado ou inativo para este tenant.'
                )
        
        raise serializers.ValidationError(
            f'Role inválido. Use um dos roles do sistema ({", ".join(system_roles)}) ou um código de role customizado válido.'
        )
    
    def validate(self, attrs):
        """Valida se as senhas coincidem quando fornecidas"""
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        
        if password and password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError({
                    'password_confirm': 'As senhas não coincidem.'
                })
        elif password and not password_confirm:
            raise serializers.ValidationError({
                'password_confirm': 'Confirme a senha.'
            })
        elif password_confirm and not password:
            raise serializers.ValidationError({
                'password': 'Digite a nova senha.'
            })
        
        return attrs
    
    def update(self, instance, validated_data):
        """Atualiza o usuário e o membership"""
        password = validated_data.pop('password', None)
        password_confirm = validated_data.pop('password_confirm', None)
        role = validated_data.pop('role', None)
        tenant = self.context.get('tenant')
        
        # Atualizar campos básicos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Atualizar senha se fornecida
        if password:
            instance.set_password(password)
        
        instance.save()
        
        # Atualizar usuário no schema do tenant também
        if tenant:
            with schema_context(tenant.schema_name):
                try:
                    user_tenant = User.objects.get(username=instance.username)
                    for attr, value in validated_data.items():
                        if attr != 'password':
                            setattr(user_tenant, attr, value)
                    if password:
                        user_tenant.set_password(password)
                    user_tenant.save()
                except User.DoesNotExist:
                    # Se não existir no tenant, criar
                    User.objects.create_user(
                        username=instance.username,
                        email=instance.email,
                        password=password or instance.password,
                        first_name=instance.first_name,
                        last_name=instance.last_name,
                        is_active=instance.is_active,
                        is_staff=False,
                        is_superuser=False,
                    )
        
        # Atualizar role no membership se fornecido
        if role and tenant:
            with schema_context('public'):
                membership = TenantMembership.objects.filter(
                    user=instance,
                    tenant=tenant
                ).first()
                if membership:
                    membership.role = role
                    membership.save()
        
        return instance


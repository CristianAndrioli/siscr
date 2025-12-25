"""
Serializers para gerenciamento de roles e permissões customizados
"""
from rest_framework import serializers
from django.db import transaction
from accounts.models_roles import CustomRole, ModulePermission
from accounts.modules_registry import get_available_modules


class ModulePermissionSerializer(serializers.ModelSerializer):
    """Serializer para permissões de módulo"""
    module_display = serializers.CharField(read_only=True)
    
    class Meta:
        model = ModulePermission
        fields = [
            'id', 'module', 'module_display', 'actions',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_actions(self, value):
        """Valida que as ações são válidas"""
        valid_actions = ['view', 'add', 'change', 'delete', 'export', 'import', 'approve', 'reject', 'manage']
        invalid_actions = [action for action in value if action not in valid_actions]
        if invalid_actions:
            raise serializers.ValidationError(
                f'Ações inválidas: {", ".join(invalid_actions)}. '
                f'Ações válidas: {", ".join(valid_actions)}'
            )
        return value


class CustomRoleSerializer(serializers.ModelSerializer):
    """Serializer para role customizado"""
    module_permissions = ModulePermissionSerializer(many=True, read_only=True)
    permissions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomRole
        fields = [
            'id', 'tenant', 'name', 'code', 'description',
            'is_active', 'is_system', 'module_permissions',
            'permissions_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'is_system', 'created_at', 'updated_at']
    
    def get_permissions_count(self, obj):
        """Retorna o número de permissões configuradas"""
        return obj.module_permissions.count()


class CustomRoleCreateSerializer(serializers.ModelSerializer):
    """Serializer para criação de role com permissões"""
    module_permissions = ModulePermissionSerializer(many=True, required=False)
    
    class Meta:
        model = CustomRole
        fields = [
            'name', 'code', 'description', 'is_active', 'module_permissions'
        ]
    
    def validate_code(self, value):
        """Valida que o código não é um dos roles do sistema"""
        if value in ['admin', 'manager', 'user', 'viewer']:
            raise serializers.ValidationError('Este código é reservado para roles do sistema.')
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        """Cria o role e suas permissões"""
        module_permissions_data = validated_data.pop('module_permissions', [])
        tenant = self.context.get('tenant')
        
        if not tenant:
            raise serializers.ValidationError('Tenant não identificado')
        
        validated_data['tenant'] = tenant
        role = CustomRole.objects.create(**validated_data)
        
        # Criar permissões de módulo
        for perm_data in module_permissions_data:
            module_code = perm_data.get('module')
            module_info = self.context.get('available_modules', {}).get(module_code)
            
            if module_info:
                ModulePermission.objects.create(
                    role=role,
                    module=module_code,
                    module_display=module_info.get('name', module_code),
                    actions=perm_data.get('actions', [])
                )
        
        return role


class CustomRoleUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualização de role com permissões"""
    module_permissions = ModulePermissionSerializer(many=True, required=False)
    
    class Meta:
        model = CustomRole
        fields = [
            'name', 'code', 'description', 'is_active', 'module_permissions'
        ]
    
    def validate_code(self, value):
        """Valida que o código não é um dos roles do sistema"""
        instance = self.instance
        if instance and instance.is_system:
            # Não permitir alterar código de roles do sistema
            if value != instance.code:
                raise serializers.ValidationError('Não é possível alterar o código de roles do sistema.')
        
        if value in ['admin', 'manager', 'user', 'viewer']:
            raise serializers.ValidationError('Este código é reservado para roles do sistema.')
        return value
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Atualiza o role e suas permissões"""
        module_permissions_data = validated_data.pop('module_permissions', None)
        
        # Atualizar campos básicos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Atualizar permissões se fornecidas
        if module_permissions_data is not None:
            # Remover permissões existentes
            instance.module_permissions.all().delete()
            
            # Criar novas permissões
            available_modules = self.context.get('available_modules', {})
            for perm_data in module_permissions_data:
                module_code = perm_data.get('module')
                module_info = available_modules.get(module_code)
                
                if module_info:
                    ModulePermission.objects.create(
                        role=instance,
                        module=module_code,
                        module_display=module_info.get('name', module_code),
                        actions=perm_data.get('actions', [])
                    )
        
        return instance


class AvailableModuleSerializer(serializers.Serializer):
    """Serializer para módulos disponíveis"""
    code = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    actions = serializers.ListField(child=serializers.CharField())
    submodules = serializers.DictField(required=False)


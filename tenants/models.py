"""
Models para Multi-Tenancy
"""
from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Tenant(TenantMixin):
    """
    Model que representa um Tenant (Cliente principal)
    Exemplo: Prefeitura, Holding, Empresa Principal
    """
    # Campos obrigatórios do TenantMixin
    schema_name = models.CharField(max_length=63, unique=True, db_index=True)
    
    # Campos customizados
    name = models.CharField(max_length=100, verbose_name='Nome')
    description = models.TextField(blank=True, null=True, verbose_name='Descrição')
    
    # Configurações
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    # Configurações do Tenant
    auto_create_schema = True
    auto_drop_schema = False
    
    # Para desenvolvimento, permitir acesso sem subdomínio
    # Em produção, usar subdomínios específicos
    is_public = True  # Permite acesso direto sem subdomínio
    
    class Meta:
        verbose_name = 'Tenant'
        verbose_name_plural = 'Tenants'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Domain(DomainMixin):
    """
    Model que representa um domínio/subdomínio para um Tenant
    Exemplo: prefeitura1.siscr.com.br, empresa1.siscr.com.br
    """
    pass
    
    class Meta:
        verbose_name = 'Domínio'
        verbose_name_plural = 'Domínios'


class Empresa(models.Model):
    """
    Model que representa uma Empresa dentro de um Tenant
    Cada Tenant pode ter múltiplas Empresas
    """
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='empresas',
        verbose_name='Tenant'
    )
    
    nome = models.CharField(max_length=255, verbose_name='Nome')
    razao_social = models.CharField(max_length=255, verbose_name='Razão Social')
    cnpj = models.CharField(max_length=18, unique=True, verbose_name='CNPJ')
    
    # Endereço
    endereco = models.TextField(blank=True, null=True, verbose_name='Endereço')
    cidade = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cidade')
    estado = models.CharField(max_length=2, blank=True, null=True, verbose_name='Estado')
    cep = models.CharField(max_length=9, blank=True, null=True, verbose_name='CEP')
    
    # Contato
    telefone = models.CharField(max_length=15, blank=True, null=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Empresa'
        verbose_name_plural = 'Empresas'
        ordering = ['nome']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.nome} ({self.tenant.name})"


class Filial(models.Model):
    """
    Model que representa uma Filial de uma Empresa
    Cada Empresa pode ter múltiplas Filiais
    """
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='filiais',
        verbose_name='Empresa'
    )
    
    nome = models.CharField(max_length=255, verbose_name='Nome')
    codigo_filial = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Código da Filial'
    )
    
    # CNPJ opcional (filiais podem não ter CNPJ próprio)
    cnpj = models.CharField(
        max_length=18,
        blank=True,
        null=True,
        verbose_name='CNPJ'
    )
    
    # Endereço
    endereco = models.TextField(blank=True, null=True, verbose_name='Endereço')
    cidade = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cidade')
    estado = models.CharField(max_length=2, blank=True, null=True, verbose_name='Estado')
    cep = models.CharField(max_length=9, blank=True, null=True, verbose_name='CEP')
    
    # Contato
    telefone = models.CharField(max_length=15, blank=True, null=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Filial'
        verbose_name_plural = 'Filiais'
        ordering = ['empresa', 'nome']
        indexes = [
            models.Index(fields=['empresa', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.nome} - {self.empresa.nome}"

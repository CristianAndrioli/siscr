from django.db import models
from core.base_models import SiscrModelBase


class EmailSettings(SiscrModelBase):
    """
    Configurações de email do sistema
    Armazenado no schema público (shared)
    """
    BACKEND_CHOICES = [
        ('console', 'Console (Desenvolvimento)'),
        ('smtp', 'SMTP'),
        ('file', 'Arquivo'),
    ]
    
    backend = models.CharField(
        max_length=20,
        choices=BACKEND_CHOICES,
        default='console',
        verbose_name='Backend de Email'
    )
    
    # Configurações SMTP
    host = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Servidor SMTP (Host)',
        help_text='Ex: smtp.gmail.com'
    )
    port = models.IntegerField(
        default=587,
        verbose_name='Porta',
        help_text='Porta SMTP (geralmente 587 para TLS ou 465 para SSL)'
    )
    use_tls = models.BooleanField(
        default=True,
        verbose_name='Usar TLS'
    )
    use_ssl = models.BooleanField(
        default=False,
        verbose_name='Usar SSL'
    )
    username = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Usuário/Email'
    )
    password = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Senha',
        help_text='Senha ou App Password do email'
    )
    from_email = models.EmailField(
        max_length=255,
        default='SISCR <noreply@siscr.com.br>',
        verbose_name='Email Remetente',
        help_text='Formato: Nome <email@dominio.com>'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name='Ativo'
    )
    
    class Meta:
        verbose_name = 'Configuração de Email'
        verbose_name_plural = 'Configurações de Email'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Email Settings ({self.get_backend_display()})"
    
    def get_settings_dict(self):
        """Retorna dicionário com configurações para uso no Django"""
        settings = {
            'EMAIL_BACKEND': {
                'console': 'django.core.mail.backends.console.EmailBackend',
                'smtp': 'django.core.mail.backends.smtp.EmailBackend',
                'file': 'django.core.mail.backends.filebased.EmailBackend',
            }.get(self.backend, 'django.core.mail.backends.console.EmailBackend'),
        }
        
        if self.backend == 'smtp':
            settings.update({
                'EMAIL_HOST': self.host or '',
                'EMAIL_PORT': self.port,
                'EMAIL_USE_TLS': self.use_tls,
                'EMAIL_USE_SSL': self.use_ssl,
                'EMAIL_HOST_USER': self.username or '',
                'EMAIL_HOST_PASSWORD': self.password or '',
                'DEFAULT_FROM_EMAIL': self.from_email,
            })
        
        return settings

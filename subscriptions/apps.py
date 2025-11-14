"""
App config para subscriptions
"""
from django.apps import AppConfig


class SubscriptionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'subscriptions'
    
    def ready(self):
        """Importa signals quando app está pronto"""
        import subscriptions.signals  # noqa


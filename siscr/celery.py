"""
Configuração do Celery para tarefas assíncronas
"""
import os
from celery import Celery
from django.conf import settings

# Configurar o módulo de settings do Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')

app = Celery('siscr')

# Configurar Celery usando settings do Django
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-descobrir tarefas em todos os apps instalados
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


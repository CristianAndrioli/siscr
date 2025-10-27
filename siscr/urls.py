# C:\siscr\siscr\urls.py

from django.contrib import admin
from django.urls import path, include
# Não deve haver nenhuma importação de 'views' neste arquivo.

urlpatterns = [
    # Rota padrão do painel de administração do Django
    path('admin/', admin.site.urls),
    
    # Inclui todas as rotas definidas no arquivo core/urls.py na raiz do projeto
    path('', include('core.urls')),
]
# C:\siscr\siscr\urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # Rota padrão do painel de administração do Django
    path('admin/', admin.site.urls),
    
    # API Authentication (JWT)
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # API Routes (será expandido)
    path('api/', include('core.api.urls')),
    
    # Inclui todas as rotas definidas no arquivo core/urls.py na raiz do projeto
    path('', include('core.urls')),
]
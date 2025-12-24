# C:\siscr\siscr\urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Rota padrão do painel de administração do Django
    path('admin/', admin.site.urls),
    
    # Swagger/OpenAPI Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API Authentication (JWT)
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # API Routes
    path('api/cadastros/', include('cadastros.api.urls')),
    path('api/', include('core.api.urls')),  # Mantém API geral do core (se houver)
    
    # APIs de autenticação multi-tenant
    path('', include('accounts.urls')),
    
    # APIs públicas (cadastro de novos clientes)
    path('', include('public.urls')),
    
    # APIs auxiliares do core (se necessário)
    path('', include('core.urls')),
]
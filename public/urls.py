"""
URLs públicas (não requerem autenticação)
"""
from django.urls import path
from . import views

app_name = 'public'

urlpatterns = [
    # API pública
    path('api/public/plans/', views.available_plans, name='available_plans'),
    path('api/public/check-domain/', views.check_domain, name='check_domain'),
    path('api/public/signup/', views.signup, name='signup'),
]


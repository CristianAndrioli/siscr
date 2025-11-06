"""
API URLs for core app
"""
from django.urls import path
from . import views

app_name = 'api'

urlpatterns = [
    path('', views.api_root, name='api-root'),
    # API endpoints will be added here
    # Example:
    # path('pessoas/', views.PessoaListView.as_view(), name='pessoa-list'),
]


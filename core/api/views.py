"""
API Views for core app
"""
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_root(request):
    """
    Root endpoint da API
    """
    return Response({
        'message': 'SISCR API',
        'version': '1.0.0',
        'user': request.user.username,
        'endpoints': {
            'auth': '/api/auth/',
            # Add more endpoints as they are created
        }
    })


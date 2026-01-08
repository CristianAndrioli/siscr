"""
Utilitários gerais do core
"""
import logging
from rest_framework.response import Response
from rest_framework import status
from django.db import DatabaseError, IntegrityError
from django.core.exceptions import ValidationError
from django.conf import settings

logger = logging.getLogger(__name__)


def handle_api_error(error, context=None, user_message=None):
    """
    Trata erros de API de forma padronizada
    
    Args:
        error: Exception capturada
        context: Contexto adicional (dict) para logging
        user_message: Mensagem amigável para o usuário (opcional)
    
    Returns:
        Response com erro formatado
    """
    error_type = type(error).__name__
    
    # Log do erro com contexto
    log_message = f"Erro {error_type}: {str(error)}"
    if context:
        log_message += f" | Contexto: {context}"
    logger.error(log_message, exc_info=True)
    
    # Mensagem para o usuário
    if user_message:
        message = user_message
    elif isinstance(error, ValidationError):
        message = "Dados inválidos. Verifique os campos informados."
    elif isinstance(error, IntegrityError):
        message = "Erro de integridade. O registro pode já existir ou ter dependências."
    elif isinstance(error, DatabaseError):
        message = "Erro ao acessar o banco de dados. Tente novamente."
    elif isinstance(error, ValueError):
        message = f"Valor inválido: {str(error)}"
    elif isinstance(error, KeyError):
        message = f"Campo obrigatório não informado: {str(error)}"
    else:
        message = "Ocorreu um erro inesperado. Tente novamente."
    
    # Status HTTP apropriado
    if isinstance(error, ValidationError):
        http_status = status.HTTP_400_BAD_REQUEST
    elif isinstance(error, IntegrityError):
        http_status = status.HTTP_409_CONFLICT
    elif isinstance(error, DatabaseError):
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    return Response(
        {
            'error': message,
            'error_type': error_type,
            'detail': str(error) if settings.DEBUG else None,  # Detalhes apenas em DEBUG
        },
        status=http_status
    )


def validate_required_fields(data, required_fields):
    """
    Valida se campos obrigatórios estão presentes
    
    Args:
        data: Dict com os dados
        required_fields: Lista de campos obrigatórios
    
    Returns:
        Tuple (is_valid, missing_fields, error_response)
    """
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return (
            False,
            missing_fields,
            Response(
                {
                    'error': 'Campos obrigatórios não preenchidos',
                    'missing_fields': missing_fields,
                    'required_fields': required_fields
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        )
    
    return (True, [], None)


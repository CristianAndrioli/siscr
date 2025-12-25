"""
Registry de módulos do sistema
Detecta automaticamente os módulos disponíveis para configuração de permissões
"""
from typing import Dict, List, Optional
from django.apps import apps


class ModuleRegistry:
    """
    Registry centralizado de módulos do sistema
    Permite registrar módulos e suas ações disponíveis
    """
    _modules: Dict[str, Dict] = {}
    
    @classmethod
    def register_module(
        cls,
        code: str,
        name: str,
        description: str = '',
        actions: Optional[List[str]] = None,
        submodules: Optional[Dict[str, str]] = None
    ):
        """
        Registra um módulo no sistema
        
        Args:
            code: Código único do módulo (ex: 'cadastros', 'financeiro')
            name: Nome exibido do módulo (ex: 'Cadastros', 'Financeiro')
            description: Descrição do módulo
            actions: Lista de ações disponíveis (padrão: view, add, change, delete)
            submodules: Dicionário de submódulos {code: name}
        """
        if actions is None:
            actions = ['view', 'add', 'change', 'delete']
        
        cls._modules[code] = {
            'code': code,
            'name': name,
            'description': description,
            'actions': actions,
            'submodules': submodules or {},
        }
    
    @classmethod
    def get_modules(cls) -> Dict[str, Dict]:
        """Retorna todos os módulos registrados"""
        return cls._modules.copy()
    
    @classmethod
    def get_module(cls, code: str) -> Optional[Dict]:
        """Retorna um módulo específico"""
        return cls._modules.get(code)
    
    @classmethod
    def is_module_registered(cls, code: str) -> bool:
        """Verifica se um módulo está registrado"""
        return code in cls._modules


# Registrar módulos padrão do sistema
def register_default_modules():
    """Registra os módulos padrão do sistema"""
    ModuleRegistry.register_module(
        code='cadastros',
        name='Cadastros',
        description='Gerenciamento de pessoas, produtos e serviços',
        actions=['view', 'add', 'change', 'delete', 'export', 'import'],
        submodules={
            'pessoas': 'Pessoas',
            'produtos': 'Produtos',
            'servicos': 'Serviços',
        }
    )
    
    ModuleRegistry.register_module(
        code='financeiro',
        name='Financeiro',
        description='Contas a receber e contas a pagar',
        actions=['view', 'add', 'change', 'delete', 'approve', 'reject', 'export'],
        submodules={
            'contas_receber': 'Contas a Receber',
            'contas_pagar': 'Contas a Pagar',
        }
    )
    
    ModuleRegistry.register_module(
        code='faturamento',
        name='Faturamento',
        description='Cotações, notas fiscais e documentos fiscais',
        actions=['view', 'add', 'change', 'delete', 'approve', 'reject', 'export'],
        submodules={
            'cotacoes': 'Cotações',
            'nfvenda': 'Nota Fiscal de Venda',
            'nfse': 'Nota Fiscal de Serviços',
            'cotacao_cambio': 'Cotação de Câmbio',
        }
    )
    
    ModuleRegistry.register_module(
        code='servico_logistico',
        name='Serviço Logístico',
        description='Serviços logísticos e processos aduaneiros',
        actions=['view', 'add', 'change', 'delete', 'approve', 'manage', 'export'],
        submodules={
            'abertura_mex': 'Abertura MEX',
            'follow_up': 'Follow Up',
            'documentacao': 'Documentação',
            'despacho_aduaneiro': 'Despacho Aduaneiro',
            'assessoria_cambial': 'Assessoria Cambial',
            'assessoria_importacao_exportacao': 'Assessoria Importação/Exportação',
        }
    )
    
    ModuleRegistry.register_module(
        code='monitoramento',
        name='Monitoramento',
        description='Monitoramento de processos e atividades',
        actions=['view', 'export'],
    )
    
    ModuleRegistry.register_module(
        code='configuracoes',
        name='Configurações',
        description='Configurações do sistema e gerenciamento',
        actions=['view', 'manage'],
        submodules={
            'usuarios': 'Usuários',
            'roles': 'Roles e Permissões',
            'empresas': 'Empresas',
            'filiais': 'Filiais',
            'backup': 'Backup',
        }
    )
    
    ModuleRegistry.register_module(
        code='relatorios',
        name='Relatórios',
        description='Relatórios e análises do sistema',
        actions=['view', 'export', 'manage'],
    )


# Registrar módulos padrão ao importar
register_default_modules()


def get_available_modules() -> List[Dict]:
    """
    Retorna lista de módulos disponíveis formatada para API
    """
    modules = ModuleRegistry.get_modules()
    return [
        {
            'code': code,
            'name': info['name'],
            'description': info['description'],
            'actions': info['actions'],
            'submodules': info.get('submodules', {}),
        }
        for code, info in sorted(modules.items())
    ]


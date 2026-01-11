"""
Comando para criar locations de estoque para os tenants existentes
Uso: python manage.py seed_locations
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from tenants.models import Tenant, Empresa, Filial
from estoque.models import Location
import random

CIDADES = [
    ('Florianópolis', 'SC'), ('São Paulo', 'SP'), ('Rio de Janeiro', 'RJ'),
    ('Curitiba', 'PR'), ('Porto Alegre', 'RS'), ('Belo Horizonte', 'MG'),
    ('Brasília', 'DF'), ('Salvador', 'BA'), ('Recife', 'PE'), ('Fortaleza', 'CE'),
]

TIPOS_LOCATION = [
    ('LOJA', 'Loja'),
    ('ALMOXARIFADO', 'Almoxarifado'),
    ('ARMAZEM', 'Armazém'),
    ('CENTRO_DISTRIBUICAO', 'Centro de Distribuição'),
]


class Command(BaseCommand):
    help = 'Cria locations de estoque para todos os tenants existentes'

    def handle(self, *args, **options):
        self.stdout.write("🚀 Iniciando criação de locations de estoque...")
        
        # Buscar todos os tenants ativos
        tenants = Tenant.objects.filter(is_active=True)
        
        if not tenants.exists():
            self.stdout.write(self.style.WARNING("⚠️  Nenhum tenant encontrado!"))
            return
        
        total_locations = 0
        
        for tenant in tenants:
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(f"Processando Tenant: {tenant.name} ({tenant.schema_name})")
            self.stdout.write(f"{'='*60}")
            
            with schema_context(tenant.schema_name):
                # Tentar usar o manager padrão (com filtro de is_deleted)
                # Se falhar (coluna não existe), usar all_objects e apenas campos básicos
                try:
                    empresas = Empresa.objects.filter(is_active=True).only('id', 'nome', 'tenant_id', 'is_active')
                    # Testar se a query funciona fazendo um exists()
                    _ = empresas.exists()
                except Exception:
                    # Se falhar, usar all_objects e apenas campos básicos que sabemos que existem
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Migrações podem não estar aplicadas. Usando fallback..."))
                    try:
                        # Tentar buscar apenas campos básicos que sempre existem
                        empresas = Empresa.all_objects.filter(is_active=True).only('id', 'nome', 'tenant_id', 'is_active')
                    except Exception:
                        # Se ainda falhar, usar values() para buscar apenas campos específicos
                        empresas_ids = list(Empresa.all_objects.filter(is_active=True).values_list('id', flat=True))
                        if not empresas_ids:
                            self.stdout.write(self.style.WARNING(f"  ⚠️  Nenhuma empresa encontrada para {tenant.name}"))
                            continue
                        # Criar queryset mínimo apenas com IDs
                        empresas = Empresa.all_objects.filter(id__in=empresas_ids).only('id', 'nome', 'tenant_id', 'is_active')
                
                if not empresas.exists():
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Nenhuma empresa encontrada para {tenant.name}"))
                    continue
                
                for empresa in empresas:
                    # Mesma lógica para Filial
                    try:
                        filiais = Filial.objects.filter(empresa=empresa, is_active=True).only('id', 'nome', 'codigo_filial', 'empresa_id', 'is_active')
                        _ = filiais.exists()
                    except Exception:
                        try:
                            filiais = Filial.all_objects.filter(empresa=empresa, is_active=True).only('id', 'nome', 'codigo_filial', 'empresa_id', 'is_active')
                        except Exception:
                            filiais_ids = list(Filial.all_objects.filter(empresa=empresa, is_active=True).values_list('id', flat=True))
                            if filiais_ids:
                                filiais = Filial.all_objects.filter(id__in=filiais_ids).only('id', 'nome', 'codigo_filial', 'empresa_id', 'is_active')
                            else:
                                filiais = Filial.all_objects.none()
                    
                    # Sempre criar exatamente 3 locations por empresa
                    self.stdout.write(f"\n  📍 Empresa: {empresa.nome}")
                    
                    # Verificar quantas locations já existem para esta empresa
                    # Usar try/except para lidar com tabela que não existe
                    try:
                        locations_existentes = Location.objects.filter(empresa=empresa).count()
                    except Exception as e:
                        # Se a tabela não existe, pular este tenant
                        self.stdout.write(self.style.WARNING(f"    ⚠️  Tabela de locations não existe neste tenant. Pulando..."))
                        self.stdout.write(self.style.WARNING(f"    Execute migrações: docker-compose exec web python manage.py migrate_schemas --schema={tenant.schema_name}"))
                        continue
                    if locations_existentes >= 3:
                        self.stdout.write(f"    ✅ Já existem {locations_existentes} locations para esta empresa (pulando)")
                        continue
                    
                    num_locations_necessarias = 3 - locations_existentes
                    
                    if filiais.exists():
                        # Se a empresa tem filiais, distribuir as locations entre as filiais
                        self.stdout.write(f"    ({len(filiais)} filiais) - Criando {num_locations_necessarias} location(s)")
                        
                        # Distribuir as locations necessárias entre as filiais de forma equilibrada
                        locations_por_filial = [0] * len(filiais)
                        for i in range(num_locations_necessarias):
                            locations_por_filial[i % len(filiais)] += 1
                        
                        for idx, filial in enumerate(filiais):
                            num_locs = locations_por_filial[idx]
                            if num_locs > 0:
                                locations_criadas = self.criar_locations_para_filial(
                                    empresa, filial, tenant.schema_name, num_locs
                                )
                                total_locations += len(locations_criadas)
                                self.stdout.write(f"    ✅ {len(locations_criadas)} location(s) criada(s) para {filial.nome}")
                    else:
                        # Se a empresa NÃO tem filiais, criar locations diretamente na empresa (filial=None)
                        self.stdout.write(f"    (sem filiais) - Criando {num_locations_necessarias} location(s)")
                        locations_criadas = self.criar_locations_para_empresa(empresa, tenant.schema_name, num_locations_necessarias)
                        total_locations += len(locations_criadas)
                        self.stdout.write(f"    ✅ {len(locations_criadas)} location(s) criada(s) para empresa (sem filial)")
        
        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"✅ Total de {total_locations} locations criadas!"))
        self.stdout.write(f"{'='*60}")

    def criar_locations_para_filial(self, empresa, filial, schema_name, num_locations=1):
        """Cria locations para uma filial específica"""
        cidade, estado = random.choice(CIDADES)
        locations = []
        
        for i in range(num_locations):
            tipo = random.choice(TIPOS_LOCATION)[0]
            codigo = f"{schema_name[:3].upper()}-{empresa.id:02d}-{filial.codigo_filial}-LOC{i+1:02d}"
            
            # Verificar se já existe (com tratamento de erro caso tabela não exista)
            try:
                if Location.objects.filter(codigo=codigo).exists():
                    continue
            except Exception:
                # Se a tabela não existe, não podemos verificar, então continuar para criar
                pass
            
            location = Location.objects.create(
                empresa=empresa,
                filial=filial,
                nome=f"{filial.nome} - {self.get_tipo_nome(tipo)}",
                codigo=codigo,
                tipo=tipo,
                logradouro=f"Rua {random.choice(['das Flores', 'Principal', 'Comercial', 'do Comércio', 'Industrial'])}",
                numero=str(random.randint(100, 9999)),
                letra=random.choice([None, 'A', 'B', 'C']),
                complemento=random.choice([None, 'Galpão 1', 'Sala 101', 'Bloco A']),
                bairro=random.choice(['Centro', 'Comercial', 'Industrial', 'Norte', 'Sul']),
                cidade=cidade,
                estado=estado,
                cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                permite_entrada=True,
                permite_saida=True,
                is_active=True,
            )
            locations.append(location)
        
        return locations

    def criar_locations_para_empresa(self, empresa, schema_name, num_locations=3):
        """Cria locations para uma empresa sem filiais"""
        cidade, estado = random.choice(CIDADES)
        locations = []
        
        for i in range(num_locations):
            tipo = random.choice(TIPOS_LOCATION)[0]
            codigo = f"{schema_name[:3].upper()}-{empresa.id:02d}-EMP-LOC{i+1:02d}"
            
            # Verificar se já existe (com tratamento de erro caso tabela não exista)
            try:
                if Location.objects.filter(codigo=codigo).exists():
                    continue
            except Exception:
                # Se a tabela não existe, não podemos verificar, então continuar para criar
                pass
            
            location = Location.objects.create(
                empresa=empresa,
                filial=None,  # Sem filial
                nome=f"{empresa.nome} - {self.get_tipo_nome(tipo)}",
                codigo=codigo,
                tipo=tipo,
                logradouro=f"Rua {random.choice(['das Flores', 'Principal', 'Comercial', 'do Comércio', 'Industrial'])}",
                numero=str(random.randint(100, 9999)),
                letra=random.choice([None, 'A', 'B', 'C']),
                complemento=random.choice([None, 'Galpão 1', 'Sala 101', 'Bloco A']),
                bairro=random.choice(['Centro', 'Comercial', 'Industrial', 'Norte', 'Sul']),
                cidade=cidade,
                estado=estado,
                cep=f"{random.randint(80000, 89999)}-{random.randint(100, 999)}",
                permite_entrada=True,
                permite_saida=True,
                is_active=True,
            )
            locations.append(location)
        
        return locations

    def get_tipo_nome(self, tipo):
        """Retorna o nome amigável do tipo"""
        tipos_dict = {
            'LOJA': 'Loja',
            'ALMOXARIFADO': 'Almoxarifado',
            'ARMAZEM': 'Armazém',
            'CENTRO_DISTRIBUICAO': 'Centro de Distribuição',
            'ESTOQUE_TERCEIRO': 'Estoque em Terceiros',
            'OUTRO': 'Outro',
        }
        return tipos_dict.get(tipo, tipo)


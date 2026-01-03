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
                empresas = Empresa.objects.filter(is_active=True)
                
                if not empresas.exists():
                    self.stdout.write(self.style.WARNING(f"  ⚠️  Nenhuma empresa encontrada para {tenant.name}"))
                    continue
                
                for empresa in empresas:
                    filiais = Filial.objects.filter(empresa=empresa, is_active=True)
                    
                    # Sempre criar 3 locations por empresa
                    self.stdout.write(f"\n  📍 Empresa: {empresa.nome}")
                    
                    if filiais.exists():
                        # Se a empresa tem filiais, distribuir as 3 locations entre as filiais
                        self.stdout.write(f"    ({len(filiais)} filiais) - Distribuindo 3 locations")
                        
                        # Distribuir as 3 locations entre as filiais
                        locations_por_filial = [0] * len(filiais)
                        for i in range(3):
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
                        # Se a empresa NÃO tem filiais, criar 3 locations diretamente na empresa
                        self.stdout.write(f"    (sem filiais) - Criando 3 locations")
                        locations_criadas = self.criar_locations_para_empresa(empresa, tenant.schema_name)
                        total_locations += len(locations_criadas)
                        self.stdout.write(f"    ✅ {len(locations_criadas)} locations criadas para empresa (sem filial)")
        
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
            
            # Verificar se já existe
            if Location.objects.filter(codigo=codigo).exists():
                continue
            
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

    def criar_locations_para_empresa(self, empresa, schema_name):
        """Cria locations para uma empresa sem filiais"""
        cidade, estado = random.choice(CIDADES)
        locations = []
        
        # Sempre criar exatamente 3 locations para empresa sem filiais
        num_locations = 3
        
        for i in range(num_locations):
            tipo = random.choice(TIPOS_LOCATION)[0]
            codigo = f"{schema_name[:3].upper()}-{empresa.id:02d}-EMP-LOC{i+1:02d}"
            
            # Verificar se já existe
            if Location.objects.filter(codigo=codigo).exists():
                continue
            
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


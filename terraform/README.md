# 🏗️ Infraestrutura como Código - Terraform

Este diretório contém a configuração Terraform para gerenciar a infraestrutura do SISCR SaaS em múltiplos ambientes.

## 📁 Estrutura

```
terraform/
├── modules/
│   └── lightsail/          # Módulo reutilizável para AWS Lightsail
├── environments/
│   ├── qa/                 # Ambiente de QA (Quality Assurance)
│   ├── uat/                # Ambiente de UAT (User Acceptance Testing)
│   └── production/          # Ambiente de PRODUÇÃO
└── README.md
```

## 🎯 Ambientes

### 1. **Localhost** (Desenvolvimento)
- Não gerenciado por Terraform
- Usa Docker Compose local
- Arquivo: `docker-compose.yml` na raiz do projeto

### 2. **QA** (Quality Assurance)
- Instância Lightsail: `nano_2_0` ($3.50/mês)
- Para testes automatizados e validação rápida
- Pode ser criada/destruída frequentemente

### 3. **UAT** (User Acceptance Testing)
- Instância Lightsail: `small_2_0` ($10/mês)
- Ambiente de pré-produção
- Validação final antes de produção

### 4. **Produção**
- Instância Lightsail: `medium_2_0` ($20/mês)
- Ambiente crítico
- Requer aprovação para mudanças

## 🚀 Pré-requisitos

1. **Terraform instalado** (>= 1.5.0)
   ```bash
   # Windows (Chocolatey)
   choco install terraform
   
   # Linux/Mac
   brew install terraform
   # ou
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   ```

2. **AWS CLI configurado**
   ```bash
   aws configure
   # AWS Access Key ID
   # AWS Secret Access Key
   # Default region: sa-east-1
   # Default output format: json
   ```

3. **Par de chaves SSH criado no Lightsail**
   ```bash
   aws lightsail create-key-pair --key-pair-name siscr-keypair
   # Salve a chave privada em ~/.ssh/siscr-keypair.pem
   chmod 400 ~/.ssh/siscr-keypair.pem
   ```

## 📝 Uso Básico

### Inicializar Terraform

```bash
cd terraform/environments/qa
terraform init
```

### Planejar mudanças

```bash
terraform plan
```

### Aplicar mudanças

```bash
terraform apply
```

### Destruir recursos (cuidado!)

```bash
terraform destroy
```

## 🔧 Configuração por Ambiente

### QA

```bash
cd terraform/environments/qa

# 1. Copiar arquivo de exemplo
cp terraform.tfvars.example terraform.tfvars

# 2. Editar terraform.tfvars com seus valores
# aws_key_pair_name = "siscr-keypair"

# 3. Inicializar
terraform init

# 4. Aplicar
terraform apply
```

### UAT

```bash
cd terraform/environments/uat
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars
terraform init
terraform apply
```

### Produção

```bash
cd terraform/environments/production
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars
terraform init
terraform plan  # SEMPRE revisar antes de aplicar!
terraform apply
```

## 🔐 Segurança

### ⚠️ IMPORTANTE

1. **NUNCA commite** arquivos `terraform.tfvars` com valores reais
2. Use `.gitignore` para proteger secrets
3. Para produção, considere usar:
   - AWS Secrets Manager
   - Terraform Cloud
   - Backend remoto (S3) com state encriptado

### Adicionar ao .gitignore

```
terraform/environments/*/terraform.tfvars
terraform/environments/*/.terraform/
terraform/environments/*/.terraform.lock.hcl
*.tfstate
*.tfstate.backup
```

## 📊 Tamanhos de Instância Lightsail

| Bundle ID | Custo/mês | RAM | vCPU | SSD | Uso Recomendado |
|-----------|-----------|-----|------|-----|-----------------|
| `nano_2_0` | $3.50 | 512MB | 1 | 20GB | QA |
| `micro_2_0` | $5 | 1GB | 1 | 40GB | Dev |
| `small_2_0` | $10 | 2GB | 1 | 60GB | UAT |
| `medium_2_0` | $20 | 4GB | 2 | 80GB | Produção |

## 🔄 Workflow Recomendado

1. **Desenvolvimento Local**
   - Usar Docker Compose
   - Testar mudanças localmente

2. **QA**
   - Push para branch `develop`
   - GitHub Actions executa testes
   - Deploy automático para QA (opcional)

3. **UAT**
   - Merge para branch `staging`
   - Deploy manual para UAT
   - Validação com stakeholders

4. **Produção**
   - Merge para branch `main`
   - Revisão de código
   - Deploy manual para produção
   - Monitoramento

## 🛠️ Comandos Úteis

### Ver outputs

```bash
terraform output
```

### Ver state

```bash
terraform show
```

### Validar configuração

```bash
terraform validate
```

### Formatar arquivos

```bash
terraform fmt -recursive
```

## 📚 Próximos Passos

- [ ] Configurar backend remoto (S3) para state compartilhado
- [ ] Adicionar módulo para banco de dados (Lightsail DB ou RDS)
- [ ] Configurar DNS (Route 53)
- [ ] Adicionar SSL/TLS (Let's Encrypt)
- [ ] Configurar backup automatizado
- [ ] Adicionar monitoramento (CloudWatch)

## 🆘 Troubleshooting

### Erro: "Key pair not found"
- Certifique-se de criar o key pair no Lightsail antes de usar
- Verifique o nome do key pair em `terraform.tfvars`

### Erro: "Instance name already exists"
- Lightsail requer nomes únicos
- Altere o `instance_name` no arquivo de configuração

### Erro: "Region not available"
- Verifique se a região `sa-east-1` está disponível na sua conta AWS
- Algumas contas novas podem ter restrições de região

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação oficial do Terraform
2. Consulte a documentação do AWS Lightsail
3. Revise os logs: `terraform plan -detailed-exitcode`


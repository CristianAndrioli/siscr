# 🏗️ Guia de Configuração Terraform

Este guia explica como configurar e usar o Terraform para gerenciar a infraestrutura do SISCR SaaS.

## 📋 Visão Geral

O Terraform gerencia 3 ambientes cloud:
- **QA**: Ambiente de testes ($3.50/mês)
- **UAT**: Ambiente de pré-produção ($10/mês)
- **Produção**: Ambiente crítico ($20/mês)

O ambiente **localhost** usa Docker Compose e não é gerenciado pelo Terraform.

## 🚀 Configuração Inicial

### 1. Instalar Terraform

**Windows (Chocolatey):**
```powershell
choco install terraform
```

**Windows (Manual):**
1. Baixe de https://www.terraform.io/downloads
2. Extraia e adicione ao PATH

**Linux/Mac:**
```bash
# Homebrew (Mac)
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

Verificar instalação:
```bash
terraform version
```

### 2. Configurar AWS CLI

```bash
aws configure
```

Você precisará de:
- **AWS Access Key ID**: Criar em IAM → Users → Security credentials
- **AWS Secret Access Key**: Gerado junto com a Access Key
- **Default region**: `sa-east-1` (São Paulo)
- **Default output format**: `json`

### 3. Criar Par de Chaves SSH no Lightsail

```bash
aws lightsail create-key-pair --key-pair-name siscr-keypair --region sa-east-1
```

Isso retornará a chave privada. Salve em:
```
~/.ssh/siscr-keypair.pem
```

Definir permissões:
```bash
chmod 400 ~/.ssh/siscr-keypair.pem
```

**Windows (PowerShell):**
```powershell
# Salvar chave em C:\Users\SeuUsuario\.ssh\siscr-keypair.pem
icacls "C:\Users\SeuUsuario\.ssh\siscr-keypair.pem" /inheritance:r
icacls "C:\Users\SeuUsuario\.ssh\siscr-keypair.pem" /grant:r "%username%:R"
```

## 📝 Uso por Ambiente

### Ambiente QA

```bash
cd terraform/environments/qa

# 1. Copiar arquivo de exemplo
cp terraform.tfvars.example terraform.tfvars

# 2. Editar terraform.tfvars
# aws_key_pair_name = "siscr-keypair"

# 3. Inicializar Terraform
terraform init

# 4. Verificar o que será criado
terraform plan

# 5. Aplicar (criar recursos)
terraform apply
```

### Ambiente UAT

```bash
cd terraform/environments/uat
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars
terraform init
terraform plan
terraform apply
```

### Ambiente Produção

```bash
cd terraform/environments/production
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars
terraform init
terraform plan  # SEMPRE revisar cuidadosamente!
terraform apply  # Confirmar manualmente
```

## 🔄 Workflow de Deploy

### 1. Desenvolvimento Local
```bash
# Usar Docker Compose
docker-compose up -d
```

### 2. Testes no GitHub Actions
- Push para `main` ou `develop` executa testes automaticamente
- Verificar: `.github/workflows/tests.yml`

### 3. Deploy para QA
```bash
cd terraform/environments/qa
terraform apply
# Depois, fazer deploy da aplicação via SSH
```

### 4. Deploy para UAT
```bash
cd terraform/environments/uat
terraform apply
# Validar com stakeholders
```

### 5. Deploy para Produção
```bash
cd terraform/environments/production
terraform plan  # Revisar
terraform apply  # Confirmar
```

## 🔐 Segurança

### ⚠️ IMPORTANTE

1. **NUNCA commite** `terraform.tfvars` com valores reais
2. Use apenas `terraform.tfvars.example` no repositório
3. Adicione `terraform.tfvars` ao `.gitignore` (já está configurado)

### Proteger Secrets

Para produção, considere usar:
- **AWS Secrets Manager** para senhas
- **Terraform Cloud** para state remoto
- **Backend S3** com encriptação para state

## 📊 Comandos Úteis

### Ver informações da instância
```bash
terraform output
```

### Ver estado atual
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

### Destruir recursos (cuidado!)
```bash
terraform destroy
```

## 🛠️ Conectar via SSH

Após criar a instância:

```bash
# Obter IP público
cd terraform/environments/qa
terraform output qa_instance_ip

# Conectar
ssh -i ~/.ssh/siscr-keypair.pem ubuntu@<IP_PUBLICO>
```

**Windows (PowerShell):**
```powershell
ssh -i C:\Users\SeuUsuario\.ssh\siscr-keypair.pem ubuntu@<IP_PUBLICO>
```

## 📦 Próximos Passos

Após criar as instâncias, você precisará:

1. **Instalar Docker** na instância Lightsail
2. **Configurar Nginx** como reverse proxy
3. **Configurar SSL** (Let's Encrypt)
4. **Configurar DNS** (Route 53 ou outro)
5. **Configurar backup** automatizado
6. **Configurar monitoramento** (CloudWatch)

## 🆘 Troubleshooting

### Erro: "Key pair not found"
- Certifique-se de criar o key pair no Lightsail primeiro
- Verifique o nome em `terraform.tfvars`

### Erro: "Instance name already exists"
- Lightsail requer nomes únicos globalmente
- Altere o `instance_name` na configuração

### Erro: "Region not available"
- Verifique se `sa-east-1` está disponível na sua conta
- Contas novas podem ter restrições

### Erro: "Access Denied"
- Verifique as permissões da Access Key
- Precisa de permissões para Lightsail

## 📚 Recursos

- [Documentação Terraform](https://www.terraform.io/docs)
- [AWS Lightsail Terraform Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lightsail_instance)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)

## 🔗 Integração com GitHub Actions

O workflow `.github/workflows/tests.yml` executa:
- Testes unitários do Django
- Testes do frontend React
- Linting e formatação

Para adicionar deploy automático, veja a documentação do GitHub Actions.


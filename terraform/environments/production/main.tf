# Configuração do ambiente de PRODUÇÃO
# ⚠️ CUIDADO: Este ambiente gerencia recursos de produção!

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto (RECOMENDADO para produção)
  # backend "s3" {
  #   bucket         = "siscr-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "sa-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock" # Para lock de state
  # }
}

provider "aws" {
  region = "sa-east-1"

  default_tags {
    tags = {
      Environment = "production"
      Project     = "siscr"
      ManagedBy   = "terraform"
      Critical    = "true"
    }
  }
}

# Módulo Lightsail para Produção
module "lightsail_production" {
  source = "../../modules/lightsail"

  environment    = "production"
  instance_name  = "siscr-production"
  bundle_id      = "medium_2_0" # Instância maior para produção ($20/mês)
  availability_zone = "sa-east-1a"
  key_pair_name = var.aws_key_pair_name

  tags = {
    Purpose     = "Production"
    CostCenter   = "Operations"
    Backup       = "required"
    Monitoring   = "required"
  }
}

variable "aws_key_pair_name" {
  description = "Nome do par de chaves SSH criado no AWS Lightsail"
  type        = string
  sensitive   = true
}

# Outputs
output "production_instance_ip" {
  description = "IP público da instância de produção"
  value       = module.lightsail_production.public_ip
  sensitive   = false # IP público não é sensível
}

output "production_instance_name" {
  description = "Nome da instância de produção"
  value       = module.lightsail_production.instance_name
}

output "ssh_command" {
  description = "Comando SSH para conectar na instância (NÃO compartilhar)"
  value       = "ssh -i ~/.ssh/siscr-keypair.pem ${module.lightsail_production.username}@${module.lightsail_production.public_ip}"
  sensitive   = true
}


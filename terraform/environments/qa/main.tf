# Configuração do ambiente QA
# Ambiente de testes automatizados e validação rápida

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto (opcional - usar S3 para state compartilhado)
  # backend "s3" {
  #   bucket = "siscr-terraform-state"
  #   key    = "qa/terraform.tfstate"
  #   region = "sa-east-1"
  # }
}

provider "aws" {
  region = "sa-east-1" # São Paulo

  default_tags {
    tags = {
      Environment = "qa"
      Project     = "siscr"
      ManagedBy   = "terraform"
    }
  }
}

# Módulo Lightsail para QA
module "lightsail_qa" {
  source = "../../modules/lightsail"

  environment    = "qa"
  instance_name  = "siscr-qa-${formatdate("YYYYMMDD", timestamp())}"
  bundle_id      = "nano_2_0" # Instância menor para QA ($3.50/mês)
  availability_zone = "sa-east-1a"
  key_pair_name = var.aws_key_pair_name

  tags = {
    Purpose = "QA Testing"
    CostCenter = "Development"
  }
}

# Variáveis locais
variable "aws_key_pair_name" {
  description = "Nome do par de chaves SSH criado no AWS Lightsail"
  type        = string
  # Criar via: aws lightsail create-key-pair --key-pair-name siscr-keypair
}

# Outputs
output "qa_instance_ip" {
  description = "IP público da instância QA"
  value       = module.lightsail_qa.public_ip
}

output "qa_instance_name" {
  description = "Nome da instância QA"
  value       = module.lightsail_qa.instance_name
}

output "ssh_command" {
  description = "Comando SSH para conectar na instância"
  value       = "ssh -i ~/.ssh/siscr-keypair.pem ${module.lightsail_qa.username}@${module.lightsail_qa.public_ip}"
}


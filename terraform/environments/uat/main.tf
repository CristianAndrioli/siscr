# Configuração do ambiente UAT (User Acceptance Testing)
# Ambiente de pré-produção para validação final antes de produção

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto (opcional)
  # backend "s3" {
  #   bucket = "siscr-terraform-state"
  #   key    = "uat/terraform.tfstate"
  #   region = "sa-east-1"
  # }
}

provider "aws" {
  region = "sa-east-1"

  default_tags {
    tags = {
      Environment = "uat"
      Project     = "siscr"
      ManagedBy   = "terraform"
    }
  }
}

# Módulo Lightsail para UAT
module "lightsail_uat" {
  source = "../../modules/lightsail"

  environment    = "uat"
  instance_name  = "siscr-uat"
  bundle_id      = "small_2_0" # Instância média para UAT ($10/mês)
  availability_zone = "sa-east-1a"
  key_pair_name = var.aws_key_pair_name

  tags = {
    Purpose = "User Acceptance Testing"
    CostCenter = "Quality Assurance"
  }
}

variable "aws_key_pair_name" {
  description = "Nome do par de chaves SSH criado no AWS Lightsail"
  type        = string
}

# Outputs
output "uat_instance_ip" {
  description = "IP público da instância UAT"
  value       = module.lightsail_uat.public_ip
}

output "uat_instance_name" {
  description = "Nome da instância UAT"
  value       = module.lightsail_uat.instance_name
}

output "ssh_command" {
  description = "Comando SSH para conectar na instância"
  value       = "ssh -i ~/.ssh/siscr-keypair.pem ${module.lightsail_uat.username}@${module.lightsail_uat.public_ip}"
}


# Módulo reutilizável para AWS Lightsail
# Usado por todos os ambientes (QA, UAT, Produção)

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variáveis do módulo
variable "environment" {
  description = "Nome do ambiente (qa, uat, production)"
  type        = string
}

variable "instance_name" {
  description = "Nome da instância Lightsail"
  type        = string
}

variable "bundle_id" {
  description = "Bundle ID do Lightsail (tamanho da instância)"
  type        = string
  default     = "nano_2_0" # $3.50/mês - 512MB RAM, 1 vCPU
}

variable "availability_zone" {
  description = "Zona de disponibilidade (sa-east-1a, sa-east-1b, etc.)"
  type        = string
  default     = "sa-east-1a"
}

variable "key_pair_name" {
  description = "Nome do par de chaves SSH"
  type        = string
}

variable "tags" {
  description = "Tags adicionais para os recursos"
  type        = map(string)
  default     = {}
}

# Instância Lightsail
resource "aws_lightsail_instance" "app" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  bundle_id         = var.bundle_id
  blueprint_id      = "ubuntu_22_04" # Ubuntu 22.04 LTS
  key_pair_name     = var.key_pair_name

  tags = merge(
    {
      Environment = var.environment
      Project     = "siscr"
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# IP estático para a instância
resource "aws_lightsail_static_ip" "app" {
  name = "${var.instance_name}-static-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.id
  instance_name  = aws_lightsail_instance.app.id
}

# Security Group (Firewall) - Portas abertas
resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = ["0.0.0.0/0"] # SSH - considerar restringir em produção
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"] # HTTP
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"] # HTTPS
  }
}

# Outputs
output "instance_id" {
  description = "ID da instância Lightsail"
  value       = aws_lightsail_instance.app.id
}

output "instance_name" {
  description = "Nome da instância"
  value       = aws_lightsail_instance.app.name
}

output "public_ip" {
  description = "IP público estático da instância"
  value       = aws_lightsail_static_ip.app.ip_address
}

output "private_ip" {
  description = "IP privado da instância"
  value       = aws_lightsail_instance.app.private_ip_address
}

output "username" {
  description = "Usuário padrão para SSH"
  value       = "ubuntu"
}


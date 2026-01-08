# Variáveis do módulo Lightsail
# Este arquivo documenta todas as variáveis aceitas pelo módulo

variable "environment" {
  description = "Nome do ambiente (qa, uat, production)"
  type        = string
  validation {
    condition     = contains(["qa", "uat", "production"], var.environment)
    error_message = "Environment deve ser: qa, uat ou production"
  }
}

variable "instance_name" {
  description = "Nome da instância Lightsail (deve ser único)"
  type        = string
}

variable "bundle_id" {
  description = "Bundle ID do Lightsail (tamanho da instância)"
  type        = string
  default     = "nano_2_0"
  # Opções comuns:
  # nano_2_0: $3.50/mês - 512MB RAM, 1 vCPU, 20GB SSD
  # micro_2_0: $5/mês - 1GB RAM, 1 vCPU, 40GB SSD
  # small_2_0: $10/mês - 2GB RAM, 1 vCPU, 60GB SSD
  # medium_2_0: $20/mês - 4GB RAM, 2 vCPU, 80GB SSD
}

variable "availability_zone" {
  description = "Zona de disponibilidade AWS (sa-east-1a, sa-east-1b, sa-east-1c)"
  type        = string
  default     = "sa-east-1a"
}

variable "key_pair_name" {
  description = "Nome do par de chaves SSH pré-criado no Lightsail"
  type        = string
}

variable "tags" {
  description = "Tags adicionais para os recursos AWS"
  type        = map(string)
  default     = {}
}


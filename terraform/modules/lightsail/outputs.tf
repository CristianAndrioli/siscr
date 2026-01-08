# Outputs do módulo Lightsail
# Valores que podem ser usados por outros módulos ou pelo root

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
  description = "Usuário padrão para SSH (ubuntu)"
  value       = "ubuntu"
}

output "arn" {
  description = "ARN da instância"
  value       = aws_lightsail_instance.app.arn
}


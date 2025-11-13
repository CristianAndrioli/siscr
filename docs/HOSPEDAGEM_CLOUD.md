# ☁️ Guia de Hospedagem Cloud - SISCR SaaS

## 📊 Análise do Projeto

### Requisitos Técnicos Identificados:
- **Backend**: Django 4.2+ com django-tenants (multi-tenant)
- **Frontend**: React (Vite) - build estático
- **Banco de Dados**: PostgreSQL 15 (com schemas por tenant)
- **Cache/Filas**: Redis (para Celery)
- **Containerização**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Arquivos Estáticos**: Media files (futuro: S3/Cloud Storage)

### Necessidades de Infraestrutura:
1. **Servidor de Aplicação**: Django (WSGI/Gunicorn)
2. **Banco de Dados**: PostgreSQL gerenciado ou em container
3. **Redis**: Para cache e Celery
4. **Web Server**: Nginx (para servir estáticos e proxy reverso)
5. **DNS**: Gerenciamento de domínio
6. **SSL/HTTPS**: Certificado SSL (Let's Encrypt)
7. **Backup**: Automatizado do banco de dados

### Considerações Especiais:
- **Multi-tenant**: Cada tenant tem seu próprio schema PostgreSQL
- **Escalabilidade**: Precisa suportar crescimento de 1 para muitas prefeituras
- **Latência**: Cliente no Brasil → preferir data centers no Brasil
- **Custo**: Barato inicialmente, mas escalável

---

## 🏆 Opções de Hospedagem Comparadas

### 1. 🟢 **AWS (Amazon Web Services)** - RECOMENDADO PARA ESCALABILIDADE

#### Opção A: AWS Lightsail (Mais Simples e Barato)
**Ideal para**: Início do projeto, custo previsível

**Componentes:**
- **Lightsail Instance** (aplicação + banco): $10-20/mês
- **Route 53** (DNS): $0.50/mês por zona
- **Load Balancer** (opcional): $18/mês

**Especificações Sugeridas:**
- **$10/mês**: 2 GB RAM, 1 vCPU, 60 GB SSD, 3 TB transferência
- **$20/mês**: 4 GB RAM, 2 vCPU, 80 GB SSD, 4 TB transferência

**Vantagens:**
- ✅ Preço fixo e previsível
- ✅ Data center em São Paulo (sa-east-1)
- ✅ Fácil de configurar
- ✅ Inclui snapshot automático
- ✅ Suporte a Docker

**Desvantagens:**
- ⚠️ Menos flexível que EC2
- ⚠️ PostgreSQL precisa rodar na mesma instância (ou usar RDS separado)

**Custo Estimado Inicial**: **~R$ 50-100/mês** (USD 10-20 + DNS)

**Custo Estimado Escalado (10 tenants)**: **~R$ 200-400/mês**

---

#### Opção B: AWS EC2 + RDS (Mais Flexível)
**Ideal para**: Controle total e escalabilidade máxima

**Componentes Necessários:**
- **EC2 t3.small** (aplicação): ~$15/mês (2 vCPU, 2 GB RAM)
- **RDS db.t3.micro** (PostgreSQL): ~$12/mês (2 vCPU, 1 GB RAM, 20 GB)
- **Route 53** (DNS): $0.50/mês
- **S3** (arquivos estáticos): ~$1-5/mês
- **Elastic IP**: Gratuito se usado

**Vantagens:**
- ✅ Máxima flexibilidade
- ✅ Banco gerenciado (backups automáticos)
- ✅ Escalável horizontalmente
- ✅ Data center em São Paulo
- ✅ Integração com CI/CD (CodePipeline)

**Desvantagens:**
- ⚠️ Mais complexo de configurar
- ⚠️ Custos podem variar (pay-as-you-go)
- ⚠️ Requer mais conhecimento técnico

**Custo Estimado Inicial**: **~R$ 150-200/mês**

**Custo Estimado Escalado (10 tenants)**: **~R$ 400-800/mês**

---

#### Opção C: AWS Elastic Beanstalk (PaaS Simplificado)
**Ideal para**: Deploy automatizado, menos gerenciamento

**Componentes:**
- **Elastic Beanstalk**: Gratuito (paga apenas recursos)
- **EC2** (gerenciado): ~$15-30/mês
- **RDS**: ~$12-25/mês
- **Route 53**: $0.50/mês

**Vantagens:**
- ✅ Deploy automatizado
- ✅ Auto-scaling configurável
- ✅ Health monitoring
- ✅ Integração com GitHub Actions

**Desvantagens:**
- ⚠️ Menos controle sobre configuração
- ⚠️ Pode ser mais caro que Lightsail

**Custo Estimado Inicial**: **~R$ 150-250/mês**

---

### 2. 🔵 **DigitalOcean** - BOA ALTERNATIVA

**Ideal para**: Simplicidade, preço justo, boa documentação

**Componentes:**
- **Droplet** (aplicação): $12-24/mês
- **Managed PostgreSQL**: $15/mês (1 GB RAM, 1 vCPU, 10 GB)
- **Managed Redis**: $15/mês (1 GB)
- **Spaces** (S3-like): $5/mês (250 GB)
- **DNS**: Gratuito

**Especificações Sugeridas:**
- **Droplet $12/mês**: 2 GB RAM, 1 vCPU, 50 GB SSD, 2 TB transferência
- **Droplet $24/mês**: 4 GB RAM, 2 vCPU, 80 GB SSD, 4 TB transferência

**Vantagens:**
- ✅ Preço fixo e transparente
- ✅ Data center em São Paulo (planejado) - atualmente NYC
- ✅ Documentação excelente
- ✅ App Platform (PaaS) disponível
- ✅ Suporte a Docker
- ✅ CI/CD integrado

**Desvantagens:**
- ⚠️ Data center mais próximo é NYC (latência ~100-150ms)
- ⚠️ Menos serviços que AWS

**Custo Estimado Inicial**: **~R$ 200-250/mês**

**Custo Estimado Escalado**: **~R$ 400-600/mês**

---

### 3. 🟡 **Railway** - MAIS SIMPLES PARA INÍCIO

**Ideal para**: Prototipagem rápida, deploy em minutos

**Componentes:**
- **Railway Hobby**: $5/mês + uso
- **PostgreSQL**: Incluído ou $5/mês
- **Redis**: $5/mês

**Vantagens:**
- ✅ Deploy automático do GitHub
- ✅ Muito simples de usar
- ✅ Preço baixo inicial
- ✅ Suporte a Docker
- ✅ SSL automático

**Desvantagens:**
- ⚠️ Data centers nos EUA (latência)
- ⚠️ Menos controle
- ⚠️ Pode ficar caro com escala
- ⚠️ Limites de recursos no plano básico

**Custo Estimado Inicial**: **~R$ 50-100/mês**

**Custo Estimado Escalado**: **~R$ 300-500/mês**

---

### 4. 🟣 **Render** - SIMILAR AO RAILWAY

**Ideal para**: Deploy simples, bom para começar

**Componentes:**
- **Web Service**: $7/mês (512 MB RAM)
- **PostgreSQL**: $7/mês (1 GB)
- **Redis**: $7/mês (25 MB)

**Vantagens:**
- ✅ Deploy automático do GitHub
- ✅ SSL automático
- ✅ Simples de configurar

**Desvantagens:**
- ⚠️ Data centers nos EUA
- ⚠️ Recursos limitados no plano básico
- ⚠️ Pode ficar caro com escala

**Custo Estimado Inicial**: **~R$ 100-150/mês**

---

### 5. 🟠 **Google Cloud Platform (GCP)**

**Ideal para**: Quem já usa Google Workspace, integração com outros serviços Google

**Componentes:**
- **Cloud Run** (container): Pay-per-use (~$10-20/mês)
- **Cloud SQL PostgreSQL**: ~$25/mês (db-f1-micro)
- **Cloud DNS**: $0.20/mês por zona
- **Cloud Storage**: ~$1-5/mês

**Vantagens:**
- ✅ Data center em São Paulo
- ✅ Cloud Run escala automaticamente
- ✅ Pay-per-use pode ser barato inicialmente

**Desvantagens:**
- ⚠️ Mais complexo que Railway/Render
- ⚠️ Custos podem variar muito
- ⚠️ Curva de aprendizado

**Custo Estimado Inicial**: **~R$ 150-250/mês**

---

### 6. 🔴 **Microsoft Azure**

**Ideal para**: Empresas que já usam Microsoft, integração com Office 365

**Componentes:**
- **App Service**: ~$13/mês (B1 Basic)
- **Azure Database PostgreSQL**: ~$25/mês (Basic)
- **Azure DNS**: $0.50/mês por zona

**Vantagens:**
- ✅ Data center no Brasil (São Paulo)
- ✅ Integração com ferramentas Microsoft
- ✅ App Service simplificado

**Desvantagens:**
- ⚠️ Geralmente mais caro que AWS/GCP
- ⚠️ Interface pode ser confusa

**Custo Estimado Inicial**: **~R$ 200-300/mês**

---

### 7. 🟢 **Vultr** - ALTERNATIVA ECONÔMICA

**Ideal para**: Custo baixo, performance boa

**Componentes:**
- **VPS**: $6-12/mês
- **PostgreSQL**: Rodar na mesma VPS ou separado
- **DNS**: Gratuito

**Especificações:**
- **$6/mês**: 1 GB RAM, 1 vCPU, 25 GB SSD
- **$12/mês**: 2 GB RAM, 1 vCPU, 55 GB SSD

**Vantagens:**
- ✅ Muito barato
- ✅ Data center em São Paulo
- ✅ Performance boa
- ✅ Suporte a Docker

**Desvantagens:**
- ⚠️ Você gerencia tudo (sem serviços gerenciados)
- ⚠️ Menos recursos que AWS/GCP
- ⚠️ Backup manual

**Custo Estimado Inicial**: **~R$ 50-100/mês**

---

### 8. 🇧🇷 **Provedores Brasileiros**

#### HomeHost / Brasil Cloud / SaveinCloud
**Ideal para**: Suporte em português, pagamento em R$

**Componentes:**
- **VPS**: R$ 30-80/mês
- **PostgreSQL**: Incluído ou separado

**Vantagens:**
- ✅ Suporte em português
- ✅ Pagamento em R$ (sem IOF)
- ✅ Data center no Brasil
- ✅ Atendimento local

**Desvantagens:**
- ⚠️ Menos recursos que grandes clouds
- ⚠️ Escalabilidade limitada
- ⚠️ Menos integrações
- ⚠️ Pode ser difícil migrar depois

**Custo Estimado Inicial**: **~R$ 50-150/mês**

---

## 📊 Comparação Rápida

| Provedor | Custo Inicial | Escalabilidade | Data Center BR | Complexidade | Recomendação |
|----------|---------------|----------------|----------------|--------------|--------------|
| **AWS Lightsail** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Sim | ⭐⭐⭐ | 🏆 **MELHOR CUSTO/BENEFÍCIO** |
| **AWS EC2+RDS** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Sim | ⭐⭐ | 🏆 **MELHOR ESCALABILIDADE** |
| **DigitalOcean** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Planejado | ⭐⭐⭐ | ✅ **BOA ALTERNATIVA** |
| **Railway** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Não | ⭐⭐⭐⭐⭐ | ✅ **MAIS FÁCIL** |
| **Vultr** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Sim | ⭐⭐⭐ | ✅ **MAIS BARATO** |
| **GCP** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Sim | ⭐⭐ | ⚠️ **COMPLEXO** |
| **Azure** | ⭐⭐ | ⭐⭐⭐⭐ | ✅ Sim | ⭐⭐ | ⚠️ **CARO** |
| **Brasileiros** | ⭐⭐⭐⭐ | ⭐⭐ | ✅ Sim | ⭐⭐⭐ | ⚠️ **LIMITADO** |

---

## 🎯 Recomendações por Cenário

### 🟢 **CENÁRIO 1: Início com 1 Cliente (Orçamento Apertado)**
**Recomendação**: **AWS Lightsail $10/mês** ou **Vultr $6/mês**

**Por quê:**
- Custo baixo e previsível
- Data center em São Paulo (baixa latência)
- Fácil de configurar
- Pode escalar depois

**Setup:**
- 1 instância Lightsail/Vultr rodando Docker Compose
- PostgreSQL e Redis na mesma instância
- Nginx como reverse proxy
- Let's Encrypt para SSL

**Custo Total**: **~R$ 50-80/mês**

---

### 🟡 **CENÁRIO 2: Crescimento (3-5 Clientes)**
**Recomendação**: **AWS EC2 + RDS** ou **DigitalOcean Droplet + Managed DB**

**Por quê:**
- Banco gerenciado (backups automáticos)
- Melhor performance
- Mais recursos

**Setup:**
- EC2 t3.small (aplicação)
- RDS db.t3.micro (PostgreSQL)
- ElastiCache Redis (ou Redis na EC2)
- S3 para arquivos estáticos

**Custo Total**: **~R$ 200-300/mês**

---

### 🔴 **CENÁRIO 3: Escala (10+ Clientes)**
**Recomendação**: **AWS EC2 + RDS + Auto Scaling** ou **AWS Elastic Beanstalk**

**Por quê:**
- Auto-scaling automático
- Load balancer
- Alta disponibilidade
- Monitoramento avançado

**Setup:**
- Múltiplas instâncias EC2 (auto-scaling)
- RDS Multi-AZ (alta disponibilidade)
- ElastiCache Redis
- CloudFront (CDN)
- S3 + CloudFront para estáticos

**Custo Total**: **~R$ 500-1000/mês**

---

## 🚀 Setup Recomendado para Início (AWS Lightsail)

### Componentes Necessários:

1. **Lightsail Instance** ($10/mês)
   - 2 GB RAM, 1 vCPU, 60 GB SSD
   - Ubuntu 22.04 LTS
   - Docker + Docker Compose instalados

2. **Route 53** ($0.50/mês)
   - Gerenciamento de DNS
   - Vinculação de domínio

3. **Certificado SSL** (Gratuito)
   - Let's Encrypt via Certbot

### Arquitetura:

```
Internet
   │
   ▼
Route 53 (DNS)
   │
   ▼
Lightsail Instance
   ├── Nginx (Porta 80/443)
   │   ├── Proxy para Django (Porta 8000)
   │   └── Serve arquivos estáticos React
   ├── Django (Gunicorn + WSGI)
   ├── PostgreSQL (Container)
   └── Redis (Container)
```

### Custos Mensais:
- Lightsail: $10 (~R$ 50)
- Route 53: $0.50 (~R$ 2.50)
- **Total: ~R$ 52.50/mês**

---

## 📋 Checklist de Implementação

### Fase 1: Preparação
- [ ] Escolher provedor
- [ ] Criar conta
- [ ] Configurar domínio
- [ ] Configurar DNS

### Fase 2: Infraestrutura
- [ ] Criar instância/servidor
- [ ] Configurar firewall/security groups
- [ ] Instalar Docker
- [ ] Configurar Nginx
- [ ] Configurar SSL (Let's Encrypt)

### Fase 3: Aplicação
- [ ] Configurar variáveis de ambiente
- [ ] Deploy da aplicação
- [ ] Configurar banco de dados
- [ ] Configurar Redis
- [ ] Testar aplicação

### Fase 4: CI/CD
- [ ] Configurar GitHub Actions
- [ ] Criar workflow de deploy
- [ ] Testar pipeline

### Fase 5: Monitoramento
- [ ] Configurar logs
- [ ] Configurar alertas
- [ ] Configurar backup automatizado

---

## 🔧 Configuração de CI/CD (GitHub Actions)

### Exemplo de Workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Lightsail
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/siscr
            git pull origin main
            docker-compose down
            docker-compose build
            docker-compose up -d
            docker-compose exec web python manage.py migrate
            docker-compose exec web python manage.py collectstatic --noinput
```

---

## 💡 Dicas Importantes

### Segurança:
1. **Nunca** commitar `.env` ou secrets
2. Usar variáveis de ambiente
3. Configurar firewall (apenas portas 80, 443, 22)
4. Usar SSH keys (não senhas)
5. Atualizar sistema regularmente

### Performance:
1. Usar Gunicorn (não runserver) em produção
2. Configurar Nginx para servir estáticos
3. Habilitar gzip compression
4. Usar CDN para arquivos estáticos (futuro)

### Backup:
1. Backup diário do banco de dados
2. Backup de arquivos media
3. Testar restauração regularmente
4. Manter múltiplas cópias (7, 30, 90 dias)

### Monitoramento:
1. Configurar logs estruturados
2. Monitorar uso de CPU/RAM
3. Alertas de disco cheio
4. Monitorar uptime

---

## 📞 Próximos Passos

1. **Decidir provedor** baseado no orçamento
2. **Criar conta** e configurar domínio
3. **Preparar Dockerfile** para produção
4. **Configurar Nginx** para servir aplicação
5. **Implementar CI/CD** com GitHub Actions
6. **Configurar backup** automatizado
7. **Testar** em ambiente de staging primeiro

---

**Última atualização**: 2024
**Status**: Análise inicial - aguardando decisão


# Scripts do Projeto SISCR

Este diretório contém scripts utilitários para desenvolvimento, testes e manutenção do projeto.

## 📁 Estrutura

```
scripts/
├── dev/              # Scripts de desenvolvimento
├── database/         # Scripts de banco de dados
├── deployment/       # Scripts de deploy
└── utils/            # Scripts utilitários gerais
```

## 🔧 Scripts Disponíveis

### Desenvolvimento (`dev/`)
- Scripts para desenvolvimento local
- Verificação de configuração
- Criação de dados de teste

### Banco de Dados (`database/`)
- Scripts de migração
- Seed de dados
- Backup e restore

### Deploy (`deployment/`)
- Scripts de deploy
- Configuração de ambiente
- Validação pré-deploy

### Utilitários (`utils/`)
- Scripts auxiliares diversos
- Ferramentas de manutenção

## 📝 Notas

- Scripts Python devem ser executados com `python scripts/...`
- Scripts PowerShell (`.ps1`) são para Windows
- Scripts Batch (`.bat`) são para Windows
- Scripts Shell (`.sh`) são para Linux/Mac

## ⚠️ Aviso

Alguns scripts podem modificar dados do banco. Sempre faça backup antes de executar scripts que alteram dados.


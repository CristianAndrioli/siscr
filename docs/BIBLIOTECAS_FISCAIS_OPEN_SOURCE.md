# 📚 Bibliotecas Open Source para Emissão Fiscal (NFe, NFSe, CTE, NFCE, MDFe)

## 📋 Análise do Projeto SISCR

O **SISCR** é um sistema Django (Python) com frontend React para gestão empresarial, focado em logística e comércio exterior. Atualmente possui:

- ✅ Interface frontend para NFSe e NFVenda (páginas React)
- ✅ Modelos de cadastro (Pessoas, Produtos, Serviços)
- ⚠️ **Ainda não possui integração real com bibliotecas de emissão fiscal**

---

## 🎯 Bibliotecas Open Source Recomendadas (Python)

### 1. **nfelib** ⭐ **RECOMENDADA**

**Características:**
- ✅ Biblioteca Python pura
- ✅ Suporta: **NF-e, NFS-e nacional, CT-e, MDF-e e BP-e**
- ✅ Utiliza `xsdata` para gerar código a partir dos XSDs oficiais da Receita Federal
- ✅ Atualizações automáticas quando novos XSDs são lançados
- ✅ Foco em leitura e gerenciamento de XMLs
- ✅ Simples e confiável

**Instalação:**
```bash
pip install nfelib
```

**Documentação:**
- PyPI: https://pypi.org/project/nfelib/
- Mantida ativamente

**Vantagens:**
- ✅ Atualizações automáticas via XSDs
- ✅ Código gerado automaticamente
- ✅ Fácil integração com Django
- ✅ Suporte completo aos documentos fiscais brasileiros

**Desvantagens:**
- ⚠️ Foca mais em leitura/validação de XMLs do que em emissão completa
- ⚠️ Pode precisar de bibliotecas complementares para assinatura digital

---

### 2. **PyTrustNFe** ⭐ **RECOMENDADA**

**Características:**
- ✅ Biblioteca Python completa para emissão
- ✅ Suporta: **NF-e, NFC-e e NFSe**
- ✅ Suporta múltiplos provedores de NFSe
- ✅ Funcionalidades:
  - Consulta de cadastro por CNPJ
  - Consulta de distribuição de NF-e
  - Envio e recebimento de documentos fiscais
- ✅ Dependências: PyXmlSec, lxml, signxml

**Instalação:**
```bash
pip install PyTrustNFe
```

**Documentação:**
- PyPI: https://pypi.org/project/PyTrustNFe/
- Em constante desenvolvimento

**Vantagens:**
- ✅ Solução completa para emissão
- ✅ Suporte a múltiplos provedores de NFSe
- ✅ Funcionalidades avançadas (consulta, distribuição)
- ✅ Boa para integração direta

**Desvantagens:**
- ⚠️ Pode precisar de configuração adicional para certificados digitais
- ⚠️ Dependências mais complexas (PyXmlSec)

---

### 3. **PyNFe**

**Características:**
- ✅ Interface com webservices de NF-e, NFC-e, NFS-e e MDF-e
- ✅ Facilita comunicação com SEFAZ e prefeituras
- ✅ Emissão e gestão de documentos fiscais

**Instalação:**
```bash
pip install PyNFe
```

**Documentação:**
- PyPI: https://pypi.org/project/PyNFe/

**Vantagens:**
- ✅ Interface direta com webservices
- ✅ Suporte a múltiplos documentos fiscais

**Desvantagens:**
- ⚠️ Menos documentação disponível
- ⚠️ Pode estar menos atualizado

---

## 🔧 Bibliotecas em Outras Linguagens (Alternativas)

### 4. **ACBrLibNFe** (C# / Delphi / Multi-linguagem)

**Características:**
- ✅ Parte do projeto ACBr (Amplo projeto brasileiro)
- ✅ Suporta: **NF-e e NFC-e**
- ✅ Disponível em múltiplas linguagens (C#, Delphi, Python via wrapper)
- ✅ Métodos para consumo de webservices
- ✅ Impressão de documentos

**Documentação:**
- Site: https://projetoacbr.com.br/pro/downloads/acbrlibnfe/
- Projeto muito maduro e amplamente usado no Brasil

**Vantagens:**
- ✅ Projeto muito maduro e confiável
- ✅ Amplamente usado no Brasil
- ✅ Suporte ativo da comunidade
- ✅ Wrappers para Python disponíveis

**Desvantagens:**
- ⚠️ Originalmente em Delphi/C#
- ⚠️ Pode precisar de wrapper para Python puro

---

### 5. **ZeusFiscal** (C#)

**Características:**
- ✅ Biblioteca C# para emissão e impressão
- ✅ Suporta: **NF-e, NFC-e, MDF-e e CT-e**
- ✅ Classes que abstraem complexidade dos XSDs
- ✅ Geração de XML na estrutura exigida

**Documentação:**
- GitHub: https://github.com/Hercules-NET/ZeusFiscal/

**Vantagens:**
- ✅ Boa abstração dos XSDs
- ✅ Suporte a múltiplos documentos

**Desvantagens:**
- ⚠️ C# (não Python nativo)
- ⚠️ Seria necessário wrapper ou integração via API

---

### 6. **OpenAC.Net.NFSe** (C#)

**Características:**
- ✅ Focada em **NFSe** (Nota Fiscal de Serviços)
- ✅ Suporta diversos provedores
- ✅ Emissão e transmissão de NFSe

**Documentação:**
- GitHub: https://github.com/OpenAC-Net/OpenAC.Net.NFSe/

**Vantagens:**
- ✅ Especializada em NFSe
- ✅ Múltiplos provedores

**Desvantagens:**
- ⚠️ Apenas NFSe (não NFe, CTE, etc.)
- ⚠️ C# (não Python nativo)

---

## 🎯 Recomendações para o SISCR

### **Opção 1: nfelib + PyTrustNFe** (Recomendada) ⭐

**Estratégia:**
- Use **nfelib** para geração e validação de XMLs
- Use **PyTrustNFe** para comunicação com webservices e emissão
- Combine as duas para uma solução completa

**Vantagens:**
- ✅ Ambas são Python puro
- ✅ Fácil integração com Django
- ✅ Cobertura completa de funcionalidades
- ✅ Atualizações automáticas via XSDs

**Implementação:**
```python
# Exemplo de integração
from nfelib import nfe
from PyTrustNFe import NFe

# Gerar XML com nfelib
xml_nfe = nfe.generate(...)

# Enviar com PyTrustNFe
nfe_client = NFe(certificado, senha)
resultado = nfe_client.enviar(xml_nfe)
```

---

### **Opção 2: PyTrustNFe Standalone** (Mais Simples)

**Estratégia:**
- Use apenas **PyTrustNFe** para tudo
- Mais simples, mas pode ter limitações

**Vantagens:**
- ✅ Uma única dependência
- ✅ Solução completa em um pacote
- ✅ Menos complexidade

**Desvantagens:**
- ⚠️ Pode não ter todas as funcionalidades de nfelib
- ⚠️ Menos flexibilidade

---

### **Opção 3: ACBr via Wrapper Python** (Alternativa)

**Estratégia:**
- Use ACBr via wrapper Python ou API REST
- Projeto muito maduro e confiável

**Vantagens:**
- ✅ Projeto extremamente maduro
- ✅ Amplamente testado no Brasil
- ✅ Suporte ativo

**Desvantagens:**
- ⚠️ Pode precisar de wrapper ou serviço separado
- ⚠️ Mais complexo de integrar

---

## 📦 Dependências Necessárias

### Para nfelib:
```bash
pip install nfelib xsdata
```

### Para PyTrustNFe:
```bash
pip install PyTrustNFe PyXmlSec lxml signxml
```

### Para ambas (recomendado):
```bash
pip install nfelib PyTrustNFe xsdata PyXmlSec lxml signxml
```

---

## 🔐 Requisitos Adicionais

### Certificado Digital A1 ou A3
- **A1**: Arquivo .pfx/.p12 (mais fácil para automação)
- **A3**: Token/cartão (mais seguro, mas requer hardware)

### Configurações Necessárias:
- Certificado digital válido
- Senha do certificado
- Ambiente (homologação ou produção)
- Código da UF
- Código do município (para NFSe)

---

## 🚀 Próximos Passos para Implementação

### 1. **Criar App Django para Faturamento**
```bash
python manage.py startapp faturamento
```

### 2. **Modelos Django**
- `NotaFiscalEletronica` (NFe)
- `NotaFiscalServico` (NFSe)
- `ConhecimentoTransporte` (CTe)
- `NotaFiscalConsumidor` (NFCe)

### 3. **Serviços de Emissão**
- `NFeService` - Integração com PyTrustNFe/nfelib
- `NFSeService` - Integração com PyTrustNFe
- `CTeService` - Integração com nfelib

### 4. **Tasks Celery**
- Emissão assíncrona de notas fiscais
- Consulta de status
- Retry automático em caso de falha

### 5. **API REST**
- Endpoints para emissão
- Endpoints para consulta
- Endpoints para cancelamento
- Endpoints para download de XML/PDF

---

## 📚 Recursos e Documentação

### nfelib
- PyPI: https://pypi.org/project/nfelib/
- GitHub: (buscar no GitHub)

### PyTrustNFe
- PyPI: https://pypi.org/project/PyTrustNFe/
- GitHub: (buscar no GitHub)

### Documentação Oficial SEFAZ
- Manual de Integração NFe: http://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/fazenda/portal/nfe/biblioteca
- Manual de Integração CTE: http://www.cte.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/fazenda/portal/cte/biblioteca

### Projeto ACBr
- Site: https://projetoacbr.com.br/
- Documentação: https://projetoacbr.com.br/pro/documentacao/

---

## ⚠️ Considerações Importantes

1. **Ambiente de Homologação**: Sempre teste primeiro no ambiente de homologação da SEFAZ
2. **Certificado Digital**: É obrigatório ter certificado digital válido
3. **Atualizações**: As bibliotecas precisam ser atualizadas quando a Receita Federal lança novos XSDs
4. **Validações**: Implemente validações antes de enviar para SEFAZ
5. **Logs**: Mantenha logs detalhados de todas as operações fiscais
6. **Backup**: Faça backup de todos os XMLs emitidos
7. **Contingência**: Implemente estratégias de contingência (offline, etc.)

---

## 🔄 Comparação com UNIMAKE

| Característica | UNIMAKE | nfelib + PyTrustNFe |
|----------------|---------|-------------------|
| **Custo** | Pago (licença) | ✅ Gratuito (open source) |
| **Linguagem** | .NET/C# | ✅ Python (nativo Django) |
| **Suporte** | Comercial | ✅ Comunidade |
| **Atualizações** | Automáticas | ✅ Via pip |
| **Controle** | Limitado | ✅ Total |
| **Customização** | Limitada | ✅ Total |
| **Documentação** | Comercial | ✅ Open source |

---

## 💡 Conclusão

Para o **SISCR** (Django/Python), recomendo:

1. **Começar com PyTrustNFe** para emissão completa
2. **Adicionar nfelib** para geração/validação avançada de XMLs
3. **Implementar em app Django separado** (`faturamento/`)
4. **Usar Celery** para processamento assíncrono
5. **Criar API REST** para integração com frontend React

Essa combinação oferece:
- ✅ Controle total sobre o processo
- ✅ Sem custos de licença
- ✅ Integração nativa com Django
- ✅ Flexibilidade para customizações
- ✅ Atualizações via pip

---

**Última atualização:** Janeiro 2025


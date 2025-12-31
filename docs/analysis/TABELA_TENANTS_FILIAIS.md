# 📊 Tabela: Estrutura de Tenants e Filiais

## Situação Atual (Antes das Modificações)

| Tenant | Schema | Empresas | Filiais por Empresa | Total Filiais | Observação |
|--------|--------|----------|---------------------|---------------|------------|
| **Comércio Simples** | `comercio_simples` | 1 | 1 (Matriz) | 1 | ✅ Tem filial |
| **Grupo Expansão** | `grupo_expansao` | 1 | 2 (Matriz + Filial Norte) | 2 | ✅ Tem filiais |
| **Holding Diversificada** | `holding_diversificada` | 2 | 2 cada (Matriz + Filial) | 4 | ✅ Todas têm filiais |

## Situação Proposta (Após Modificações)

| Tenant | Schema | Empresas | Filiais por Empresa | Total Filiais | Observação |
|--------|--------|----------|---------------------|---------------|------------|
| **Comércio Simples** | `comercio_simples` | 1 | 1 (Matriz) | 1 | ✅ Tem filial |
| **Grupo Expansão** | `grupo_expansao` | 1 | 2 (Matriz + Filial Norte) | 2 | ✅ Tem filiais |
| **Holding Diversificada** | `holding_diversificada` | 2 | **Empresa 1: 2**<br>**Empresa 2: 0** | 2 | ✅ **Empresa 2 SEM filial** |

### Detalhamento da Modificação

**Holding Diversificada:**
- **Tech Solutions Brasil**: 2 filiais (Matriz + Filial) ✅
- **Comércio & Serviços Premium**: **0 filiais** ❌ (modificado para não ter filial)

## 🎯 Objetivo

Garantir que pelo menos uma empresa no seed **não tenha filial**, para testar o comportamento do sistema quando:
- Location é vinculada apenas à empresa (sem filial)
- Estoque é gerenciado sem estrutura de filiais
- Usuários trabalham diretamente com a empresa


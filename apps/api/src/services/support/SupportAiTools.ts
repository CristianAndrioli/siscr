import type { D1Database } from '@cloudflare/workers-types'

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string }

const LIMIT = 8

/**
 * Tools de leitura da nano IA — sempre filtradas pelo tenantId do middleware.
 */
export class SupportAiTools {
  constructor(
    private readonly db: D1Database,
    private readonly tenantId: string,
  ) {}

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const q = typeof args.q === 'string' ? args.q.trim() : ''
    try {
      switch (name) {
        case 'contexto_tenant':
          return { ok: true, data: await this.contextoTenant() }
        case 'buscar_pessoa':
          if (!q) return { ok: false, error: 'Informe q (nome, e-mail ou CPF/CNPJ).' }
          return { ok: true, data: await this.buscarPessoa(q) }
        case 'buscar_pedido':
          if (!q) return { ok: false, error: 'Informe q (número ou trecho).' }
          return { ok: true, data: await this.buscarPedido(q) }
        case 'buscar_nota_fiscal':
          if (!q) return { ok: false, error: 'Informe q (número ou chave).' }
          return { ok: true, data: await this.buscarNotaFiscal(q) }
        case 'buscar_conta_receber':
          if (!q) return { ok: false, error: 'Informe q (descrição ou nome).' }
          return { ok: true, data: await this.buscarContaReceber(q) }
        case 'buscar_produto':
          if (!q) return { ok: false, error: 'Informe q (código ou descrição).' }
          return { ok: true, data: await this.buscarProduto(q) }
        default:
          return { ok: false, error: `Ferramenta desconhecida: ${name}` }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private async contextoTenant() {
    const tenant = await this.db
      .prepare(
        `SELECT t.id, t.slug, t.nome, t.status, t.plan_id, p.nome as plan_nome
         FROM tenants t
         LEFT JOIN plans p ON p.id = t.plan_id
         WHERE t.id = ?`,
      )
      .bind(this.tenantId)
      .first()

    const empresas = await this.db
      .prepare(
        `SELECT id, razao_social, nome_fantasia, cnpj, cidade, uf
         FROM empresas WHERE tenant_id = ? LIMIT 10`,
      )
      .bind(this.tenantId)
      .all()

    const users = await this.db
      .prepare(`SELECT COUNT(*) as n FROM users WHERE tenant_id = ? AND ativo = 1`)
      .bind(this.tenantId)
      .first<{ n: number }>()

    return {
      tenant,
      empresas: empresas.results ?? [],
      usuariosAtivos: users?.n ?? 0,
    }
  }

  private async buscarPessoa(q: string) {
    const like = `%${q}%`
    const { results } = await this.db
      .prepare(
        `SELECT id, nome, tipo, tipo_cadastro, cpf_cnpj, email, telefone, cidade, uf
         FROM pessoas
         WHERE tenant_id = ?
           AND (nome LIKE ? OR email LIKE ? OR cpf_cnpj LIKE ?)
         LIMIT ?`,
      )
      .bind(this.tenantId, like, like, like, LIMIT)
      .all()
    return results ?? []
  }

  private async buscarPedido(q: string) {
    const like = `%${q}%`
    const asNumber = Number(q)
    const { results } = await this.db
      .prepare(
        `SELECT pv.id, pv.numero, pv.status, pv.total, pv.created_at, p.nome as cliente_nome
         FROM pedidos_venda pv
         LEFT JOIN pessoas p ON p.id = pv.cliente_id AND p.tenant_id = pv.tenant_id
         WHERE pv.tenant_id = ?
           AND (CAST(pv.numero AS TEXT) LIKE ? OR p.nome LIKE ? ${Number.isFinite(asNumber) ? 'OR pv.numero = ?' : ''})
         ORDER BY pv.created_at DESC
         LIMIT ?`,
      )
      .bind(
        ...(Number.isFinite(asNumber)
          ? [this.tenantId, like, like, asNumber, LIMIT]
          : [this.tenantId, like, like, LIMIT]),
      )
      .all()
    return results ?? []
  }

  private async buscarNotaFiscal(q: string) {
    const like = `%${q}%`
    const asNumber = Number(q)
    const { results } = await this.db
      .prepare(
        `SELECT id, tipo, numero, serie, chave_acesso, status, valor_total, created_at
         FROM notas_fiscais
         WHERE tenant_id = ?
           AND (CAST(numero AS TEXT) LIKE ? OR chave_acesso LIKE ? ${Number.isFinite(asNumber) ? 'OR numero = ?' : ''})
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(
        ...(Number.isFinite(asNumber)
          ? [this.tenantId, like, like, asNumber, LIMIT]
          : [this.tenantId, like, like, LIMIT]),
      )
      .all()
    return results ?? []
  }

  private async buscarContaReceber(q: string) {
    const like = `%${q}%`
    const { results } = await this.db
      .prepare(
        `SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, p.nome as pessoa_nome
         FROM contas_receber cr
         LEFT JOIN pessoas p ON p.id = cr.pessoa_id AND p.tenant_id = cr.tenant_id
         WHERE cr.tenant_id = ?
           AND (cr.descricao LIKE ? OR p.nome LIKE ?)
         ORDER BY cr.vencimento DESC
         LIMIT ?`,
      )
      .bind(this.tenantId, like, like, LIMIT)
      .all()
    return results ?? []
  }

  private async buscarProduto(q: string) {
    const like = `%${q}%`
    const { results } = await this.db
      .prepare(
        `SELECT pr.id, pr.codigo, pr.descricao, pr.unidade, pr.preco_venda, pr.ativo
         FROM produtos pr
         WHERE pr.tenant_id = ?
           AND (pr.codigo LIKE ? OR pr.descricao LIKE ?)
         LIMIT ?`,
      )
      .bind(this.tenantId, like, like, LIMIT)
      .all()
    return results ?? []
  }
}

export const SUPPORT_AI_TOOL_DEFS = [
  {
    type: 'function' as const,
    function: {
      name: 'contexto_tenant',
      description: 'Retorna dados da empresa contratante: plano, status, CNPJs cadastrados e quantidade de usuários.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_pessoa',
      description: 'Busca clientes, fornecedores ou funcionários por nome, e-mail ou CPF/CNPJ.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string', description: 'Texto de busca' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_pedido',
      description: 'Busca pedidos de venda pelo número ou nome do cliente.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_nota_fiscal',
      description: 'Busca notas fiscais pelo número ou chave de acesso.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_conta_receber',
      description: 'Busca contas a receber por descrição ou nome da pessoa.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos por código ou descrição.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'criar_ticket',
      description:
        'Abre um chamado humano quando você não souber resolver, o usuário pedir um atendente, ou o problema exigir o time SISCR.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Assunto curto do chamado' },
          summary: { type: 'string', description: 'Resumo do que já foi tentado' },
        },
        required: ['subject'],
      },
    },
  },
]

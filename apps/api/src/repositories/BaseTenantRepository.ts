import type { D1Database } from '@cloudflare/workers-types'

/**
 * Base para repositórios que escopam TODA interação com D1 pelo
 * `tenant_id` resolvido no middleware.
 *
 * Como estender
 * -----------------------------------------------------------------
 *   export class PessoaRepository extends BaseTenantRepository {
 *     async findById(id: string) {
 *       return this.prepareTenant(
 *         'SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?',
 *         [id],
 *       ).first()
 *     }
 *     async update(id: string, patch: Partial<PessoaFields>) {
 *       const frag = this.buildUpdateSet(patch, PESSOA_FIELD_MAP)
 *       if (!frag) return
 *       await this.db
 *         .prepare(`UPDATE pessoas SET ${frag.sql} WHERE id = ? AND tenant_id = ?`)
 *         .bind(...frag.values, id, this.tenantId)
 *         .run()
 *     }
 *   }
 *
 * Regras de uso
 * -----------------------------------------------------------------
 * 1) Todo repositório que guarda dados de tenant DEVE herdar desta
 *    classe. Repositórios puramente globais (plans, ncm_catalog) não.
 *
 * 2) TODAS as queries devem conter `tenant_id = ?` no WHERE, mesmo em
 *    subqueries e joins. Use `prepareTenant()` ou monte manualmente.
 *
 * 3) Nunca monte fragmentos de SQL a partir de chaves fornecidas pelo
 *    cliente. Use `buildUpdateSet()` com um FIELD_MAP whitelistado.
 *
 * 4) Aspecto multi-tenant: a convenção é que o construtor já recebe o
 *    `tenantId` do contexto autenticado. O caller NUNCA deve passar um
 *    tenantId derivado do body da requisição.
 */
export abstract class BaseTenantRepository {
  constructor(
    protected readonly db: D1Database,
    protected readonly tenantId: string,
  ) {
    if (!tenantId) {
      throw new Error(
        'BaseTenantRepository instanciado sem tenantId — isso é um bug de chamada.',
      )
    }
  }

  /**
   * Helper que prepara uma query e já faz o `.bind()` com o tenantId
   * como ÚLTIMO parâmetro. A convenção é escrever `... WHERE ... AND
   * tenant_id = ?` e passar o restante dos binds em `values`.
   *
   * Exemplo:
   *   this.prepareTenant(
   *     'SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?',
   *     [id],
   *   )
   */
  protected prepareTenant(
    sql: string,
    values: readonly unknown[] = [],
  ): D1PreparedStatement {
    return this.db.prepare(sql).bind(...values, this.tenantId)
  }

  /**
   * Constrói o fragmento `SET col1 = ?, col2 = ?` a partir de um
   * objeto de patch + mapa de campos permitidos.
   *
   * - Campos fora do `fieldMap` são IGNORADOS silenciosamente (defense
   *   in depth contra atributos extras do body).
   * - Valores `undefined` são pulados; `null` é persistido.
   *
   * Retorna `null` se não houver nenhum campo a atualizar — o caller
   * deve tratar (ex.: HTTP 400).
   */
  protected buildUpdateSet<K extends string>(
    patch: Partial<Record<K, unknown>>,
    fieldMap: Record<K, string>,
  ): { sql: string; values: unknown[] } | null {
    const parts: string[] = []
    const values: unknown[] = []
    for (const [key, column] of Object.entries(fieldMap) as [K, string][]) {
      const v = patch[key]
      if (v === undefined) continue
      parts.push(`${column} = ?`)
      values.push(v)
    }
    if (parts.length === 0) return null
    return { sql: parts.join(', '), values }
  }
}

/**
 * Tipo utilitário re-exportado da lib do runtime — centraliza o import
 * para repositórios derivados.
 */
export type D1PreparedStatement = ReturnType<D1Database['prepare']>

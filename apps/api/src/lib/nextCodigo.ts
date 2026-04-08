/**
 * Gera o próximo código sequencial para tabelas que não usam trigger
 * (ex: produtos e serviços, cujo campo `codigo TEXT NOT NULL` impede inserção de NULL).
 *
 * Para as demais tabelas (pessoas, contas, estoque, locais) o AFTER INSERT TRIGGER
 * do SQLite cuida disso automaticamente — não é necessário chamar esta função.
 *
 * Tabelas permitidas: lista fechada para evitar SQL injection.
 */

const ALLOWED_TABLES = new Set(['produtos', 'servicos'])

export async function nextCodigo(
  db: D1Database,
  tableName: string,
  tenantId: string,
): Promise<string> {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`nextCodigo: tabela '${tableName}' não permitida`)
  }

  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1 AS next
       FROM ${tableName}
       WHERE tenant_id = ?`,
    )
    .bind(tenantId)
    .first<{ next: number }>()

  return String(row?.next ?? 1)
}

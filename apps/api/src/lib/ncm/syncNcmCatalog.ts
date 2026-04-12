import type { D1Database } from '@cloudflare/workers-types'

export const NCM_CLASSIF_JSON_URL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json'

export const NCM_BRASIL_API_URL = 'https://brasilapi.com.br/api/ncm/v1'

const SYNC_USER_AGENT = 'SISCR/1.0 (+https://siscr.com.br; NCM sync)'

export type NcmSyncSource = 'classif' | 'brasilapi'

export type NcmSyncResult = {
  ok: boolean
  skipped?: boolean
  batchId?: string
  rowCount?: number
  sha256?: string
  source: NcmSyncSource
  message: string
  meta?: Record<string, string | undefined>
}

type ClassifRoot = {
  Data_Ultima_Atualizacao_NCM?: string
  Ato?: string
  Nomenclaturas: Array<{
    Codigo: string
    Descricao: string
    Data_Inicio: string
    Data_Fim: string
    Tipo_Ato_Ini?: string
    Numero_Ato_Ini?: string
    Ano_Ato_Ini?: string
  }>
}

type BrasilApiRow = {
  codigo: string
  descricao: string
  data_inicio: string
  data_fim: string
  tipo_ato?: string
  numero_ato?: string
  ano_ato?: string
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/** NF-e usa 8 dígitos; entradas hierárquicas (ex.: "01", "0101.2") ficam sem codigo_8. */
export function toCodigo8(codigoRaw: string): string | null {
  const d = digitsOnly(codigoRaw)
  return d.length === 8 ? d : null
}

/** DD/MM/YYYY → YYYY-MM-DD */
function brDateToIso(s: string): string {
  const t = s.trim()
  if (!t.includes('/')) return t.slice(0, 10)
  const p = t.split('/')
  if (p.length !== 3) return t
  const [dd, mm, yyyy] = p
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`
}

function normalizeApiDate(s: string): string {
  const t = s.trim()
  if (t.includes('/')) return brDateToIso(t)
  return t.slice(0, 10)
}

export async function fetchClassifNcmJson(): Promise<Response> {
  return fetch(NCM_CLASSIF_JSON_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': SYNC_USER_AGENT,
    },
  })
}

export async function fetchBrasilApiNcmJson(): Promise<Response> {
  return fetch(NCM_BRASIL_API_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': SYNC_USER_AGENT,
    },
  })
}

type FlatRow = {
  codigo_raw: string
  codigo_8: string | null
  descricao: string
  vigencia_inicio: string
  vigencia_fim: string
  tipo_ato_ini: string | null
  numero_ato_ini: string | null
  ano_ato_ini: string | null
}

function parseClassif(jsonText: string): { rows: FlatRow[]; meta: Record<string, string | undefined> } {
  const data = JSON.parse(jsonText) as ClassifRoot
  if (!Array.isArray(data.Nomenclaturas)) {
    throw new Error('JSON Classif inválido: falta Nomenclaturas[].')
  }
  const rows: FlatRow[] = data.Nomenclaturas.map((n) => ({
    codigo_raw: n.Codigo,
    codigo_8: toCodigo8(n.Codigo),
    descricao: n.Descricao,
    vigencia_inicio: brDateToIso(n.Data_Inicio),
    vigencia_fim: brDateToIso(n.Data_Fim),
    tipo_ato_ini: n.Tipo_Ato_Ini ?? null,
    numero_ato_ini: n.Numero_Ato_Ini ?? null,
    ano_ato_ini: n.Ano_Ato_Ini ?? null,
  }))
  return {
    rows,
    meta: {
      dataUltima: data.Data_Ultima_Atualizacao_NCM,
      ato: data.Ato,
    },
  }
}

function parseBrasilApi(jsonText: string): { rows: FlatRow[]; meta: Record<string, string | undefined> } {
  const arr = JSON.parse(jsonText) as BrasilApiRow[]
  if (!Array.isArray(arr)) {
    throw new Error('JSON Brasil API inválido: esperado array.')
  }
  const rows: FlatRow[] = arr.map((n) => ({
    codigo_raw: n.codigo,
    codigo_8: toCodigo8(n.codigo),
    descricao: n.descricao,
    vigencia_inicio: normalizeApiDate(n.data_inicio),
    vigencia_fim: normalizeApiDate(n.data_fim),
    tipo_ato_ini: n.tipo_ato != null ? String(n.tipo_ato) : null,
    numero_ato_ini: n.numero_ato != null ? String(n.numero_ato) : null,
    ano_ato_ini: n.ano_ato != null ? String(n.ano_ato) : null,
  }))
  return { rows, meta: { fonte: 'brasilapi.com.br' } }
}

const BATCH_SIZE = 60

/**
 * Importa linhas para D1, ativa o novo batch e remove itens de importações antigas.
 */
export async function persistNcmBatch(
  db: D1Database,
  source: NcmSyncSource,
  rows: FlatRow[],
  sha256: string,
  payloadMeta: Record<string, string | undefined>,
  runId: string,
  force: boolean,
): Promise<{ batchId: string; rowCount: number; skipped: boolean }> {
  if (!force) {
    const prev = await db
      .prepare(
        `SELECT content_sha256 FROM ncm_sync_runs WHERE source = ? AND status = 'ok' ORDER BY started_at DESC LIMIT 1`,
      )
      .bind(source)
      .first<{ content_sha256: string | null }>()
    if (prev?.content_sha256 === sha256) {
      await db
        .prepare(
          `UPDATE ncm_sync_runs SET status = ?, message = ?, content_sha256 = ?, finished_at = ? WHERE id = ?`,
        )
        .bind(
          'ok',
          'Conteúdo idêntico ao último sync — nada alterado.',
          sha256,
          new Date().toISOString(),
          runId,
        )
        .run()
      return { batchId: '', rowCount: 0, skipped: true }
    }
  }

  const batchId = crypto.randomUUID()
  const now = new Date().toISOString()
  const metaJson = JSON.stringify(payloadMeta)

  const insertSql = `INSERT INTO ncm_items
    (id, batch_id, codigo_raw, codigo_8, descricao, vigencia_inicio, vigencia_fim, tipo_ato_ini, numero_ato_ini, ano_ato_ini)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE)
      const stmts = chunk.map((r) =>
        db
          .prepare(insertSql)
          .bind(
            crypto.randomUUID(),
            batchId,
            r.codigo_raw,
            r.codigo_8,
            r.descricao,
            r.vigencia_inicio,
            r.vigencia_fim,
            r.tipo_ato_ini,
            r.numero_ato_ini,
            r.ano_ato_ini,
          ),
      )
      await db.batch(stmts)
    }
  } catch (e) {
    await db.prepare(`DELETE FROM ncm_items WHERE batch_id = ?`).bind(batchId).run()
    throw e
  }

  await db
    .prepare(
      `INSERT INTO ncm_meta (key, value) VALUES ('active_batch_id', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(batchId)
    .run()

  await db.prepare(`DELETE FROM ncm_items WHERE batch_id != ?`).bind(batchId).run()

  await db
    .prepare(
      `UPDATE ncm_sync_runs SET status = ?, row_count = ?, content_sha256 = ?, payload_meta = ?, finished_at = ?, message = ? WHERE id = ?`,
    )
    .bind(
      'ok',
      rows.length,
      sha256,
      metaJson,
      now,
      `Importados ${rows.length} registros (${source === 'classif' ? 'Siscomex' : 'Brasil API'}).`,
      runId,
    )
    .run()

  return { batchId, rowCount: rows.length, skipped: false }
}

export async function runNcmSync(
  db: D1Database,
  source: NcmSyncSource,
  jsonText: string,
  options: { force?: boolean } = {},
): Promise<NcmSyncResult> {
  const runId = crypto.randomUUID()
  const started = new Date().toISOString()
  const force = Boolean(options.force)

  await db
    .prepare(
      `INSERT INTO ncm_sync_runs (id, source, status, message, started_at) VALUES (?, ?, 'running', NULL, ?)`,
    )
    .bind(runId, source, started)
    .run()

  try {
    const sha256 = await sha256Hex(jsonText)
    const parsed = source === 'classif' ? parseClassif(jsonText) : parseBrasilApi(jsonText)
    const { batchId, rowCount, skipped } = await persistNcmBatch(
      db,
      source,
      parsed.rows,
      sha256,
      parsed.meta,
      runId,
      force,
    )

    if (skipped) {
      return {
        ok: true,
        skipped: true,
        source,
        message: 'Arquivo idêntico ao último import bem-sucedido — base não foi alterada.',
        sha256,
        meta: parsed.meta,
      }
    }

    return {
      ok: true,
      batchId,
      rowCount,
      sha256,
      source,
      message: `Tabela NCM atualizada (${rowCount} linhas).`,
      meta: parsed.meta,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .prepare(`UPDATE ncm_sync_runs SET status = ?, message = ?, finished_at = ? WHERE id = ?`)
      .bind('error', msg, new Date().toISOString(), runId)
      .run()
    return { ok: false, source, message: msg }
  }
}

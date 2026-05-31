import type { NfeEntradaParsed } from '../../nfe/parseNfeEntradaXml'
import { normalizarCnpj } from '../../nfe/parseNfeEntradaXml'

/** Valida se o destinatário do XML é a empresa cadastrada (CNPJ). */
export async function assertDestinatarioEhEmpresa(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  destDoc: string,
  destTipo: 'CNPJ' | 'CPF',
): Promise<void> {
  if (destTipo !== 'CNPJ') {
    throw new Error('NF-e com destinatário CPF não pode ser importada como entrada de PJ (use empresa CNPJ).')
  }
  const emp = await db
    .prepare(`SELECT cnpj FROM empresas WHERE id = ? AND tenant_id = ?`)
    .bind(empresaId, tenantId)
    .first<{ cnpj: string }>()
  if (!emp) throw new Error('Empresa não encontrada.')
  if (normalizarCnpj(emp.cnpj) !== normalizarCnpj(destDoc)) {
    throw new Error(
      'O destinatário da NF-e não corresponde ao CNPJ da empresa selecionada. Verifique o XML e a empresa/filial.',
    )
  }
}

/** CNPJ a gravar em `nf_entradas.destinatario_cnpj` (XML ou empresa quando NFC-e sem dest). */
export async function cnpjDestinatarioParaGravacao(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  parsed: NfeEntradaParsed,
): Promise<string> {
  if (!parsed.destinatarioAusente) {
    return parsed.destinatarioDoc
  }
  const emp = await db
    .prepare(`SELECT cnpj FROM empresas WHERE id = ? AND tenant_id = ?`)
    .bind(empresaId, tenantId)
    .first<{ cnpj: string }>()
  if (!emp) throw new Error('Empresa não encontrada.')
  return normalizarCnpj(emp.cnpj)
}

/**
 * Pré-visualização NF-e/NFC-e: XML sem grupo <dest> (NFC-e modelo 65 ou NF-e ao consumidor)
 * permite pré-visualizar — a empresa é confirmada na gravação.
 */
export async function assertPreviewDestinatarioPermitido(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  parsed: NfeEntradaParsed,
): Promise<void> {
  if (parsed.destinatarioAusente) {
    const emp = await db
      .prepare(`SELECT id FROM empresas WHERE id = ? AND tenant_id = ?`)
      .bind(empresaId, tenantId)
      .first<{ id: string }>()
    if (!emp) throw new Error('Empresa não encontrada.')
    return
  }
  await assertDestinatarioEhEmpresa(db, tenantId, empresaId, parsed.destinatarioDoc, parsed.destinatarioTipo)
}

/** Gravação: XML sem dest exige confirmação explícita (`confirmarDestinoEmpresa`). */
export async function assertImportacaoEntradaPermitida(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  parsed: NfeEntradaParsed,
  confirmarDestinoEmpresa: boolean,
): Promise<void> {
  if (parsed.destinatarioAusente) {
    if (!confirmarDestinoEmpresa) {
      const tipo = parsed.modelo === 65 ? 'NFC-e' : 'NF-e'
      throw new Error(
        `Este ${tipo} não identifica o destinatário no XML. Confirme que a compra é da empresa selecionada para continuar.`,
      )
    }
    const emp = await db
      .prepare(`SELECT id FROM empresas WHERE id = ? AND tenant_id = ?`)
      .bind(empresaId, tenantId)
      .first<{ id: string }>()
    if (!emp) throw new Error('Empresa não encontrada.')
    return
  }
  await assertDestinatarioEhEmpresa(db, tenantId, empresaId, parsed.destinatarioDoc, parsed.destinatarioTipo)
}

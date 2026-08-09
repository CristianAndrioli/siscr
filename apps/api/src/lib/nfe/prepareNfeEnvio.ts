import type { Env } from '../../index'
import { montarChaveAcesso, randomCnf8 } from './chaveAcesso'
import { cUfFromSigla } from './ufIbge'
import {
  buildNfeXmlUnsigned,
  type BuildNfeXmlInput,
  type DestinatarioXml,
  type EmitenteXml,
  type ItemXml,
  type IdeXml,
} from './buildNfeXml'
import { formatDhEmiSp } from './formatDhEmi'
import { onlyDigits } from './xmlEscape'
import { decryptA1Bundle } from '../certBlob'
import { signNfeXmlWithA1 } from './signNfeXml'
import { validateNfeBeforeXml } from './validateNfeBeforeXml'
import {
  formatNfeXmlValidationErrors,
  validateNfeXmlDocumento,
} from './validateNfeXmlDocumento'
import {
  ajustarCfopSaida,
  naturezaOperacaoParaDestino,
  resolveIdDest,
  rotuloIdDest,
  type IdDest,
} from './operacaoDestino'

export type PrepareNfeResult = {
  chaveAcesso: string
  xmlPath: string
  xmlBytes: Uint8Array
  devMode: boolean
  /** true quando o XML foi assinado com o A1 do tenant (empresa ou filial). */
  signed: boolean
  message: string
}

function num(v: unknown, d = 0): number {
  if (v == null) return d
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/**
 * Carrega nota + empresa (+ dest/itens), gera chave e XML.
 * Com certificado A1 (R2 + CERT_BLOB_SECRET), assina com XML-DSig (RSA-SHA1).
 * Grava XML no R2. Atualiza D1 (chave, xml_path, data_emissao, campos de transmissão).
 *
 * `devMode`: quando true, permite XML sem certificado; com A1 configurado, assina igual.
 * Fora do modo dev, exige A1 da empresa ou da filial da nota.
 */
export async function prepareNfeEnvio(
  env: Env,
  tenantId: string,
  notaId: string,
  options: { devMode: boolean; force?: boolean },
): Promise<PrepareNfeResult> {
  const db = env.DB_SHARED

  const nota = await db
    .prepare(
      `SELECT * FROM notas_fiscais WHERE id = ? AND tenant_id = ? AND tipo = 'nfe'`,
    )
    .bind(notaId, tenantId)
    .first<Record<string, unknown>>()

  if (!nota) {
    throw new Error('Nota NF-e não encontrada.')
  }

  if (str(nota.status) === 'cancelada') {
    throw new Error('Nota cancelada.')
  }

  if (str(nota.status) === 'emitida') {
    throw new Error(
      'Nota já faturada no ERP (estoque/financeiro). Não é possível gerar ou regerar o XML.',
    )
  }

  if (str(nota.protocolo_autorizacao)) {
    throw new Error('Nota já autorizada pela SEFAZ. Não é possível regerar o XML.')
  }

  if (str(nota.status) === 'autorizada') {
    throw new Error('Nota já autorizada pela SEFAZ. Não é possível regerar o XML.')
  }

  if (str(nota.chave_acesso) && str(nota.xml_path) && !options.force) {
    throw new Error('Nota já possui XML e chave. Use force para regerar.')
  }

  let empresaId = str(nota.empresa_id)
  if (!empresaId) {
    const fallback = await db
      .prepare(`SELECT id FROM empresas WHERE tenant_id = ? ORDER BY created_at LIMIT 1`)
      .bind(tenantId)
      .first<{ id: string }>()
    if (!fallback?.id) {
      throw new Error('Nota sem empresa. Cadastre uma empresa em Configurações ou use o assistente de NF-e.')
    }
    empresaId = fallback.id
    await db
      .prepare(`UPDATE notas_fiscais SET empresa_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
      .bind(empresaId, new Date().toISOString(), notaId, tenantId)
      .run()
  }

  const empresa = await db
    .prepare(`SELECT * FROM empresas WHERE id = ? AND tenant_id = ?`)
    .bind(empresaId, tenantId)
    .first<Record<string, unknown>>()

  if (!empresa) {
    throw new Error('Empresa não encontrada.')
  }

  const filialId = nota.filial_id ? str(nota.filial_id) : ''
  let filial: Record<string, unknown> | null = null
  if (filialId) {
    filial = await db
      .prepare(`SELECT * FROM filiais WHERE id = ? AND tenant_id = ?`)
      .bind(filialId, tenantId)
      .first<Record<string, unknown>>()
  }

  const destId = nota.destinatario_id ? str(nota.destinatario_id) : ''
  let pessoa: Record<string, unknown> | null = null
  if (destId) {
    pessoa = await db
      .prepare(`SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?`)
      .bind(destId, tenantId)
      .first<Record<string, unknown>>()
  }

  const { results: itensRows } = await db
    .prepare(
      `SELECT ni.*, pr.codigo as produto_codigo
       FROM nota_fiscal_itens ni
       LEFT JOIN produtos pr ON pr.id = ni.produto_id
       WHERE ni.nota_fiscal_id = ? ORDER BY ni.created_at`,
    )
    .bind(notaId)
    .all()

  const itensList = (itensRows ?? []) as Record<string, unknown>[]
  if (itensList.length === 0) {
    throw new Error('Nota sem itens.')
  }

  const val = validateNfeBeforeXml({
    empresa,
    filial,
    pessoa,
    itens: itensList,
  })
  if (!val.ok) {
    throw new Error(val.errors.join(' '))
  }

  const cnpjEmit = onlyDigits(str(empresa.cnpj), 14)
  if (cnpjEmit.length !== 14) {
    throw new Error('CNPJ da empresa inválido para NF-e.')
  }

  const cUF = cUfFromSigla(str(empresa.uf))
  const dh = formatDhEmiSp()
  const aamm = dh.slice(2, 4) + dh.slice(5, 7)

  const mod = String(num(nota.modelo, 55)).padStart(2, '0').slice(-2)
  const serie = str(nota.serie) || '1'
  const nNF = String(num(nota.numero, 1))
  const cNF8 = randomCnf8()
  const tpEmis = '1'

  const chave44 = montarChaveAcesso({
    cUF,
    aamm,
    cnpj14: cnpjEmit,
    mod,
    serie,
    nNF,
    tpEmis,
    cNF8,
  })

  const cDV = chave44.slice(-1)

  const codMunFG = onlyDigits(
    str(filial?.codigo_municipio) || str(empresa.codigo_municipio),
    7,
  )
  const cMunFG = codMunFG.length === 7 ? codMunFG : '3550308'

  const emit: EmitenteXml = {
    cnpj: cnpjEmit,
    razaoSocial: str(empresa.razao_social) || 'Emitente',
    nomeFantasia: str(empresa.nome_fantasia) || null,
    ie: str(filial?.inscricao_estadual) || str(empresa.inscricao_estadual) || null,
    crt: str(empresa.crt) || '1',
    logradouro: str(filial?.logradouro) || str(empresa.logradouro),
    numero: str(filial?.numero) || str(empresa.numero),
    complemento: str(filial?.complemento) || str(empresa.complemento),
    bairro: str(filial?.bairro) || str(empresa.bairro),
    codigoMunicipio: str(filial?.codigo_municipio) || str(empresa.codigo_municipio),
    cidade: str(filial?.cidade) || str(empresa.cidade),
    uf: str(filial?.uf) || str(empresa.uf),
    cep: str(filial?.cep) || str(empresa.cep),
  }

  const ufEmitente = str(filial?.uf) || str(empresa.uf)
  const ufDestinatario = pessoa ? str(pessoa.uf) : ''
  const codigoPaisDest = pessoa ? str(pessoa.codigo_pais) || '1058' : '1058'
  const idDest: IdDest = resolveIdDest({
    ufEmitente,
    ufDestinatario,
    codigoPaisDestinatario: codigoPaisDest,
  })
  const natOp = naturezaOperacaoParaDestino(idDest, str(nota.natureza_operacao) || 'Venda')

  let dest: DestinatarioXml | null = null
  if (pessoa) {
    const tipo = str(pessoa.tipo) === 'PF' ? 'PF' : 'PJ'
    const doc = str(pessoa.cpf_cnpj)
    dest = {
      tipo,
      nome: str(pessoa.nome) || 'Destinatário',
      cpfCnpj: doc,
      ie: str(pessoa.inscricao_estadual) || null,
      indIeDest: str(pessoa.ind_ie_dest) || '9',
      logradouro: str(pessoa.logradouro),
      numero: str(pessoa.numero),
      complemento: str(pessoa.complemento),
      bairro: str(pessoa.bairro),
      codigoMunicipio: str(pessoa.codigo_municipio),
      cidade: str(pessoa.cidade),
      uf: idDest === '3' ? 'EX' : str(pessoa.uf),
      cep: str(pessoa.cep),
      codigoPais: codigoPaisDest,
    }
  }

  const itens: ItemXml[] = []
  const cfopUpdates: { itemId: string; cfop: string }[] = []

  for (let i = 0; i < itensList.length; i++) {
    const ni = itensList[i]!
    const q = num(ni.quantidade, 1)
    const vu = num(ni.valor_unitario, 0)
    const desc = num(ni.desconto, 0)
    const vt = num(ni.valor_total, q * vu - desc)
    const cfopInformado = str(ni.cfop)
    const cfop = ajustarCfopSaida(cfopInformado || null, idDest)
    const itemId = str(ni.id)
    if (itemId && cfop !== onlyDigits(cfopInformado, 4)) {
      cfopUpdates.push({ itemId, cfop })
    }
    itens.push({
      nItem: i + 1,
      cProd: str(ni.produto_codigo) || `ITEM${i + 1}`,
      descricao: str(ni.descricao) || 'Produto',
      ncm: str(ni.ncm) || '99999999',
      cfop,
      unidade: str(ni.unidade) || 'UN',
      quantidade: q,
      valorUnitario: vu,
      desconto: desc,
      valorTotal: vt,
      origem: num(ni.origem, 0),
      icmsCsosn: str(ni.icms_csosn) || null,
      pisCst: str(ni.pis_cst) || null,
      cofinsCst: str(ni.cofins_cst) || null,
    })
  }

  // Persiste CFOP corrigido (e natureza) como ERPs fazem na emissão
  for (const u of cfopUpdates) {
    await db
      .prepare(`UPDATE nota_fiscal_itens SET cfop = ? WHERE id = ? AND nota_fiscal_id = ?`)
      .bind(u.cfop, u.itemId, notaId)
      .run()
  }
  if (natOp !== str(nota.natureza_operacao)) {
    await db
      .prepare(`UPDATE notas_fiscais SET natureza_operacao = ? WHERE id = ? AND tenant_id = ?`)
      .bind(natOp, notaId, tenantId)
      .run()
  }

  const valorTotalNota = num(nota.valor_total, itens.reduce((s, x) => s + x.valorTotal, 0))
  const vDescGlobal = num(nota.valor_desconto, 0)

  const ide: IdeXml = {
    cUF,
    cNF: cNF8,
    natOp,
    mod: String(num(nota.modelo, 55)),
    serie: String(parseInt(onlyDigits(serie, 3) || '1', 10)),
    nNF,
    dhEmi: dh,
    tpNF: '1',
    idDest,
    cMunFG,
    tpImp: '1',
    tpEmis,
    cDV,
    tpAmb: String(num(nota.ambiente, 2)),
    finNFe: '1',
    indFinal: '1',
    indPres: '1',
    verProc: 'SISCR-api',
  }

  const input: BuildNfeXmlInput = {
    chave44,
    ide,
    emit,
    dest,
    itens,
    modFrete: num(nota.mod_frete, 9),
    formaPagamento: str(nota.forma_pagamento) || '99',
    valorTotalNota,
    valorDescontoGlobal: vDescGlobal,
  }

  let xml = buildNfeXmlUnsigned(input)
  const preSign = validateNfeXmlDocumento(xml)
  if (!preSign.ok) {
    throw Object.assign(new Error(formatNfeXmlValidationErrors(preSign.errors)), {
      code: 'NFE_XML_INVALID',
      errors: preSign.errors,
      layoutVersion: preSign.layoutVersion,
    })
  }
  let signed = false

  const certSecret = env.CERT_BLOB_SECRET?.trim()
  let a1ObjectKey: string | null = null
  let decryptScope = empresaId

  if (filialId && str(filial?.a1_r2_object_key)) {
    a1ObjectKey = str(filial!.a1_r2_object_key)
    decryptScope = `filial:${filialId}`
  } else if (str(empresa.a1_r2_object_key)) {
    a1ObjectKey = str(empresa.a1_r2_object_key)
    decryptScope = empresaId
  }

  if (a1ObjectKey) {
    if (!certSecret) {
      throw new Error('CERT_BLOB_SECRET não configurado — impossível usar o certificado A1.')
    }
    if (!env.R2_STORAGE) {
      throw new Error('R2_STORAGE não configurado — impossível ler o certificado A1.')
    }
    const certObj = await env.R2_STORAGE.get(a1ObjectKey)
    if (!certObj) {
      throw new Error('Arquivo do certificado A1 não encontrado no armazenamento.')
    }
    const enc = await certObj.arrayBuffer()
    const bundle = await decryptA1Bundle(certSecret, tenantId, decryptScope, enc)
    xml = await signNfeXmlWithA1(xml, chave44, bundle.pfxBytes, bundle.password)
    signed = true
    const postSign = validateNfeXmlDocumento(xml)
    if (!postSign.ok) {
      throw Object.assign(new Error(formatNfeXmlValidationErrors(postSign.errors)), {
        code: 'NFE_XML_INVALID',
        errors: postSign.errors,
        layoutVersion: postSign.layoutVersion,
      })
    }
  } else if (!options.devMode) {
    throw new Error(
      'Certificado A1 não configurado para esta empresa/filial. Envie o .pfx em Configurações ou use NFE_DEV_MODE=1 apenas em desenvolvimento.',
    )
  }

  const xmlBytes = new TextEncoder().encode(xml)
  const xmlPath = `tenants/${tenantId}/nfe/${chave44}.xml`

  if (!env.R2_STORAGE) {
    throw new Error('R2_STORAGE não configurado — impossível salvar XML.')
  }

  await env.R2_STORAGE.put(xmlPath, xmlBytes, {
    httpMetadata: { contentType: 'application/xml' },
  })

  const now = new Date().toISOString()
  const tent = num(nota.transmissao_tentativas, 0) + 1

  await db
    .prepare(
      `UPDATE notas_fiscais SET
        chave_acesso = ?,
        xml_path = ?,
        data_emissao = ?,
        transmissao_tentativas = ?,
        transmissao_erro = NULL,
        status = 'pendente_emissao',
        updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
    )
    .bind(chave44, xmlPath, now, tent, now, notaId, tenantId)
    .run()

  const ajusteDestino =
    cfopUpdates.length > 0
      ? ` Operação ${rotuloIdDest(idDest)} (idDest=${idDest}): CFOP ajustado automaticamente.`
      : ` Operação ${rotuloIdDest(idDest)} (idDest=${idDest}).`

  return {
    chaveAcesso: chave44,
    xmlPath,
    xmlBytes,
    devMode: options.devMode,
    signed,
    message: signed
      ? options.devMode
        ? `XML assinado e salvo. Modo desenvolvimento — envio SOAP à SEFAZ ainda não implementado.${ajusteDestino}`
        : `XML assinado e salvo. Próximo passo: envio SOAP (nfeAutorizacao) e tratamento do retorno.${ajusteDestino}`
      : `XML gerado e salvo sem assinatura (sem A1). Modo desenvolvimento — sem envio à SEFAZ.${ajusteDestino}`,
  }
}

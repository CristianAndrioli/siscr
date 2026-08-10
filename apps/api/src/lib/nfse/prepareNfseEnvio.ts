/**
 * Gera DPS (nacional) ou PedidoEnvioLoteRPS (Paulistana), assina com A1 e grava no R2.
 */

import type { Env } from '../../index'
import { decryptA1Bundle } from '../certBlob'
import { formatDhEmiSp } from '../nfe/formatDhEmi'
import { onlyDigits } from '../nfe/xmlEscape'
import { buildDpsXml } from './buildDpsXml'
import {
  buildAssinaturaRpsStringV1,
  buildPaulistanaPedidoLoteRps,
} from './buildPaulistanaRps'
import { getNfseAdapter, resolveNfseAdapterKind } from './index'
import { signPaulistanaRpsAssinaturaWithA1, signXmlEnvelopedWithA1 } from './signNfseXml'
import {
  formatNfseXmlValidationErrors,
  validatePaulistanaPedidoXml,
} from './validatePaulistanaPedidoXml'
import { verificarAssinaturaPaulistanaXml } from './verifyPaulistanaSignature'

export type PrepareNfseResult = {
  xmlPath: string
  signed: boolean
  adapter: string
  numero: number
  serie: string
  message: string
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function num(v: unknown, d = 0): number {
  if (v == null) return d
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

export async function prepareNfseEnvio(
  env: Env,
  tenantId: string,
  notaId: string,
  options: { devMode: boolean; force?: boolean },
): Promise<PrepareNfseResult> {
  const db = env.DB_SHARED

  const nota = await db
    .prepare(`SELECT * FROM notas_fiscais WHERE id = ? AND tenant_id = ? AND tipo = 'nfse'`)
    .bind(notaId, tenantId)
    .first<Record<string, unknown>>()

  if (!nota) throw new Error('NFS-e não encontrada.')
  if (str(nota.status) === 'cancelada') throw new Error('Nota cancelada.')
  if (str(nota.status) === 'emitida') {
    throw new Error('Nota já faturada no ERP. Não é possível gerar ou regerar o XML/DPS.')
  }
  if (str(nota.protocolo_autorizacao)) {
    throw new Error('Nota já autorizada pela prefeitura. Não é possível regerar.')
  }
  if (str(nota.status) === 'autorizada') {
    throw new Error('Nota já autorizada pela prefeitura. Não é possível regerar.')
  }
  if (str(nota.xml_path) && !options.force) {
    throw new Error('Nota já possui XML/DPS. Use force para regerar.')
  }

  let empresaId = str(nota.empresa_id)
  if (!empresaId) {
    const fallback = await db
      .prepare(`SELECT id FROM empresas WHERE tenant_id = ? ORDER BY created_at LIMIT 1`)
      .bind(tenantId)
      .first<{ id: string }>()
    if (!fallback?.id) throw new Error('Cadastre uma empresa antes de emitir NFS-e.')
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
  if (!empresa) throw new Error('Empresa não encontrada.')

  const filialId = str(nota.filial_id)
  let filial: Record<string, unknown> | null = null
  if (filialId) {
    filial = await db
      .prepare(`SELECT * FROM filiais WHERE id = ? AND tenant_id = ?`)
      .bind(filialId, tenantId)
      .first<Record<string, unknown>>()
  }

  const cMun = onlyDigits(str(filial?.codigo_municipio) || str(empresa.codigo_municipio), 7)
  const kind = resolveNfseAdapterKind(cMun)
  if (kind === 'unsupported') {
    throw new Error(
      `Município IBGE "${cMun || '—'}" não suportado para NFS-e. Suportados: São Paulo (3550308) e Chapecó (4204202).`,
    )
  }
  // Valida existência do adapter
  getNfseAdapter(cMun)

  const im =
    str(filial?.inscricao_municipal).trim() || str(empresa.inscricao_municipal).trim()
  if (!im) {
    throw new Error(
      'Inscrição municipal (IM) obrigatória. Configure em Configurações → Faturamento (NFS-e) ou Empresas/Filiais.',
    )
  }

  const destId = str(nota.destinatario_id)
  let pessoa: Record<string, unknown> | null = null
  if (destId) {
    pessoa = await db
      .prepare(`SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?`)
      .bind(destId, tenantId)
      .first<Record<string, unknown>>()
  }

  const serieCfg = str(empresa.nfse_serie).trim() || '1'
  let numero = num(nota.numero, 0)
  if (!numero || numero < 1) {
    const prox = Math.max(1, num(empresa.nfse_proximo_numero, 1))
    numero = prox
    await db
      .prepare(
        `UPDATE empresas SET nfse_proximo_numero = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      )
      .bind(prox + 1, new Date().toISOString(), empresaId, tenantId)
      .run()
  }

  const ambiente = (num(empresa.nfse_ambiente, 2) === 1 ? 1 : 2) as 1 | 2
  const descricao =
    str(nota.descricao_servico).trim() ||
    'Prestação de serviços'
  const codigoServico =
    str(nota.codigo_servico).trim() ||
    str(empresa.nfse_codigo_servico_padrao).trim() ||
    '01.01'
  const valorServico = num(nota.valor_total, 0)
  if (valorServico <= 0) throw new Error('Valor do serviço deve ser maior que zero.')
  const aliquotaIss = num(nota.aliquota_iss, 0)
  const valorIss = num(nota.valor_iss, (valorServico * aliquotaIss) / 100)
  const dh = formatDhEmiSp()
  const cnpj = onlyDigits(str(empresa.cnpj), 14)
  if (cnpj.length !== 14) throw new Error('CNPJ da empresa inválido.')

  const idSeed = `${cMun}${cnpj}${serieCfg.padStart(5, '0')}${String(numero).padStart(15, '0')}`
  let unsigned: string
  let signIdAttr: string | null = null
  const tomadorDoc = onlyDigits(str(pessoa?.cpf_cnpj))
  const tomadorNome = str(pessoa?.nome) || 'TOMADOR'

  const a1KeyFilial = filialId ? str(filial?.a1_r2_object_key) : ''
  const a1KeyEmpresa = str(empresa.a1_r2_object_key)
  const a1ObjectKey = a1KeyFilial || a1KeyEmpresa
  const decryptScope = a1KeyFilial ? `filial:${filialId}` : empresaId

  let pfxBytes: ArrayBuffer | null = null
  let pfxPassword = ''

  if (a1ObjectKey && env.CERT_BLOB_SECRET?.trim() && env.R2_STORAGE) {
    const certObj = await env.R2_STORAGE.get(a1ObjectKey)
    if (!certObj) throw new Error('Arquivo do certificado A1 não encontrado no armazenamento.')
    const bundle = await decryptA1Bundle(
      env.CERT_BLOB_SECRET,
      tenantId,
      decryptScope,
      await certObj.arrayBuffer(),
    )
    pfxBytes = bundle.pfxBytes
    pfxPassword = bundle.password
  } else if (!options.devMode) {
    throw new Error(
      'Certificado A1 obrigatório para gerar NFS-e. Envie o .pfx em Configurações → Empresas/Filiais.',
    )
  }

  if (kind === 'nacional') {
    signIdAttr = `DPS${idSeed}`
    unsigned = buildDpsXml({
      idInfDps: idSeed,
      serie: serieCfg,
      nDps: numero,
      dhEmi: dh,
      cMun,
      cnpjPrestador: cnpj,
      imPrestador: im,
      cpfCnpjTomador: tomadorDoc,
      nomeTomador: tomadorNome,
      codigoServico,
      descricaoServico: descricao,
      valorServico,
      aliquotaIss,
      valorIss,
    })
  } else {
    let assinaturaRps = ''
    if (pfxBytes) {
      const cadeia = buildAssinaturaRpsStringV1({
        imPrestador: im,
        serieRps: serieCfg,
        numeroRps: numero,
        dataEmissao: dh,
        valorServicos: valorServico,
        codigoServico,
        cpfCnpjTomador: tomadorDoc,
      })
      assinaturaRps = await signPaulistanaRpsAssinaturaWithA1(cadeia, pfxBytes, pfxPassword)
    }
    unsigned = buildPaulistanaPedidoLoteRps({
      cnpjPrestador: cnpj,
      imPrestador: im,
      serieRps: serieCfg,
      numeroRps: numero,
      dataEmissao: dh,
      codigoServico,
      aliquotaIss,
      valorServicos: valorServico,
      valorIss,
      discriminacao: descricao,
      cpfCnpjTomador: tomadorDoc,
      nomeTomador: tomadorNome,
      assinaturaRps,
      ambiente,
    })
    // Paulistana: URI vazia (sem atributo Id no Pedido)
    signIdAttr = null

    // Em modo prod (com A1) a Assinatura RPS já está preenchida — confronta antes de gravar.
    if (pfxBytes) {
      const preCheck = validatePaulistanaPedidoXml(unsigned)
      if (!preCheck.ok) {
        throw new Error(
          `XML Paulistana inválido (confrontação local): ${formatNfseXmlValidationErrors(preCheck.errors)}`,
        )
      }
    }
  }

  let signedXml = unsigned
  let signed = false

  if (pfxBytes) {
    signedXml = await signXmlEnvelopedWithA1(unsigned, signIdAttr, pfxBytes, pfxPassword)
    signed = true
    if (kind === 'paulistana') {
      const sigCheck = await verificarAssinaturaPaulistanaXml(signedXml)
      if (!sigCheck.valida) {
        throw new Error(
          `Assinatura XML-DSig inválida após gerar (${sigCheck.mensagem}). Não envie à Prefeitura — corrija a assinatura (evita rejeição 1057).`,
        )
      }
    }
  }

  if (!env.R2_STORAGE) throw new Error('R2_STORAGE não configurado.')

  const xmlPath = `tenants/${tenantId}/nfse/${notaId}-${kind}.xml`
  await env.R2_STORAGE.put(xmlPath, signedXml, {
    httpMetadata: { contentType: 'application/xml' },
  })

  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE notas_fiscais SET
        numero = ?,
        serie = ?,
        ambiente = ?,
        xml_path = ?,
        status = CASE WHEN status = 'emitida' THEN status ELSE 'pendente_emissao' END,
        transmissao_erro = NULL,
        updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(numero, serieCfg, ambiente, xmlPath, now, notaId, tenantId)
    .run()

  return {
    xmlPath,
    signed,
    adapter: kind,
    numero,
    serie: serieCfg,
    message: signed
      ? `XML/DPS gerado e assinado (${kind}). Pronto para transmitir.`
      : `XML/DPS gerado sem assinatura (modo dev). Configure o A1 para produção.`,
  }
}

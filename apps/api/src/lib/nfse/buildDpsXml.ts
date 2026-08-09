import { xmlEscape, onlyDigits } from '../nfe/xmlEscape'

function money(v: number): string {
  return (Math.round((Number.isFinite(v) ? v : 0) * 100) / 100).toFixed(2)
}

export type BuildDpsInput = {
  /** Identificador Id do infDPS (sem prefixo). */
  idInfDps: string
  serie: string
  nDps: number
  dhEmi: string
  cMun: string
  cnpjPrestador: string
  imPrestador: string
  cpfCnpjTomador: string
  nomeTomador: string
  codigoServico: string
  descricaoServico: string
  valorServico: number
  aliquotaIss: number
  valorIss: number
}

/**
 * Monta DPS (Declaração de Prestação de Serviço) no layout simplificado
 * do Sistema Nacional NFS-e (Sefin Nacional). Campos mínimos para ISS.
 *
 * Referência: Manual dos Contribuintes — API Sistema Nacional NFS-e.
 */
export function buildDpsXml(input: BuildDpsInput): string {
  const cnpj = onlyDigits(input.cnpjPrestador)
  const tomDoc = onlyDigits(input.cpfCnpjTomador)
  const isCpf = tomDoc.length === 11
  const serie = String(input.serie || '1').replace(/\D/g, '').slice(0, 5) || '1'
  const nDps = String(Math.max(1, Math.floor(input.nDps))).padStart(15, '0')
  const cMun = onlyDigits(input.cMun).slice(0, 7)
  const codServ = xmlEscape(String(input.codigoServico || '').trim() || '01.01')
  const id = `DPS${input.idInfDps}`

  const tomadorXml = tomDoc
    ? `<toma>
      ${isCpf ? `<CPF>${tomDoc}</CPF>` : `<CNPJ>${tomDoc}</CNPJ>`}
      <xNome>${xmlEscape(input.nomeTomador || 'TOMADOR')}</xNome>
    </toma>`
    : ''

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<infDPS Id="${id}">` +
    `<tpAmb>${2}</tpAmb>` +
    `<dhEmi>${xmlEscape(input.dhEmi)}</dhEmi>` +
    `<verAplic>SISCR1.0</verAplic>` +
    `<serie>${serie}</serie>` +
    `<nDPS>${nDps}</nDPS>` +
    `<dCompet>${xmlEscape(input.dhEmi.slice(0, 10))}</dCompet>` +
    `<tpEmit>1</tpEmit>` +
    `<cLocEmi>${cMun}</cLocEmi>` +
    `<prest>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<IM>${xmlEscape(input.imPrestador)}</IM>` +
    `</prest>` +
    tomadorXml +
    `<serv>` +
    `<cServ>` +
    `<cTribNac>${codServ.replace(/\D/g, '').padStart(6, '0').slice(0, 6)}</cTribNac>` +
    `<xDescServ>${xmlEscape(input.descricaoServico).slice(0, 2000)}</xDescServ>` +
    `</cServ>` +
    `</serv>` +
    `<valores>` +
    `<vServPrest>` +
    `<vServ>${money(input.valorServico)}</vServ>` +
    `</vServPrest>` +
    `<trib>` +
    `<tribMun>` +
    `<tribISSQN>1</tribISSQN>` +
    `<pAliq>${money(input.aliquotaIss)}</pAliq>` +
    `<vISSQN>${money(input.valorIss)}</vISSQN>` +
    `</tribMun>` +
    `</trib>` +
    `</valores>` +
    `</infDPS>` +
    `</DPS>`
  )
}

import { xmlEscape, onlyDigits } from './xmlEscape'

const NS = 'http://www.portalfiscal.inf.br/nfe'

export type EmitenteXml = {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string | null
  ie?: string | null
  crt: string
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  codigoMunicipio?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

export type DestinatarioXml = {
  tipo: 'PJ' | 'PF'
  nome: string
  cpfCnpj: string
  ie?: string | null
  indIeDest?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  codigoMunicipio?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  /** Código Bacen do país (1058 = Brasil). */
  codigoPais?: string | null
}

export type ItemXml = {
  nItem: number
  cProd: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  desconto: number
  valorTotal: number
  origem: number
  icmsCsosn?: string | null
  pisCst?: string | null
  cofinsCst?: string | null
}

export type IdeXml = {
  cUF: string
  cNF: string
  natOp: string
  mod: string
  serie: string
  nNF: string
  dhEmi: string
  tpNF: string
  idDest: string
  cMunFG: string
  tpImp: string
  tpEmis: string
  cDV: string
  tpAmb: string
  finNFe: string
  indFinal: string
  indPres: string
  verProc: string
}

function enderEmit(e: EmitenteXml): string {
  const cmun = onlyDigits(e.codigoMunicipio ?? '', 7) || '3550308'
  const cep = onlyDigits(e.cep ?? '', 8).padStart(8, '0')
  return `<enderEmit><xLgr>${xmlEscape(e.logradouro || 'NAO INFORMADO')}</xLgr><nro>${xmlEscape(e.numero || 'S/N')}</nro>${e.complemento ? `<xCpl>${xmlEscape(e.complemento)}</xCpl>` : ''}<xBairro>${xmlEscape(e.bairro || 'CENTRO')}</xBairro><cMun>${cmun}</cMun><xMun>${xmlEscape(e.cidade || 'NAO INFORMADO')}</xMun><UF>${xmlEscape((e.uf || 'SP').toUpperCase())}</UF><CEP>${cep}</CEP><cPais>1058</cPais><xPais>Brasil</xPais></enderEmit>`
}

function emitBlock(e: EmitenteXml): string {
  const cnpj = onlyDigits(e.cnpj, 14)
  const ieTxt = onlyDigits(e.ie ?? '', 14) || 'ISENTO'
  return `<emit><CNPJ>${cnpj}</CNPJ><xNome>${xmlEscape(e.razaoSocial)}</xNome>${e.nomeFantasia ? `<xFant>${xmlEscape(e.nomeFantasia)}</xFant>` : ''}${enderEmit(e)}<IE>${xmlEscape(ieTxt)}</IE><CRT>${xmlEscape(e.crt || '1')}</CRT></emit>`
}

function enderDest(d: DestinatarioXml): string {
  const cmun = onlyDigits(d.codigoMunicipio ?? '', 7) || '3550308'
  const cep = onlyDigits(d.cep ?? '', 8).padStart(8, '0')
  const cPais = onlyDigits(d.codigoPais ?? '1058', 4) || '1058'
  const xPais = cPais === '1058' ? 'Brasil' : 'Exterior'
  return `<enderDest><xLgr>${xmlEscape(d.logradouro || 'NAO INFORMADO')}</xLgr><nro>${xmlEscape(d.numero || 'S/N')}</nro>${d.complemento ? `<xCpl>${xmlEscape(d.complemento)}</xCpl>` : ''}<xBairro>${xmlEscape(d.bairro || 'CENTRO')}</xBairro><cMun>${cmun}</cMun><xMun>${xmlEscape(d.cidade || 'NAO INFORMADO')}</xMun><UF>${xmlEscape((d.uf || 'SP').toUpperCase())}</UF><CEP>${cep}</CEP><cPais>${cPais}</cPais><xPais>${xPais}</xPais></enderDest>`
}

function destBlock(d: DestinatarioXml): string {
  const doc =
    d.tipo === 'PF'
      ? `<CPF>${onlyDigits(d.cpfCnpj, 11).padStart(11, '0')}</CPF>`
      : `<CNPJ>${onlyDigits(d.cpfCnpj, 14).padStart(14, '0')}</CNPJ>`
  const indIe = d.indIeDest || '9'
  return `<dest>${doc}<xNome>${xmlEscape(d.nome)}</xNome>${enderDest(d)}<indIEDest>${indIe}</indIEDest></dest>`
}

function detItemFixed(it: ItemXml): string {
  const q = it.quantidade.toFixed(4)
  const vu = it.valorUnitario.toFixed(2)
  const vd = it.desconto.toFixed(2)
  const vp = it.valorTotal.toFixed(2)
  const ncm = onlyDigits(it.ncm || '99999999', 8).padStart(8, '0')
  const cfop = onlyDigits(it.cfop || '5102', 4).padStart(4, '0')
  const orig = String(it.origem ?? 0)
  const allowedCsosn = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'])
  let csosn = (it.icmsCsosn || '102').replace(/\D/g, '').padStart(3, '0').slice(-3)
  if (!allowedCsosn.has(csosn)) csosn = '102'
  const pisCst = (it.pisCst || '07').replace(/\D/g, '').padStart(2, '0').slice(-2)
  const cofCst = (it.cofinsCst || '07').replace(/\D/g, '').padStart(2, '0').slice(-2)

  const icmsTag = `ICMS${csosn}`
  return `<det nItem="${it.nItem}"><prod><cProd>${xmlEscape(it.cProd)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${xmlEscape(it.descricao)}</xProd><NCM>${ncm}</NCM><CFOP>${cfop}</CFOP><uCom>${xmlEscape(it.unidade || 'UN')}</uCom><qCom>${q}</qCom><vUnCom>${vu}</vUnCom><vProd>${vp}</vProd>${parseFloat(vd) > 0 ? `<vDesc>${vd}</vDesc>` : ''}<cEANTrib>SEM GTIN</cEANTrib><uTrib>${xmlEscape(it.unidade || 'UN')}</uTrib><qTrib>${q}</qTrib><vUnTrib>${vu}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><${icmsTag}><orig>${orig}</orig><CSOSN>${csosn}</CSOSN></${icmsTag}></ICMS><PIS><PISNT><CST>${pisCst}</CST></PISNT></PIS><COFINS><COFINSNT><CST>${cofCst}</CST></COFINSNT></COFINS></imposto></det>`
}

function ideBlock(i: IdeXml): string {
  return `<ide><cUF>${i.cUF}</cUF><cNF>${i.cNF}</cNF><natOp>${xmlEscape(i.natOp)}</natOp><mod>${i.mod}</mod><serie>${i.serie}</serie><nNF>${i.nNF}</nNF><dhEmi>${i.dhEmi}</dhEmi><tpNF>${i.tpNF}</tpNF><idDest>${i.idDest}</idDest><cMunFG>${i.cMunFG}</cMunFG><tpImp>${i.tpImp}</tpImp><tpEmis>${i.tpEmis}</tpEmis><cDV>${i.cDV}</cDV><tpAmb>${i.tpAmb}</tpAmb><finNFe>${i.finNFe}</finNFe><indFinal>${i.indFinal}</indFinal><indPres>${i.indPres}</indPres><procEmi>0</procEmi><verProc>${xmlEscape(i.verProc)}</verProc></ide>`
}

function totalBlock(vProd: string, vNF: string, vDesc: string): string {
  const z = '0.00'
  return `<total><ICMSTot><vBC>${z}</vBC><vICMS>${z}</vICMS><vICMSDeson>${z}</vICMSDeson><vFCP>${z}</vFCP><vBCST>${z}</vBCST><vST>${z}</vST><vFCPST>${z}</vFCPST><vFCPSTRet>${z}</vFCPSTRet><vProd>${vProd}</vProd><vFrete>${z}</vFrete><vSeg>${z}</vSeg><vDesc>${vDesc}</vDesc><vII>${z}</vII><vIPI>${z}</vIPI><vIPIDevol>${z}</vIPIDevol><vPIS>${z}</vPIS><vCOFINS>${z}</vCOFINS><vOutro>${z}</vOutro><vNF>${vNF}</vNF><vTotTrib>${z}</vTotTrib></ICMSTot></total>`
}

function transpBlock(modFrete: number): string {
  return `<transp><modFrete>${modFrete}</modFrete></transp>`
}

function pagBlock(tPag: string, vPag: string): string {
  const tp = onlyDigits(tPag, 2).padStart(2, '0')
  return `<pag><detPag><tPag>${tp}</tPag><vPag>${vPag}</vPag></detPag></pag>`
}

export type BuildNfeXmlInput = {
  chave44: string
  ide: IdeXml
  emit: EmitenteXml
  dest?: DestinatarioXml | null
  itens: ItemXml[]
  modFrete: number
  formaPagamento: string
  valorTotalNota: number
  /** Desconto global da nota (ICMSTot/vDesc). */
  valorDescontoGlobal: number
}

/**
 * XML da NF-e (sem assinatura). Estrutura mínima 4.00 para evolução (SEFAZ / assinatura).
 * Revisar totais e impostos com contador antes de produção.
 */
export function buildNfeXmlUnsigned(input: BuildNfeXmlInput): string {
  const idAttr = `NFe${input.chave44}`
  const vProd = input.itens.reduce((s, x) => s + x.valorTotal, 0).toFixed(2)
  const vNF = input.valorTotalNota.toFixed(2)
  const vDesc = input.valorDescontoGlobal.toFixed(2)
  const dets = input.itens.map((it) => detItemFixed(it)).join('')
  const destXml = input.dest ? destBlock(input.dest) : ''

  const infNFe = `<infNFe versao="4.00" Id="${idAttr}">${ideBlock(input.ide)}${emitBlock(input.emit)}${destXml}${dets}${totalBlock(vProd, vNF, vDesc)}${transpBlock(input.modFrete)}${pagBlock(input.formaPagamento, vNF)}</infNFe>`

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NS}">${infNFe}</NFe>`
}

import { xmlEscape, onlyDigits } from '../nfe/xmlEscape'

function money(v: number): string {
  return (Math.round((Number.isFinite(v) ? v : 0) * 100) / 100).toFixed(2)
}

/** Valor em centavos, 15 dígitos, sem ponto (assinatura RPS Paulistana). */
function centavos15(v: number): string {
  const cents = Math.round((Number.isFinite(v) ? v : 0) * 100)
  return String(Math.max(0, cents)).padStart(15, '0')
}

export type BuildPaulistanaRpsInput = {
  idAttr: string
  cnpjPrestador: string
  imPrestador: string
  serieRps: string
  numeroRps: number
  dataEmissao: string
  codigoServico: string
  aliquotaIss: number
  valorServicos: number
  valorIss: number
  discriminacao: string
  cpfCnpjTomador: string
  nomeTomador: string
  /** Assinatura posicional SHA1+RSA do RPS (Base64). Obrigatória na Prefeitura. */
  assinaturaRps: string
  /** Ambiente 2 → TesteEnvioLoteRPS (mesmo endpoint de produção). */
  ambiente: 1 | 2
}

export type AssinaturaRpsFields = {
  imPrestador: string
  serieRps: string
  numeroRps: number
  dataEmissao: string
  tributacaoRps?: string
  statusRps?: string
  issRetido?: boolean
  valorServicos: number
  valorDeducoes?: number
  codigoServico: string
  cpfCnpjTomador: string
}

/**
 * Cadeia ASCII da assinatura do RPS (layout v1 — 86 posições sem intermediário).
 * Manual Paulistana §4.3.2.
 */
export function buildAssinaturaRpsStringV1(fields: AssinaturaRpsFields): string {
  const im = onlyDigits(fields.imPrestador).padStart(8, '0').slice(-8)
  const serie = String(fields.serieRps || '1').slice(0, 5).padEnd(5, ' ')
  const numero = String(Math.max(1, Math.floor(fields.numeroRps))).padStart(12, '0')
  const data = onlyDigits(fields.dataEmissao).slice(0, 8) // AAAAMMDD
  const tributacao = (fields.tributacaoRps || 'T').slice(0, 1)
  const status = (fields.statusRps || 'N').slice(0, 1)
  const issRetido = fields.issRetido ? 'S' : 'N'
  const valorServ = centavos15(fields.valorServicos)
  const valorDed = centavos15(fields.valorDeducoes ?? 0)
  const codServ = onlyDigits(fields.codigoServico).padStart(5, '0').slice(-5)
  const tomDoc = onlyDigits(fields.cpfCnpjTomador)
  let indTom = '3'
  if (tomDoc.length === 11) indTom = '1'
  else if (tomDoc.length === 14) indTom = '2'
  const docTom = tomDoc.padStart(14, '0').slice(-14)

  return (
    im +
    serie +
    numero +
    data +
    tributacao +
    status +
    issRetido +
    valorServ +
    valorDed +
    codServ +
    indTom +
    docTom
  )
}

/**
 * PedidoEnvioLoteRPS layout v1 (estável no WS síncrono atual).
 * Assinatura envelopada sobre o PedidoEnvioLoteRPS (Id).
 *
 * Layout Paulistana: https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx
 */
export function buildPaulistanaPedidoLoteRps(input: BuildPaulistanaRpsInput): string {
  const cnpj = onlyDigits(input.cnpjPrestador)
  const im = onlyDigits(input.imPrestador).padStart(8, '0').slice(-8)
  const serie = xmlEscape(String(input.serieRps || '1').slice(0, 5))
  const nRps = String(Math.max(1, Math.floor(input.numeroRps)))
  const codServ = onlyDigits(input.codigoServico).padStart(5, '0').slice(-5) || '01001'
  const tomDoc = onlyDigits(input.cpfCnpjTomador)
  const isCpf = tomDoc.length === 11
  const dt = xmlEscape(input.dataEmissao.slice(0, 10))
  // Alíquota Paulistana: fração (5% → 0.05)
  const aliq = money(input.aliquotaIss / 100)
  const assinatura = xmlEscape(input.assinaturaRps || '')

  const tomador =
    tomDoc.length >= 11
      ? `<CPFCNPJTomador>${isCpf ? `<CPF>${tomDoc}</CPF>` : `<CNPJ>${tomDoc}</CNPJ>`}</CPFCNPJTomador>
         <RazaoSocialTomador>${xmlEscape(input.nomeTomador || 'TOMADOR')}</RazaoSocialTomador>`
      : ''

  const rps = `
    <RPS>
      <Assinatura>${assinatura}</Assinatura>
      <ChaveRPS>
        <InscricaoPrestador>${im}</InscricaoPrestador>
        <SerieRPS>${serie}</SerieRPS>
        <NumeroRPS>${nRps}</NumeroRPS>
      </ChaveRPS>
      <TipoRPS>RPS</TipoRPS>
      <DataEmissao>${dt}</DataEmissao>
      <StatusRPS>N</StatusRPS>
      <TributacaoRPS>T</TributacaoRPS>
      <ValorServicos>${money(input.valorServicos)}</ValorServicos>
      <ValorDeducoes>0.00</ValorDeducoes>
      <ValorPIS>0.00</ValorPIS>
      <ValorCOFINS>0.00</ValorCOFINS>
      <ValorINSS>0.00</ValorINSS>
      <ValorIR>0.00</ValorIR>
      <ValorCSLL>0.00</ValorCSLL>
      <CodigoServico>${codServ}</CodigoServico>
      <Aliquota>${aliq}</Aliquota>
      <ISSRetido>false</ISSRetido>
      ${tomador}
      <Discriminacao>${xmlEscape(input.discriminacao).slice(0, 2000)}</Discriminacao>
      <ValorISS>${money(input.valorIss)}</ValorISS>
    </RPS>`

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="${input.idAttr}">` +
    `<Cabecalho Versao="1" xmlns="">` +
    `<CPFCNPJRemetente><CNPJ>${cnpj}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>false</transacao>` +
    `<dtInicio>${dt}</dtInicio>` +
    `<dtFim>${dt}</dtFim>` +
    `<QtdRPS>1</QtdRPS>` +
    `<ValorTotalServicos>${money(input.valorServicos)}</ValorTotalServicos>` +
    `<ValorTotalDeducoes>0.00</ValorTotalDeducoes>` +
    `</Cabecalho>` +
    `<Lote xmlns="">${rps}</Lote>` +
    `</PedidoEnvioLoteRPS>`
  )
}

/**
 * SOAPAction do ASMX Paulistana (não é o nome do método SOAP).
 * Ref.: clientes estáveis (ex. nfse-sp) e WSDL LoteNFe.
 */
export function paulistanaSoapAction(teste: boolean): string {
  const action = teste ? 'testeenvio' : 'envioLoteRPS'
  // ASP.NET exige aspas no header SOAPAction
  return `"http://www.prefeitura.sp.gov.br/nfe/ws/${action}"`
}

export function wrapPaulistanaSoap(mensagemXml: string, teste: boolean): string {
  const method = teste ? 'TesteEnvioLoteRPS' : 'EnvioLoteRPS'
  // MensagemXML como string escapada (contrato clássico do ASMX Paulistana)
  const escaped = mensagemXml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>` +
    `<${method} xmlns="http://www.prefeitura.sp.gov.br/nfe">` +
    `<VersaoSchema>1</VersaoSchema>` +
    `<MensagemXML>${escaped}</MensagemXML>` +
    `</${method}>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  )
}

export const PAULISTANA_LOTE_URL = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx'

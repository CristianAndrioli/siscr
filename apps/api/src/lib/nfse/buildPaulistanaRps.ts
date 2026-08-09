import { xmlEscape, onlyDigits } from '../nfe/xmlEscape'

function money(v: number): string {
  return (Math.round((Number.isFinite(v) ? v : 0) * 100) / 100).toFixed(2)
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
  /** Ambiente 2 → TesteEnvioLoteRPS (mesmo endpoint de produção). */
  ambiente: 1 | 2
}

/**
 * PedidoEnvioLoteRPS (layout v2 / reforma 2026 — campos mínimos ISS).
 * Assinatura envelopada sobre o PedidoEnvioLoteRPS (Id).
 *
 * Layout Paulistana: https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx
 */
export function buildPaulistanaPedidoLoteRps(input: BuildPaulistanaRpsInput): string {
  const cnpj = onlyDigits(input.cnpjPrestador)
  const im = xmlEscape(String(input.imPrestador || '').trim())
  const serie = xmlEscape(String(input.serieRps || '1').slice(0, 5))
  const nRps = String(Math.max(1, Math.floor(input.numeroRps)))
  const codServ = onlyDigits(input.codigoServico).slice(0, 5) || '01001'
  const tomDoc = onlyDigits(input.cpfCnpjTomador)
  const isCpf = tomDoc.length === 11
  const dt = xmlEscape(input.dataEmissao.slice(0, 10))
  // Alíquota Paulistana: fração (5% → 0.05) em alguns layouts; usamos percentual / 100
  const aliq = money(input.aliquotaIss / 100)

  const tomador =
    tomDoc.length >= 11
      ? `<CPFCNPJTomador>${isCpf ? `<CPF>${tomDoc}</CPF>` : `<CNPJ>${tomDoc}</CNPJ>`}</CPFCNPJTomador>
         <RazaoSocialTomador>${xmlEscape(input.nomeTomador || 'TOMADOR')}</RazaoSocialTomador>`
      : ''

  // Campos IBSCBS mínimos exigidos no schema v2 (reforma 2026)
  const ibscbs = `
    <IBSCBS>
      <finNFSe>0</finNFSe>
      <indFinal>0</indFinal>
      <cIndOp>100501</cIndOp>
      <indDest>0</indDest>
      <valores>
        <trib>
          <gIBSCBS>
            <cClassTrib>000001</cClassTrib>
          </gIBSCBS>
        </trib>
      </valores>
    </IBSCBS>`

  const rps = `
    <RPS>
      <Assinatura></Assinatura>
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
      <cLocPrestacao>3550308</cLocPrestacao>
      ${ibscbs}
    </RPS>`

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="${input.idAttr}">` +
    `<Cabecalho Versao="2" xmlns="">` +
    `<CPFCNPJRemetente><CNPJ>${cnpj}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>true</transacao>` +
    `<dtInicio>${dt}</dtInicio>` +
    `<dtFim>${dt}</dtFim>` +
    `<QtdRPS>1</QtdRPS>` +
    `</Cabecalho>` +
    `<Lote xmlns="">${rps}</Lote>` +
    `</PedidoEnvioLoteRPS>`
  )
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
    `<VersaoSchema>2</VersaoSchema>` +
    `<MensagemXML>${escaped}</MensagemXML>` +
    `</${method}>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  )
}

export const PAULISTANA_LOTE_URL = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx'

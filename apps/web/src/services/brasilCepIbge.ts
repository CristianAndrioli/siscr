/**
 * Consulta de CEP (ViaCEP) com código IBGE do município (7 dígitos) para NF-e.
 * Documentação: https://viacep.com.br/ — o JSON inclui o campo `ibge` do município.
 *
 * Com `VITE_API_URL` definido, usa o proxy `/api/public/cep` no Worker (evita CORS).
 */

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '';

export type CepIbgeLookupResult = {
  /** CEP formatado 00000-000 */
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Código do município (7 dígitos), ex.: 3550308 — uso em cMun na NF-e */
  codigoMunicipioIbge: string;
};

type ViaCepJson = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean | string;
};

function onlyDigits(s: string, max: number) {
  return s.replace(/\D/g, '').slice(0, max);
}

/**
 * Busca endereço e código IBGE do município pelo CEP (8 dígitos).
 * Retorna null se CEP inválido, não encontrado ou erro de rede.
 */
export async function fetchCepComIbge(cep: string): Promise<CepIbgeLookupResult | null> {
  const digits = onlyDigits(cep, 8);
  if (digits.length !== 8) return null;

  try {
    const url = API_BASE
      ? `${API_BASE.replace(/\/$/, '')}/api/public/cep/${digits}`
      : `https://viacep.com.br/ws/${digits}/json/`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepJson;
    if (data.erro === true || data.erro === 'true') return null;

    const ibgeRaw = data.ibge != null ? String(data.ibge).replace(/\D/g, '') : '';
    const codigoMunicipioIbge = ibgeRaw.length === 7 ? ibgeRaw : '';

    return {
      cep: data.cep ?? `${digits.slice(0, 5)}-${digits.slice(5)}`,
      logradouro: (data.logradouro ?? '').trim(),
      complemento: (data.complemento ?? '').trim(),
      bairro: (data.bairro ?? '').trim(),
      cidade: (data.localidade ?? '').trim(),
      uf: (data.uf ?? '').trim().toUpperCase().slice(0, 2),
      codigoMunicipioIbge,
    };
  } catch {
    return null;
  }
}

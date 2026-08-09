# SISCR — Ponte SEFAZ (mTLS)

Serviço **fora** do Cloudflare Workers. Recebe o SOAP do SISCR, anexa o certificado A1
(mTLS) e repassa ao webservice da SEFAZ.

## Por que existe

Workers não fazem mTLS dinâmico por tenant. A conexão `sefaz-dfe` aponta para **esta**
ponte. As URLs da SEFAZ continuam sendo montadas pela API (`X-Sefaz-Url`).

## Contrato HTTP

```
POST /
Content-Type: application/soap+xml; charset=utf-8
X-Sefaz-Url: https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx
X-Pfx-Base64: <PKCS#12 em base64>
X-Pfx-Password: <senha do pfx>
Authorization: Bearer <BRIDGE_TOKEN>   # se configurado
```

Body = envelope SOAP. Resposta = status/corpo da SEFAZ.

`GET /health` → `{ "ok": true }`.

## Rodar local

```bash
cd apps/sefaz-bridge
cp .env.example .env   # edite BRIDGE_TOKEN
pnpm install
pnpm start
# http://127.0.0.1:8788
```

Para o staging enxergar a máquina local, use um túnel (ex.: Cloudflare Tunnel, ngrok):

```bash
# exemplo ngrok
ngrok http 8788
# URL pública → use em Configurações → Conexões → sefaz-dfe → URL base
```

## Cadastrar no SISCR

1. Configurações → Conexões → Nova conexão  
2. Tipo: **Ponte SEFAZ DFe / NF-e (mTLS)**  
3. Nome: `sefaz-dfe`  
4. URL base: URL pública da ponte (com HTTPS)  
5. Auth: **Bearer token** com o mesmo `BRIDGE_TOKEN` do `.env`  
6. Ativa

## Deploy sugerido (produção)

Qualquer host Node 20+ com HTTPS:

- Fly.io / Railway / Render / VPS + Caddy  
- Variáveis: `PORT`, `BRIDGE_TOKEN`  
- Não exponha sem token

O certificado A1 **não** fica gravado na ponte: a API SISCR envia o `.pfx` do tenant
só no momento da chamada (header), já descriptografado do R2.

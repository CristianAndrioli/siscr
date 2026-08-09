# SISCR — Ponte SEFAZ (mTLS)

Serviço **fora** do runtime puro do Worker. Recebe o SOAP do SISCR, anexa o certificado A1
(mTLS) e repassa ao webservice da SEFAZ.

## Por que existe

Workers não fazem mTLS dinâmico por tenant. A conexão `sefaz-dfe` aponta para **esta**
ponte. As URLs da SEFAZ continuam sendo montadas pela API (`X-Sefaz-Url`).

Multi-tenant: **um** container compartilhado; o A1 vai **por request** nos headers.

## Deploy Cloudflare Containers (recomendado)

Runtime 100% na Cloudflare. O **build da imagem** roda no **GitHub Actions**
(`.github/workflows/deploy-staging.yml`) em todo push na branch `staging` — não precisa
de Docker na sua máquina.

Secret `BRIDGE_TOKEN` (uma vez):

```bash
cd apps/sefaz-bridge
npx wrangler secret put BRIDGE_TOKEN
```

URL pública atual: `https://siscr-sefaz-bridge.lucaspercisi.workers.dev`

Espere 2–3 min após o primeiro deploy (provisionamento). Teste:

```bash
curl https://siscr-sefaz-bridge.lucaspercisi.workers.dev/health
```

### Deploy manual (opcional, exige Docker local)

```bash
cd apps/sefaz-bridge
pnpm deploy
```

## Contrato HTTP

```
POST /
Content-Type: application/soap+xml|application/xml|text/xml; charset=utf-8
X-Sefaz-Url: https://…   (ou X-Target-Url — alias para NFS-e / Sefin Nacional)
X-Pfx-Base64: <PKCS#12 em base64>
X-Pfx-Password: <senha do pfx>
Accept: (opcional)
SOAPAction: (opcional — Paulistana)
Authorization: Bearer <BRIDGE_TOKEN>
```

Body = envelope SOAP (SEFAZ / Paulistana) ou XML REST (Sistema Nacional NFS-e).
Resposta = status/corpo do destino.

`GET /health` → `{ "ok": true }`.

A mesma ponte atende NF-e (SEFAZ) e NFS-e (Paulistana + Sefin Nacional) via mTLS com o A1 do tenant.

## Cadastrar no SISCR

1. Configurações → Conexões → Nova conexão  
2. Tipo: **Ponte SEFAZ DFe / NF-e (mTLS)**  
3. Nome: `sefaz-dfe`  
4. URL base: URL pública do Worker da ponte  
5. Auth: **Bearer token** = mesmo `BRIDGE_TOKEN`  
6. Ativa

## Rodar só o Node (debug local)

```bash
cd apps/sefaz-bridge
cp .env.example .env
pnpm start
```

O certificado A1 **não** fica gravado na ponte: a API envia o `.pfx` só no momento da chamada.

## TLS / ICP-Brasil

Webservices SEFAZ (ex. SP) usam SSL da cadeia **ICP-Brasil**, fora do Mozilla CA do Node.
A imagem inclui `certs/icp-brasil-https-cas.pem` (AC Soluti SSL EV + Raiz v10).

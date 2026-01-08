# Instalar Stripe CLI no Windows

## Método 1: Via Scoop (Recomendado)

### 1. Instalar Scoop (se ainda não tiver)

Abra o PowerShell como Administrador e execute:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### 2. Instalar Stripe CLI via Scoop

```powershell
scoop install stripe
```

### 3. Verificar instalação

```powershell
stripe --version
```

## Método 2: Download Manual

### 1. Baixar o binário

Acesse: https://github.com/stripe/stripe-cli/releases/latest

Baixe o arquivo `stripe_X.X.X_windows_x86_64.zip` (ou a versão mais recente)

### 2. Extrair e adicionar ao PATH

1. Extraia o arquivo ZIP
2. Copie o executável `stripe.exe` para uma pasta (ex: `C:\Program Files\Stripe\`)
3. Adicione a pasta ao PATH do Windows:
   - Abra "Variáveis de Ambiente" (procure no menu Iniciar)
   - Em "Variáveis do sistema", encontre `Path`
   - Clique em "Editar"
   - Clique em "Novo" e adicione o caminho da pasta (ex: `C:\Program Files\Stripe\`)
   - Clique em "OK" em todas as janelas

### 3. Verificar instalação

Abra um novo PowerShell e execute:

```powershell
stripe --version
```

## Método 3: Via Chocolatey (se tiver instalado)

```powershell
choco install stripe-cli
```

---

## Após Instalar

### 1. Fazer login no Stripe

```powershell
stripe login
```

Isso abrirá o navegador para autenticar.

### 2. Iniciar escuta de webhooks

```powershell
stripe listen --forward-to localhost:8000/api/webhooks/stripe/
```

Você verá algo como:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

### 3. Copiar o webhook secret (opcional)

Se quiser validar a assinatura dos webhooks, copie o secret (`whsec_...`) e adicione ao `docker-compose.yml`:

```yaml
environment:
  - STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxxxxxxxxxx
```

**Nota:** Em desenvolvimento, o código aceita webhooks sem validação se o secret não estiver configurado.

---

## Testar

Após iniciar o `stripe listen`, faça um pagamento de teste. Você deve ver:

1. **No terminal do Stripe CLI:**
   ```
   > 2025-12-20 00:47:17   --> checkout.session.completed [evt_xxxxx]
   > 2025-12-20 00:47:17  <--  [200] POST http://localhost:8000/api/webhooks/stripe/ [evt_xxxxx]
   ```

2. **Nos logs do Docker:**
   ```
   [WEBHOOK] Requisição recebida de 127.0.0.1
   [WEBHOOK] ✅ Evento recebido: checkout.session.completed (ID: evt_xxx)
   [WEBHOOK] [checkout.session.completed] ✅ Status alterado de 'pending' para 'active'
   ```

---

## Solução Alternativa (Sem Stripe CLI)

Se não conseguir instalar o Stripe CLI agora, você pode:

1. **Atualizar manualmente via Django Admin:**
   - Acesse `http://localhost:8000/admin/subscriptions/subscription/`
   - Encontre a subscription pendente
   - Altere o status de `pending` para `active`

2. **Ou criar um comando de gerenciamento** para atualizar subscriptions pendentes (vou criar isso se necessário)

---

## Troubleshooting

### "stripe não é reconhecido como comando"

- Certifique-se de que instalou o Stripe CLI
- Feche e reabra o PowerShell
- Verifique se o PATH está configurado corretamente

### "Erro ao fazer login"

- Certifique-se de ter uma conta Stripe
- Tente `stripe login --interactive` para login manual

### "Webhooks não estão chegando"

- Verifique se o `stripe listen` está rodando
- Verifique se a URL está correta: `localhost:8000/api/webhooks/stripe/`
- Verifique se o Docker está rodando na porta 8000


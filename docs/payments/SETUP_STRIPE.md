# ⚡ Setup Rápido do Stripe para Testes

## 📝 Passo a Passo

### 1. Criar arquivo `.env` na raiz do projeto

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

### 2. Editar `.env` e adicionar suas chaves do Stripe

Abra o arquivo `.env` e adicione suas chaves:

```env
STRIPE_SECRET_KEY_TEST=sk_test_...  # Sua chave secreta do Stripe
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...  # Sua chave pública do Stripe
STRIPE_MODE=test
```

**⚠️ IMPORTANTE**: Obtenha suas chaves no [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) e configure-as no arquivo `.env` (não commite o arquivo `.env` no repositório).

### 3. Reiniciar containers

```bash
docker-compose down
docker-compose up -d
```

### 4. Configurar planos com Price IDs

```bash
docker-compose exec web python manage.py update_stripe_price_ids
```

### 5. Testar!

1. Acesse http://localhost:5173/plans
2. Faça login
3. Clique em "🧪 Teste Rápido - Checkout Pro (Mensal)"
4. Será redirecionado para Stripe Checkout
5. Use cartão de teste: `4242 4242 4242 4242`

---

**⚠️ IMPORTANTE**: O arquivo `.env` está no `.gitignore` e não será commitado. Isso é seguro!

---

**Última atualização**: 2025-01-27


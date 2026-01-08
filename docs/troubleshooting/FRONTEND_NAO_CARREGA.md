# Frontend Não Carrega - Guia de Diagnóstico

## ✅ Verificações Rápidas

### 1. Frontend está rodando?
```bash
# Windows
netstat -ano | findstr :5173

# Se não estiver rodando, inicie manualmente:
cd frontend
npm run dev
```

### 2. Acesse a URL correta
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000

### 3. Verifique o Console do Navegador
1. Abra o DevTools (F12)
2. Vá para a aba "Console"
3. Procure por erros em vermelho

### 4. Verifique a Aba "Network"
1. Abra o DevTools (F12)
2. Vá para a aba "Network"
3. Recarregue a página (F5)
4. Verifique se há requisições falhando (vermelho)

## 🔍 Problemas Comuns

### Erro: "Failed to resolve import"
- **Causa**: Dependência não instalada ou import incorreto
- **Solução**: 
  ```bash
  cd frontend
  npm install
  ```

### Erro: "Cannot GET /"
- **Causa**: Rota não encontrada
- **Solução**: Verifique se está acessando http://localhost:5173 (não /home ou outra rota)

### Página em branco
- **Causa**: Erro JavaScript não tratado
- **Solução**: 
  1. Abra o Console (F12)
  2. Procure por erros
  3. Verifique se há erros de importação

### Backend não responde
- **Causa**: Backend não está rodando ou porta diferente
- **Solução**: 
  1. Verifique se o Docker está rodando: `docker-compose ps`
  2. Verifique os logs: `docker-compose logs web`
  3. Acesse http://localhost:8000/admin/ para testar

## 🚀 Reiniciar Frontend

Se o frontend não estiver respondendo:

1. **Pare o servidor atual**:
   - Na janela do CMD onde está rodando, pressione `Ctrl+C`

2. **Limpe o cache**:
   ```bash
   cd frontend
   rm -rf node_modules/.vite  # Linux/Mac
   rmdir /s node_modules\.vite  # Windows
   ```

3. **Reinstale dependências** (se necessário):
   ```bash
   cd frontend
   npm install
   ```

4. **Inicie novamente**:
   ```bash
   npm run dev
   ```

## 📝 Verificar Logs do Vite

O servidor Vite mostra erros no terminal onde está rodando. Verifique:
- Erros de compilação
- Erros de importação
- Avisos sobre dependências

## 🔗 URLs Importantes

- **Home (não autenticado)**: http://localhost:5173/
- **Login**: http://localhost:5173/login
- **App (após login)**: http://localhost:5173/app
- **Admin Django**: http://localhost:8000/admin/
- **API Docs**: http://localhost:8000/api/docs/

## 💡 Dica

Se nada funcionar, tente:
1. Fechar todas as janelas do navegador
2. Limpar o cache do navegador (Ctrl+Shift+Delete)
3. Abrir em modo anônimo/privado
4. Acessar http://localhost:5173 novamente


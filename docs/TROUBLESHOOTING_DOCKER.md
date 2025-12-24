# 🔧 Troubleshooting Docker - Erros Comuns

## ❌ Erro: "error during connect: open //./pipe/dockerDesktopLinuxEngine"

Este erro aparece quando alguma ferramenta tenta se conectar ao Docker, mas o Docker Desktop não está rodando ou não está totalmente inicializado.

### 🔍 Causas Comuns

1. **Docker Desktop não está rodando**
2. **Docker Desktop está iniciando** (ainda não totalmente pronto)
3. **Extensões de IDE** (VS Code, PyCharm, etc.) tentando se conectar
4. **Scripts ou processos** tentando acessar Docker repetidamente

### ✅ Soluções

#### 1. Verificar se Docker Desktop está rodando

**Windows PowerShell:**
```powershell
Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
```

Se não aparecer nada, o Docker Desktop não está rodando.

#### 2. Reiniciar Docker Desktop

**Windows PowerShell:**
```powershell
# Parar Docker Desktop
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue

# Aguardar alguns segundos
Start-Sleep -Seconds 5

# Iniciar Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Aguardar inicialização (30-60 segundos)
Write-Host "Aguardando Docker Desktop inicializar..."
Start-Sleep -Seconds 30

# Verificar se está funcionando
docker ps
```

#### 3. Verificar se Docker está acessível

```bash
docker ps
```

Se funcionar, o Docker está OK. Se der erro, aguarde mais alguns segundos e tente novamente.

#### 4. Verificar extensões de IDE

Se você está usando **VS Code** ou **PyCharm**, verifique se há extensões Docker instaladas que podem estar tentando se conectar:

**VS Code:**
- Extensão "Docker" da Microsoft
- Extensão "Remote - Containers"

**Solução:** Desabilite temporariamente essas extensões ou aguarde o Docker inicializar completamente.

#### 5. Verificar processos que podem estar causando o problema

**Windows PowerShell:**
```powershell
# Ver processos Docker
Get-Process | Where-Object {$_.ProcessName -like "*docker*"}

# Ver processos que podem estar tentando se conectar
Get-Process | Where-Object {$_.ProcessName -like "*compose*"}
```

#### 6. Limpar containers e volumes (se necessário)

Se o problema persistir, pode ser necessário limpar containers:

```bash
# Parar todos os containers
docker-compose down

# Remover containers parados
docker container prune -f

# Se necessário, remover volumes também (CUIDADO: apaga dados!)
docker-compose down -v
```

### 🚨 Erros Repetitivos (3 por segundo)

Se você está vendo erros repetitivos como:

```
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/..."
```

Isso geralmente significa que:

1. **Uma extensão de IDE está tentando se conectar repetidamente**
   - Solução: Feche e reabra o IDE, ou desabilite extensões Docker

2. **Um script está rodando em loop**
   - Solução: Verifique se há scripts `.bat` ou `.ps1` rodando

3. **Docker Desktop está com problema**
   - Solução: Reinicie o Docker Desktop completamente

### 🔄 Reiniciar Docker Desktop Completamente

**Passo a passo:**

1. **Fechar Docker Desktop:**
   ```powershell
   Stop-Process -Name "Docker Desktop" -Force
   ```

2. **Aguardar 10 segundos**

3. **Abrir Docker Desktop manualmente** ou via:
   ```powershell
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   ```

4. **Aguardar até o ícone do Docker na bandeja do sistema ficar verde** (geralmente 30-60 segundos)

5. **Verificar se está funcionando:**
   ```bash
   docker ps
   ```

### 📝 Prevenção

Para evitar esses erros:

1. **Sempre aguarde o Docker Desktop inicializar completamente** antes de executar comandos Docker
2. **Feche extensões Docker do IDE** se não estiver usando
3. **Use scripts que verificam se Docker está rodando** antes de tentar conectar

### 🆘 Se Nada Funcionar

1. **Reinstalar Docker Desktop:**
   - Desinstale completamente
   - Baixe a versão mais recente
   - Reinstale

2. **Verificar logs do Docker Desktop:**
   - Abra Docker Desktop
   - Vá em Settings > Troubleshoot
   - Clique em "View logs"

3. **Verificar se há conflitos de firewall/antivírus:**
   - Alguns antivírus podem bloquear a conexão do Docker

---

**Última atualização:** 2025-01-15


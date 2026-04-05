# Gera teste-a1.pfx (autoassinado) apenas para testar upload no Siscr — nao e ICP-Brasil.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here "teste-a1.pfx"
$passwordPlain = "teste123"

if (Test-Path $out) { Remove-Item $out -Force }

$pwd = ConvertTo-SecureString -String $passwordPlain -Force -AsPlainText
$cert = New-SelfSignedCertificate `
  -Subject "CN=SISCR Teste Upload" `
  -DnsName "teste-siscr.local" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy Exportable `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(1) `
  -HashAlgorithm SHA256

try {
  Export-PfxCertificate -Cert $cert -FilePath $out -Password $pwd | Out-Null
  Write-Host "OK: $out"
  Write-Host "Senha: $passwordPlain"
}
finally {
  Remove-Item -Path $cert.PSPath -ErrorAction SilentlyContinue
}

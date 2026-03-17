# Genera un certificado autofirmado con SAN para localhost y las IPs de esta PC,
# lo instala como TRUSTED en el Root store del usuario (Chrome/Edge lo confían automáticamente)
# y exporta dev-cert.pfx para que Kestrel lo use en https://TU_IP:5042
# Ejecutar UNA vez como Administrador: .\scripts\create-dev-cert.ps1

$certPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\dev-cert.pfx")
$password = "SmartMenuDev"

# SAN: localhost + 172.31.98.104 + todas las IPs locales detectadas automáticamente
$sanParts = @("DNS=localhost", "DNS=127.0.0.1", "IPAddress=127.0.0.1", "IPAddress=::1", "IPAddress=172.31.98.104")
try {
    $addrs = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object { $_.AddressFamily -eq "InterNetwork" -and $_.ToString() -ne "127.0.0.1" }
    foreach ($a in $addrs) { $sanParts += "IPAddress=$($a.ToString())" }
} catch { }
try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -and $_.IPAddress -ne "127.0.0.1" } |
        ForEach-Object { $sanParts += "IPAddress=$($_.IPAddress)" }
} catch { }
$sanParts = $sanParts | Select-Object -Unique
$san = "2.5.29.17={text}$($sanParts -join '&')"

Write-Host "Creando certificado con SAN: $($sanParts -join ', ')"

# Crear en My store
$cert = New-SelfSignedCertificate -Subject "CN=SmartMenu Dev" -TextExtension $san `
    -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(2) `
    -KeyUsage DigitalSignature, KeyEncipherment

$certThumb = $cert.Thumbprint
$securePass = ConvertTo-SecureString -String $password -Force -AsPlainText

# Exportar PFX para Kestrel
$store = Get-Item "Cert:\CurrentUser\My\$certThumb"
Export-PfxCertificate -Cert $store -FilePath $certPath -Password $securePass | Out-Null
Write-Host "Certificado PFX guardado en: $certPath"

# Instalar en Root (Trusted Root Certification Authorities) para que Chrome/Edge confíen en él
try {
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()
    Write-Host "Certificado instalado como TRUSTED en Root store del usuario."
    Write-Host "Chrome y Edge confiarán en el certificado sin advertencias."
} catch {
    Write-Warning "No se pudo instalar en Root store: $_"
    Write-Warning "Es posible que debas aceptar manualmente el certificado en el navegador."
}

# Limpiar de My store (ya no es necesario ahí)
Remove-Item "Cert:\CurrentUser\My\$certThumb" -Force

Write-Host ""
Write-Host "LISTO. Pasos siguientes:"
Write-Host "  1. Reinicia la API:  cd src\backend\SmartMenu.API && dotnet run"
Write-Host "  2. En Chrome/Edge visita https://172.31.98.104:5042 una vez y verifica que no hay advertencia"
Write-Host "  3. Las notificaciones SignalR del Waiter App ya deberían funcionar"

# Genera un certificado autofirmado con SAN para localhost y las IPs de esta PC.
# Así el navegador no muestra ERR_CERT_COMMON_NAME_INVALID al usar https://TU_IP:5042
# Ejecutar una vez: .\scripts\create-dev-cert.ps1

# Ruta a dev-cert.pfx en la carpeta de la API (un nivel arriba de scripts)
$certPath = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\dev-cert.pfx")
$password = "SmartMenuDev"

# SAN: localhost + IP de acceso (172.31.98.54) + todas las IPs locales para que https://TU_IP:5042 no dé ERR_CERT_COMMON_NAME_INVALID
$sanParts = @("DNS=localhost", "DNS=127.0.0.1", "IPAddress=127.0.0.1", "IPAddress=::1", "IPAddress=172.31.98.54")
try {
    $addrs = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq "InterNetwork" -and $_.ToString() -ne "127.0.0.1" }
    foreach ($a in $addrs) { $sanParts += "IPAddress=$($a.ToString())" }
} catch { }
try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -and $_.IPAddress -ne "127.0.0.1" } | ForEach-Object {
        $sanParts += "IPAddress=$($_.IPAddress)"
    }
} catch { }
$sanParts = $sanParts | Select-Object -Unique
$san = "2.5.29.17={text}$($sanParts -join '&')"

Write-Host "Creando certificado con SAN: $($sanParts -join ', ')"
$cert = New-SelfSignedCertificate -Subject "CN=SmartMenu Dev" -TextExtension $san `
    -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1) -KeyUsage DigitalSignature, KeyEncipherment

$certThumb = $cert.Thumbprint
$store = Get-Item "Cert:\CurrentUser\My\$certThumb"
$securePass = ConvertTo-SecureString -String $password -Force -AsPlainText
Export-PfxCertificate -Cert $store -FilePath $certPath -Password $securePass | Out-Null
Remove-Item "Cert:\CurrentUser\My\$certThumb" -Force

Write-Host "Certificado guardado en: $certPath"
Write-Host "Reinicia la API (dotnet run). En el navegador, la primera vez acepta el aviso del certificado en https://TU_IP:5042"

$ErrorActionPreference = 'Stop'

function Ensure-FirewallRule {
    param(
        [string]$DisplayName,
        [int]$Port,
        [string[]]$Profiles = @('Private')
    )

    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Vorhanden: $DisplayName"
        return
    }

    New-NetFirewallRule \
        -DisplayName $DisplayName \
        -Direction Inbound \
        -Action Allow \
        -Protocol TCP \
        -LocalPort $Port \
        -Profile $Profiles | Out-Null

    Write-Host "Freigegeben: $DisplayName (TCP $Port)"
}

Ensure-FirewallRule -DisplayName 'BauPass HTTP 8000' -Port 8000
Ensure-FirewallRule -DisplayName 'BauPass HTTPS 8443' -Port 8443

Write-Host 'Firewall-Regeln fertig.'
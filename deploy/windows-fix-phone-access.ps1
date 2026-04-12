$ErrorActionPreference = 'Stop'

$profiles = Get-NetConnectionProfile
foreach ($profile in $profiles) {
    if ($profile.NetworkCategory -ne 'Private') {
        Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
        Write-Host "Netzwerk auf Private gesetzt: $($profile.Name)"
    }
    else {
        Write-Host "Netzwerk bereits Private: $($profile.Name)"
    }
}

function Ensure-FirewallRule {
    param(
        [string]$DisplayName,
        [int]$Port
    )

    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule \
            -DisplayName $DisplayName \
            -Direction Inbound \
            -Action Allow \
            -Protocol TCP \
            -LocalPort $Port \
            -Profile Private | Out-Null
        Write-Host "Firewall freigegeben: $DisplayName"
    }
    else {
        Write-Host "Firewallregel vorhanden: $DisplayName"
    }
}

Ensure-FirewallRule -DisplayName 'BauPass HTTP 8000' -Port 8000
Ensure-FirewallRule -DisplayName 'BauPass HTTPS 8443' -Port 8443

Write-Host 'Telefon-Zugriff vorbereitet.'
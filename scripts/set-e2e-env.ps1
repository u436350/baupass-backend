param(
    [switch]$RunTests
)

$env:E2E_SUPERADMIN_USERNAME = "e2e_superadmin"
$env:E2E_SUPERADMIN_PASSWORD = "E2Epass!123"
$env:E2E_SUPERADMIN2_USERNAME = "e2e_superadmin2"
$env:E2E_SUPERADMIN2_PASSWORD = "E2Epass!456"

Write-Host "E2E environment variables set for this PowerShell session." -ForegroundColor Green
Write-Host "E2E_SUPERADMIN_USERNAME=$env:E2E_SUPERADMIN_USERNAME"
Write-Host "E2E_SUPERADMIN2_USERNAME=$env:E2E_SUPERADMIN2_USERNAME"

if ($RunTests) {
    $npmCmd = "C:\Program Files\nodejs\npm.cmd"
    if (-not (Test-Path $npmCmd)) {
        Write-Error "npm.cmd not found at '$npmCmd'."
        exit 1
    }

    & $npmCmd run test:e2e:all
    exit $LASTEXITCODE
}

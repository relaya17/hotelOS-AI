# Deploy HotelOS: 4 Vercel projects (API + executive + admin + guest).
# Prereq: npx vercel@41.7.0 login   AND Turso + JWT env vars in this shell.
#
#   $env:DATABASE_URL="libsql://..."
#   $env:DATABASE_AUTH_TOKEN="..."
#   $env:JWT_ACCESS_SECRET="..."   # min 16 chars
#   $env:JWT_REFRESH_SECRET="..."
#   ./scripts/deploy-four-vercel.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Suffix = if ($env:HOTELOS_VERCEL_SUFFIX) { $env:HOTELOS_VERCEL_SUFFIX } else { "eight" }

function Require-Env([string]$Name) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
    throw "Missing env var: $Name"
  }
}

Require-Env "DATABASE_URL"
Require-Env "DATABASE_AUTH_TOKEN"
Require-Env "JWT_ACCESS_SECRET"
Require-Env "JWT_REFRESH_SECRET"

function Vercel([string[]]$Args) {
  & npx --yes vercel@41.7.0 @Args
  if ($LASTEXITCODE -ne 0) { throw "vercel $($Args -join ' ') failed ($LASTEXITCODE)" }
}

function Set-VercelEnv([string]$Key, [string]$Value, [string]$ProjectDir) {
  Push-Location $ProjectDir
  try {
    # Remove old value if present (ignore errors)
    echo "y" | npx --yes vercel@41.7.0 env rm $Key production --yes 2>$null | Out-Null
    $Value | npx --yes vercel@41.7.0 env add $Key production 2>&1 | Out-Host
  } finally {
    Pop-Location
  }
}

$apiName = "hotel-os-ai-api-$Suffix"
$apiUrl = "https://$apiName.vercel.app"
$apps = @(
  @{ Name = $apiName; Rel = "apps\api"; Kind = "api" },
  @{ Name = "hotel-os-ai-executive-$Suffix"; Rel = "apps\executive"; Kind = "web" },
  @{ Name = "hotel-os-ai-admin-$Suffix"; Rel = "apps\admin"; Kind = "web" },
  @{ Name = "hotel-os-ai-guest-$Suffix"; Rel = "apps\guest"; Kind = "web" }
)

Write-Host "Target API: $apiUrl" -ForegroundColor Green

foreach ($app in $apps) {
  $dir = Join-Path $Root $app.Rel
  Write-Host "`n=== $($app.Name) ===" -ForegroundColor Cyan
  Push-Location $dir
  try {
    Vercel @("link", "--yes", "--project", $app.Name)
    if ($app.Kind -eq "api") {
      Pop-Location
      Set-VercelEnv "DATABASE_URL" $env:DATABASE_URL $dir
      Set-VercelEnv "DATABASE_AUTH_TOKEN" $env:DATABASE_AUTH_TOKEN $dir
      Set-VercelEnv "JWT_ACCESS_SECRET" $env:JWT_ACCESS_SECRET $dir
      Set-VercelEnv "JWT_REFRESH_SECRET" $env:JWT_REFRESH_SECRET $dir
      Set-VercelEnv "CORS_ORIGINS" "https://*.vercel.app" $dir
      Set-VercelEnv "NODEJS_HELPERS" "0" $dir
      Set-VercelEnv "NODE_ENV" "production" $dir
      Push-Location $dir
    } else {
      # optional explicit API origin for middleware override
      Pop-Location
      Set-VercelEnv "HOTELOS_API_ORIGIN" $apiUrl $dir
      Push-Location $dir
    }
    Vercel @("--prod", "--yes")
  } finally {
    Pop-Location
  }
}

Write-Host "`nVerify API health:" -ForegroundColor Green
Write-Host "  $apiUrl/health"
Write-Host "Admin: https://hotel-os-ai-admin-$Suffix.vercel.app"

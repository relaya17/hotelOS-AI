# Deploy HotelOS: 4 Vercel projects (API + executive + admin + guest).
#
# 1) Fill secrets in apps/api/.env  (copy from apps/api/.env.example)
# 2) npx vercel@41.7.0 login
# 3) ./scripts/deploy-four-vercel.ps1
#
# The script reads DATABASE_* and JWT_* from apps/api/.env — no need to
# paste $env:... in the shell unless you want to override.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Suffix = if ($env:HOTELOS_VERCEL_SUFFIX) { $env:HOTELOS_VERCEL_SUFFIX } else { "eight" }
$ApiEnvFile = Join-Path $Root "apps\api\.env"

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Missing $Path — copy apps/api/.env.example to apps/api/.env and fill Turso + JWT."
  }
  Get-Content $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $key = $line.Substring(0, $i).Trim()
    $val = $line.Substring($i + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $val, "Process")
  }
}

Import-DotEnv $ApiEnvFile

function Require-Env([string]$Name) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
    throw "Missing $Name in apps/api/.env"
  }
}

Require-Env "DATABASE_URL"
Require-Env "DATABASE_AUTH_TOKEN"
Require-Env "JWT_ACCESS_SECRET"
Require-Env "JWT_REFRESH_SECRET"

if ($env:DATABASE_URL -notlike "libsql://*") {
  throw "DATABASE_URL in apps/api/.env must be a Turso libsql:// URL for Vercel (not file:)."
}

function Invoke-Vercel([string[]]$VercelArgs) {
  & npx --yes vercel@41.7.0 @VercelArgs
  if ($LASTEXITCODE -ne 0) { throw "vercel failed: $($VercelArgs -join ' ')" }
}

function Set-VercelEnv([string]$Key, [string]$Value, [string]$ProjectDir) {
  Push-Location $ProjectDir
  try {
    npx --yes vercel@41.7.0 env rm $Key production --yes 2>$null | Out-Null
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

Write-Host "Loaded secrets from apps/api/.env" -ForegroundColor Green
Write-Host "Target API: $apiUrl"

foreach ($app in $apps) {
  $dir = Join-Path $Root $app.Rel
  Write-Host "`n=== $($app.Name) ===" -ForegroundColor Cyan
  Push-Location $dir
  try {
    Invoke-Vercel @("link", "--yes", "--project", $app.Name)
  } finally {
    Pop-Location
  }

  if ($app.Kind -eq "api") {
    Set-VercelEnv "DATABASE_URL" $env:DATABASE_URL $dir
    Set-VercelEnv "DATABASE_AUTH_TOKEN" $env:DATABASE_AUTH_TOKEN $dir
    Set-VercelEnv "JWT_ACCESS_SECRET" $env:JWT_ACCESS_SECRET $dir
    Set-VercelEnv "JWT_REFRESH_SECRET" $env:JWT_REFRESH_SECRET $dir
    Set-VercelEnv "CORS_ORIGINS" "https://*.vercel.app" $dir
    Set-VercelEnv "NODEJS_HELPERS" "0" $dir
    Set-VercelEnv "NODE_ENV" "production" $dir
  } else {
    Set-VercelEnv "HOTELOS_API_ORIGIN" $apiUrl $dir
  }

  Push-Location $dir
  try {
    Invoke-Vercel @("--prod", "--yes")
  } finally {
    Pop-Location
  }
}

Write-Host "`nVerify: $apiUrl/health" -ForegroundColor Green
Write-Host "Admin: https://hotel-os-ai-admin-$Suffix.vercel.app"

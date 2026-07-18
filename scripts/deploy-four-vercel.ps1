# Deploy HotelOS: 4 Vercel projects (API + executive + admin + guest).
#
# Deploy FROM monorepo root (not apps/*) so packages/* are uploaded.
# Each Vercel project has rootDirectory = apps/<name>.
#
# 1) Fill secrets in apps/api/.env
# 2) Set VERCEL_TOKEN or run: npx vercel@latest login
# 3) ./scripts/deploy-four-vercel.ps1

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Suffix = if ($env:HOTELOS_VERCEL_SUFFIX) { $env:HOTELOS_VERCEL_SUFFIX } else { "eight" }
$ApiEnvFile = Join-Path $Root "apps\api\.env"

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Missing $Path - copy apps/api/.env.example to apps/api/.env and fill Turso + JWT."
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

if ([string]::IsNullOrWhiteSpace($env:VERCEL_TOKEN)) {
  throw "Set VERCEL_TOKEN first (or export it in this shell)."
}

$Headers = @{
  Authorization = "Bearer $($env:VERCEL_TOKEN)"
  "Content-Type" = "application/json"
}

function Invoke-Vercel([string[]]$VercelArgs) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & npx --yes vercel@latest @VercelArgs --token $env:VERCEL_TOKEN 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { throw "vercel failed: $($VercelArgs -join ' ')" }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-VercelProjectId([string]$Name) {
  $p = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$Name" -Headers $Headers
  return $p.id
}

function Set-VercelRootDirectory([string]$Name, [string]$RootDirectory) {
  $id = Get-VercelProjectId $Name
  $body = @{ rootDirectory = $RootDirectory } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "https://api.vercel.com/v9/projects/$id" -Headers $Headers -Body $body | Out-Null
  Write-Host "rootDirectory=$RootDirectory for $Name"
}

function Set-VercelEnvApi([string]$ProjectName, [string]$Key, [string]$Value) {
  $id = Get-VercelProjectId $ProjectName
  # Remove existing production value if present (ignore errors).
  try {
    $envs = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$id/env" -Headers $Headers
    foreach ($e in $envs.envs) {
      if ($e.key -eq $Key -and ($e.target -contains "production")) {
        Invoke-RestMethod -Method Delete -Uri "https://api.vercel.com/v9/projects/$id/env/$($e.id)" -Headers $Headers | Out-Null
      }
    }
  } catch { }
  $body = @{
    key = $Key
    value = $Value
    type = "sensitive"
    target = @("production")
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "https://api.vercel.com/v10/projects/$id/env" -Headers $Headers -Body $body | Out-Null
  Write-Host "env $Key -> $ProjectName"
}

$apiName = "hotel-os-ai-api-$Suffix"
$apiUrl = "https://$apiName.vercel.app"
$apps = @(
  @{ Name = $apiName; RootDir = "apps/api"; Kind = "api" },
  @{ Name = "hotel-os-ai-executive-$Suffix"; RootDir = "apps/executive"; Kind = "web" },
  @{ Name = "hotel-os-ai-admin-$Suffix"; RootDir = "apps/admin"; Kind = "web" },
  @{ Name = "hotel-os-ai-guest-$Suffix"; RootDir = "apps/guest"; Kind = "web" }
)

Write-Host "Loaded secrets from apps/api/.env" -ForegroundColor Green
Write-Host "Deploying from monorepo root: $Root"
Write-Host "Target API: $apiUrl"

$vercelDir = Join-Path $Root ".vercel"

foreach ($app in $apps) {
  Write-Host "`n=== $($app.Name) ===" -ForegroundColor Cyan

  # Ensure project exists by linking once from its app folder (creates project if needed).
  $appAbs = Join-Path $Root ($app.RootDir -replace "/", "\")
  Push-Location $appAbs
  try {
    Invoke-Vercel @("link", "--yes", "--project", $app.Name)
  } finally {
    Pop-Location
  }

  Set-VercelRootDirectory $app.Name $app.RootDir

  if ($app.Kind -eq "api") {
    Set-VercelEnvApi $app.Name "DATABASE_URL" $env:DATABASE_URL
    Set-VercelEnvApi $app.Name "DATABASE_AUTH_TOKEN" $env:DATABASE_AUTH_TOKEN
    Set-VercelEnvApi $app.Name "JWT_ACCESS_SECRET" $env:JWT_ACCESS_SECRET
    Set-VercelEnvApi $app.Name "JWT_REFRESH_SECRET" $env:JWT_REFRESH_SECRET
    Set-VercelEnvApi $app.Name "CORS_ORIGINS" "https://*.vercel.app"
    Set-VercelEnvApi $app.Name "NODEJS_HELPERS" "0"
  } else {
    Set-VercelEnvApi $app.Name "HOTELOS_API_ORIGIN" $apiUrl
  }

  # Deploy from monorepo root so packages/* + pnpm-workspace are uploaded.
  if (Test-Path $vercelDir) { Remove-Item -Recurse -Force $vercelDir }
  New-Item -ItemType Directory -Path $vercelDir | Out-Null
  $projectJson = Get-Content (Join-Path $appAbs ".vercel\project.json") -Raw
  Set-Content -Path (Join-Path $vercelDir "project.json") -Value $projectJson -Encoding UTF8

  Invoke-Vercel @("deploy", "--prod", "--yes", "--archive=tgz")
}

Write-Host "`nVerify: $apiUrl/health" -ForegroundColor Green
Write-Host "Admin: https://hotel-os-ai-admin-$Suffix.vercel.app"

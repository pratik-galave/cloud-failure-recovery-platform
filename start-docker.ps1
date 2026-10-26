# FaultLens: Launch Containerized System via Docker Compose
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting FaultLens Multi-Container Orchestration (Docker) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Test if Docker daemon is running
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not running"
    }
} catch {
    Write-Host "`n[ERROR] Docker Desktop is installed, but the Docker daemon is not running!" -ForegroundColor Red
    Write-Host "Please start 'Docker Desktop' from your Windows Start Menu, wait 30 seconds, and run this script again." -ForegroundColor Yellow
    Write-Host "Alternative: To run without Docker right now, execute: .\start-local.ps1" -ForegroundColor Green
    exit 1
}

Write-Host "Building and launching containers..." -ForegroundColor Green
docker compose up --build

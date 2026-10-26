# FaultLens: Launch All Services Locally (Zero Docker Requirement)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting FaultLens Platform in Local Development Mode    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseDir = $PSScriptRoot

# 1. Start Target Service (Port 5001)
Write-Host "[1/3] Launching Target Microservice on Port 5001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\target-service'; npm start"

# 2. Start Auditor Backend (Port 5000)
Write-Host "[2/3] Launching Auditor Backend Engine on Port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\auditor-backend'; npm start"

# 3. Start Dashboard (Port 5173)
Write-Host "[3/3] Launching React Dashboard on Port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\dashboard'; npm run dev"

Start-Sleep -Seconds 3
Write-Host "`nAll 3 services launched successfully!" -ForegroundColor Green
Write-Host "Opening Dashboard: http://localhost:5173" -ForegroundColor Cyan
Start-Process "http://localhost:5173"

#!/bin/bash
# ==============================================================================
# FaultLens Cloud Deployment Script (Ubuntu / Amazon Linux EC2)
# ==============================================================================

set -e

echo "=== 1. Updating System Packages ==="
sudo apt-get update -y || sudo yum update -y

echo "=== 2. Installing Docker & Docker Compose Plugin ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker installed successfully."
fi

# Ensure Docker service is running
sudo systemctl enable docker
sudo systemctl start docker

echo "=== 3. Configuring Environment Variables ==="
if [ ! -f .env ]; then
    cp .env.example .env
    # Auto-detect public IP of the EC2 instance
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me || echo "localhost")
    sed -i "s|http://localhost:5000/api|http://${PUBLIC_IP}:5000/api|g" .env
    echo "Configured VITE_API_BASE to http://${PUBLIC_IP}:5000/api"
fi

echo "=== 4. Building and Launching Docker Containers ==="
docker compose down || true
docker compose up -d --build

echo "=== 5. Deployment Completed Successfully! ==="
docker compose ps

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me || echo "localhost")
echo ""
echo "================================================================="
echo "  FaultLens is now running live on Cloud VM:"
echo "  - Operations Dashboard:  http://${PUBLIC_IP}:5173"
echo "  - Auditor API Engine:    http://${PUBLIC_IP}:5000/api/health"
echo "  - Target Microservice:   http://${PUBLIC_IP}:5001/health"
echo "================================================================="
echo "Note: Ensure your Cloud Security Group allows Inbound TCP on ports 5173, 5000, 5001."

Write-Host ""
Write-Host "🚀 Starting FeetOnFocus Development Server..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start the server
Write-Host "🌐 Starting server on http://localhost:8080..." -ForegroundColor Yellow
Write-Host ""

node server.js
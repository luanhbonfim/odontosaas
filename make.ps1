#!/usr/bin/env pwsh
# ==========================================================================
# OdontoSaaS — atalhos de desenvolvimento no Windows (equivalente ao Makefile)
# Uso:  .\make.ps1 <alvo>          Ex.: .\make.ps1 up   |   .\make.ps1 logs
# Requer o Docker Desktop no PATH (docker compose).
# ==========================================================================
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target = "help",

    # Argumentos extras repassados ao comando (ex.: .\make.ps1 logs web)
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = "Stop"

# Mapa alvo -> (descrição, scriptblock)
$Targets = [ordered]@{
    "build"           = @{ desc = "Constrói as imagens Docker";        run = { docker compose build @Rest } }
    "up"              = @{ desc = "Sobe todos os serviços (background)"; run = { docker compose up -d @Rest } }
    "down"            = @{ desc = "Derruba os serviços (mantém volumes)"; run = { docker compose down @Rest } }
    "restart"         = @{ desc = "Reinicia os serviços";              run = { docker compose restart @Rest } }
    "logs"            = @{ desc = "Segue os logs (opcional: serviço)"; run = { docker compose logs -f @Rest } }
    "ps"              = @{ desc = "Mostra o status dos serviços";      run = { docker compose ps @Rest } }
    "migrate"         = @{ desc = "Aplica as migrations do Django";    run = { docker compose run --rm web python manage.py migrate @Rest } }
    "makemigrations"  = @{ desc = "Gera novas migrations";             run = { docker compose run --rm web python manage.py makemigrations @Rest } }
    "shell"           = @{ desc = "Abre o shell do Django";            run = { docker compose run --rm web python manage.py shell } }
    "createsuperuser" = @{ desc = "Cria um superusuário";             run = { docker compose run --rm web python manage.py createsuperuser } }
    "test"            = @{ desc = "Roda a suíte de testes (pytest)";   run = { docker compose run --rm web pytest @Rest } }
    "lint"            = @{ desc = "Verifica lint + formatação (ruff)"; run = { docker compose run --rm web sh -c "ruff check . && ruff format --check ." } }
    "fmt"             = @{ desc = "Formata o código (ruff)";           run = { docker compose run --rm web ruff format . } }
}

function Show-Help {
    Write-Host "OdontoSaaS — comandos disponíveis (.\make.ps1 <alvo>):" -ForegroundColor Cyan
    foreach ($key in $Targets.Keys) {
        "{0,-16} {1}" -f $key, $Targets[$key].desc | Write-Host
    }
    "{0,-16} {1}" -f "help", "Mostra esta ajuda" | Write-Host
}

if ($Target -eq "help" -or $Target -eq "-h" -or $Target -eq "--help") {
    Show-Help
    return
}

if (-not $Targets.Contains($Target)) {
    Write-Host "Alvo desconhecido: '$Target'" -ForegroundColor Red
    Show-Help
    exit 1
}

& $Targets[$Target].run
exit $LASTEXITCODE

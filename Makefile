# ==========================================================================
# OdontoSaaS — atalhos de desenvolvimento (Linux/macOS/WSL/CI)
# No Windows sem `make`, use o equivalente: .\make.ps1 <alvo>
# Ex.: make up | make logs | make test
# ==========================================================================
COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help build up down restart logs ps check migrate makemigrations shell test lint fmt createsuperuser

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

build: ## Constrói as imagens Docker
	$(COMPOSE) build

up: ## Sobe todos os serviços em background
	$(COMPOSE) up -d

down: ## Derruba os serviços (mantém os volumes)
	$(COMPOSE) down

restart: ## Reinicia os serviços
	$(COMPOSE) restart

logs: ## Segue os logs de todos os serviços
	$(COMPOSE) logs -f

ps: ## Mostra o status dos serviços
	$(COMPOSE) ps

check: ## Roda o manage.py check (sem banco)
	$(COMPOSE) run --rm --no-deps web python manage.py check

migrate: ## Aplica as migrations do Django
	$(COMPOSE) run --rm web python manage.py migrate

makemigrations: ## Gera novas migrations
	$(COMPOSE) run --rm web python manage.py makemigrations

shell: ## Abre o shell interativo do Django
	$(COMPOSE) run --rm web python manage.py shell

createsuperuser: ## Cria um superusuário
	$(COMPOSE) run --rm web python manage.py createsuperuser

test: ## Roda a suíte de testes (pytest)
	$(COMPOSE) run --rm web pytest

lint: ## Verifica lint + formatação (ruff)
	$(COMPOSE) run --rm web sh -c "ruff check . && ruff format --check ."

fmt: ## Formata o código (ruff)
	$(COMPOSE) run --rm web ruff format .

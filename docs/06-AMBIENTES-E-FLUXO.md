# 06 — Ambientes e Fluxo de Trabalho (Dev → Produção)

> **Regra de ouro:** desenvolve-se **localmente**; a **VPS é produção** (dado real
> de paciente). **Nunca** se escreve/edita código direto na produção. A ponte
> entre os dois é o **Git** (repositório privado no GitHub: `luanhbonfim/odontosaas`).

## Os dois ambientes (já preparados)

| | Desenvolvimento (seu PC) | Produção (VPS) |
|---|---|---|
| Compose | `docker-compose.yml` | `docker-compose.prod.yml` |
| Settings Django | `config/settings/dev.py` | `config/settings/prod.py` |
| Código | volume montado (hot-reload) | imutável (build da imagem) |
| Frontend | Vite dev server (`npm run dev`) | build estático servido pelo Caddy |
| HTTPS | não precisa | Caddy (Let's Encrypt) automático |
| Banco | Postgres local (dados de teste) | Postgres com **dado real** + backup |
| Segredos | `.env` de dev (placeholders ok) | `.env` de prod (segredos fortes) |

O que separa os ambientes é **qual settings + qual compose + qual `.env`**. Nada
de código muda entre eles.

## Fluxo para CADA mudança

```
[PC: desenvolve]  →  git push  →  [GitHub privado]  →  git pull  →  [VPS: deploy]
```

1. **No PC** — implementa, e roda os gates antes de commitar:
   - Backend: `docker exec odonto_web python -m pytest -q` + `ruff check`.
   - Frontend: `npm run typecheck && npm run lint && npx vitest run && npm run build`.
2. **Commit + push:**
   ```bash
   git add -A && git commit -m "feat: ..." && git push
   ```
3. **Na VPS** — aplica em produção:
   ```bash
   cd /opt/odonto && git pull && bash deploy/deploy.sh
   ```
   O `deploy.sh` faz rebuild, **migra** (schema public + tenants), coleta estáticos
   e sobe. Sempre há **backup diário** do banco (ver `deploy/README.md`).

## Por que não desenvolver na VPS
- Dado real de paciente: um erro em produção = vazamento/perda/queda para a clínica.
- Sem rede de segurança (testes, rollback) se editar "ao vivo".
- Produção reproduzível = sai do git, idêntica, em qualquer servidor (facilita
  migrar de provedor e, depois, escalar para várias clínicas).

## Banco de dev x produção
São **bancos diferentes, em máquinas diferentes**. Migrações são criadas e testadas
no PC; só um **deploy deliberado** as aplica em produção. Desenvolver nunca toca no
dado da clínica.

## Opcional (quando crescer): staging
Um terceiro ambiente (VPS pequeno ou mesmo servidor, outro domínio) que espelha
produção para validar antes de subir. Desnecessário no piloto; vale quando houver
várias clínicas pagantes.

## Onde está cada coisa
- Kit de produção: `deploy/` (`Caddyfile`, `edge.Dockerfile`, `deploy.sh`,
  `backup-postgres.sh`, `.env.prod.example`, `README.md`).
- Compose de produção: `docker-compose.prod.yml` (raiz).
- Settings: `config/settings/{dev,prod}.py`.

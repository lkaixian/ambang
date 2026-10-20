# AMBANG

Early-warning dashboard for tourism pressure on Malaysian islands and highlands. Built for the DOSM Datathon 2026 (IPT category); top 10 finalist.

AMBANG scores each destination against its capacity (water, waste, accommodation, visitors, seasonality) and sorts it into four bands: Normal, Warning, Alert, Critical. It includes a map, a triage board, a seasonal calendar, a what-if weight tool and an AI-written brief that is always marked as AI content.

## Layout

| Path | What |
|---|---|
| `app/` | The dashboard (static front end) and `server.js`, which serves it and proxies `/api/ai` so the API key stays server-side |
| `data/` | Source CSV/JSON datasets used by the scores |
| `scripts/` | Python/Node scripts that fetch, clean and weight the data (`train_weights.py` builds the entropy-weight file) |
| `reports/`, `research/` | Method notes and the Q&A prepared for the pitch |
| `DESIGN.md` | Design direction |
| `Dockerfile`, `docker-compose.yml`, `nginx/` | Deployment stack (app + Redis cache + nginx, optional Cloudflare tunnel); see [DEPLOY.md](DEPLOY.md) |

## Run locally

```bash
cp .env.example .env     # fill in ILMU_API_KEY, ILMU_MODEL, REDIS_PASS
cd app && npm install && node server.js
```

The dashboard works without an API key; only the AI brief and chat need one. Full stack: `docker compose up -d --build` (also needs `TUNNEL_TOKEN` unless you remove the `cloudflared` service).

## Data

Sources include DOSM, Sabah Parks, Marine Parks, OpenStreetMap, Google Trends and Wikipedia pageviews. Check each source's licence before reusing the data.

## Licence

Code is MIT, see [LICENSE](LICENSE). The datasets in `data/` keep their original sources' terms and are not covered by it.

## Team

**Spark Surge**, Universiti Tun Hussein Onn Malaysia (UTHM).

<p>
  <img src="photos/team-1.jpeg" width="32%">
  <img src="photos/team-2.jpeg" width="32%">
  <img src="photos/team-3.jpeg" width="32%">
</p>

Startup command:
```bash
docker compose up -d --build
curl http://localhost/healthz
```

- Cloudflare tunnel: nginx only listens on `127.0.0.1`. The `cloudflared` container reaches it inside Docker. In the Cloudflare dashboard, point the tunnel's public hostname at `http://nginx:80`. (disabled)
- Direct from the internet: add `BIND_IP=0.0.0.0` to `.env`, point your DNS at the server, then `docker compose up -d`.
- HTTPS without a tunnel: put `fullchain.pem` and `privkey.pem` in `nginx/certs/`, edit `nginx/nginx.conf` as its comments say, then `docker compose restart nginx`.

Where things are stored

| What | Where |
|---|---|
| AI answer cache | Redis, volume `redis-data` (backup file `ai_cache.json` in volume `ai-cache`) |
| Secrets | `.env` only. Never commit it or share it. |

When the dashboard changes

- Changed `app.js`, `style.css` or `data/*.json`? Bump the `?v=` number in `app/index.html` (the `style.css` link and the loader's `data/...json` and `app.js` URLs). Then run `docker compose restart nginx`
- Changed prompts or data the AI uses? Clear the answer cache (command above).


| Problem | Fix |
|---|---|
| `set REDIS_PASS in .env` error | `REDIS_PASS` is empty in `.env`. Fill it in. |
| `NOAUTH Authentication required` | Use the flush command above, which passes the password. |
| `/healthz` does not say `redis` | `docker compose logs redis app`. The password may differ from the running container's: `docker compose up -d --force-recreate redis app` |
| AI says "I can only answer questions about this dashboard" for a real topic | The gate refused it. Check `docker compose logs app` for `REFUSE`. |
| Site unreachable | `docker compose ps`, then `docker compose logs nginx cloudflared` |

- Only nginx is exposed. Redis and the app have no published ports. Do not add a `ports:` entry for Redis.
- Limits (per IP / per day) are set in `.env`: `RATE_PER_MIN`, `FLOOD_PER_MIN`, `DAILY_CAP`.
- Several app copies share one cache and one set of limits: `docker compose up -d --scale app=2`.

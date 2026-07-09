# Backend Deployment Runbook

How to deploy / redeploy the Buraco backend to the production server.

## Server

| | |
|---|---|
| **Public IP** | `13.207.190.0` |
| **URL (game client points here)** | `http://13.207.190.0:3000` |
| **Region** | AWS `ap-south-1` (Mumbai) — chosen for low ping to Middle East / South Asia |
| **Instance** | EC2 `t3.micro`, Ubuntu, 20 GB disk, 2 GB swap |
| **SSH user** | `ubuntu` |
| **SSH key** | `buraco.pem` (kept on your Mac — do NOT commit it to git) |

The stack runs with Docker Compose: **`api`** (NestJS, port 3000) + **`postgres`** + **`redis`**, all on the one box. Containers use `restart: unless-stopped`, so they survive a server reboot.

---

## Quick redeploy (the normal case: you changed backend code)

From your Mac, inside this `buraco-backend` folder:

```bash
./deploy.sh
```

That uploads the current code, rebuilds the image, restarts the stack, and prints a health check. Takes a few minutes (the Nest build is slow on a t3.micro). **That's it** unless you added a database migration (see below).

> First time only: `chmod +x deploy.sh`

---

## Manual steps (what `deploy.sh` does, if you prefer to run them yourself)

Set a shortcut for SSH:
```bash
KEY="$HOME/Desktop/Barasilian Cards Game/buraco.pem"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no ubuntu@13.207.190.0"
```

1. **Upload code** (from inside `buraco-backend`):
   ```bash
   tar czf - --exclude=node_modules --exclude=dist --exclude=.git . \
     | $SSH 'rm -rf ~/buraco-backend && mkdir -p ~/buraco-backend && tar xzf - -C ~/buraco-backend'
   ```

2. **Rebuild + restart**:
   ```bash
   $SSH 'cd ~/buraco-backend && sudo docker compose up -d --build'
   ```

3. **Verify**:
   ```bash
   $SSH 'sudo docker ps; curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/'
   ```

---

## If you added a NEW database migration

Only needed when `prisma/migrations/` has a new folder. Prisma 7 needs `prisma.config.ts` present, so mount it into a one-off container:

```bash
$SSH 'cd ~/buraco-backend && sudo docker compose run --rm --no-deps \
  -v /home/ubuntu/buraco-backend/prisma.config.ts:/app/prisma.config.ts \
  api npx prisma migrate deploy'
```

Then restart the api: `$SSH 'cd ~/buraco-backend && sudo docker compose restart api'`

---

## Everyday operations

```bash
# Live logs
$SSH 'sudo docker logs -f buraco_api'

# Container status
$SSH 'sudo docker ps'

# Restart just the API (no rebuild)
$SSH 'cd ~/buraco-backend && sudo docker compose restart api'

# Stop / start the whole stack
$SSH 'cd ~/buraco-backend && sudo docker compose down'      # stop (keeps DB data)
$SSH 'cd ~/buraco-backend && sudo docker compose up -d'     # start

# Disk / memory check (t3.micro is small — watch these)
$SSH 'df -h /; free -m'

# Free disk if builds pile up
$SSH 'sudo docker system prune -f'
```

⚠️ **Never** run `docker compose down -v` — the `-v` deletes the Postgres volume (all game data).

---

## Gotchas (things that bit us during first deploy)

- **`docker-compose.override.yml`** on the server sets `command: node dist/src/main.js`. Nest builds `main.js` to `dist/src/main.js` (not `dist/main.js`) because of the root-level `prisma.config.ts`. The Dockerfile `CMD` is now also correct, but the override is kept as a safety net — `deploy.sh` recreates it every time.
- **RAM is tight (1 GB).** A 2 GB swapfile is already configured so the build doesn't OOM. If the API gets killed under load, bump the instance to `t3.small` in the AWS console.
- **Migrations need `prisma.config.ts` mounted** (Prisma 7 requirement) — see the migration section above.
- **`.env`** lives on the server at `~/buraco-backend/.env` and is re-uploaded on every deploy (it's excluded from git). `DATABASE_URL`/`REDIS_URL` in it are ignored — `docker-compose.yml` overrides them to the internal `postgres`/`redis` containers.

---

## Production hardening (TODO before public launch)

- **HTTPS/WSS** — currently plain HTTP. Get a domain, point it at this IP, add nginx + Let's Encrypt. Required for the iOS App Store.
- **Elastic IP** — attach one so the public IP doesn't change if the instance restarts (otherwise you'd have to update the game client again).
- **Backups** — enable automated EBS snapshots or `pg_dump` on a schedule.
- **Bigger instance** — `t3.micro` is fine for testing; move to `t3.small`+ for real traffic.

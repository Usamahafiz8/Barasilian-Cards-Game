#!/usr/bin/env bash
#
# Redeploy the Buraco backend to the Mumbai (ap-south-1) EC2 server.
# Run this from your Mac, inside the buraco-backend folder:  ./deploy.sh
#
# It ships the current code, rebuilds the Docker image, and restarts the stack.
# It does NOT run DB migrations (see DEPLOY.md if you added a new migration).

set -euo pipefail

# --- config (override by exporting these before running) ---------------------
KEY="${KEY:-$HOME/Desktop/Barasilian Cards Game/buraco.pem}"
HOST="${HOST:-ubuntu@13.207.190.0}"
SRC="$(cd "$(dirname "$0")" && pwd)"        # this backend folder
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
# -----------------------------------------------------------------------------

echo "==> Deploying $SRC"
echo "==> Target: $HOST"

# 1. Ship the code (exclude node_modules / dist / .git — the server rebuilds them)
echo "==> [1/3] uploading code..."
tar czf - -C "$SRC" --exclude=node_modules --exclude=dist --exclude=.git --exclude='*.log' . \
  | ssh "${SSH_OPTS[@]}" "$HOST" \
      'rm -rf ~/buraco-backend && mkdir -p ~/buraco-backend && tar xzf - -C ~/buraco-backend 2>/dev/null && \
       printf "services:\n  api:\n    command: [\"node\", \"dist/src/main.js\"]\n" > ~/buraco-backend/docker-compose.override.yml && \
       echo "   uploaded (.env=$([ -f ~/buraco-backend/.env ] && echo ok || echo MISSING))"'

# 2. Rebuild the image and restart the containers
echo "==> [2/3] rebuilding + restarting (a few minutes on t3.micro)..."
ssh "${SSH_OPTS[@]}" "$HOST" 'cd ~/buraco-backend && sudo docker compose up -d --build'

# 3. Verify
echo "==> [3/3] verifying..."
ssh "${SSH_OPTS[@]}" "$HOST" 'sleep 8; sudo docker ps --format "   {{.Names}}: {{.Status}}"; \
   curl -s -o /dev/null -w "   health: HTTP %{http_code}\n" --max-time 8 http://localhost:3000/ || echo "   health: NO RESPONSE (check: sudo docker logs buraco_api)"'

echo "==> Done. Server live at http://13.207.190.0:3000"

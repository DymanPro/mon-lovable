#!/bin/bash
echo "=== Test de la clé API ==="
KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d'=' -f2)
echo "Clé trouvée: ${KEY:0:20}..."
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'

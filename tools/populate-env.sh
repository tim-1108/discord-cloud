#!/usr/bin/env bash

set -e

ENV_FILE=".env"

echo "Generating .env file..."

SERVICE_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
MESSAGE_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')

if [ ! -f "./jwtRS256.sh" ]; then
  echo "Error: jwtRS256.sh not found!"
  exit 1
fi

chmod +x ./jwtRS256.sh
./jwtRS256.sh

if [[ ! -f "jwtRS256.key" || ! -f "jwtRS256.key.pub" ]]; then
  echo "Error: Key generation failed!"
  exit 1
fi

PRIVATE_KEY=$(base64 -w 0 < jwtRS256.key)
PUBLIC_KEY=$(base64 -w 0 < jwtRS256.key.pub)
rm jwtRS256.key
rm jwtRS256.key.pub

cat > "$ENV_FILE" <<EOF
# discord-cloud manager environment variables

SERVICE_PASSWORD=$SERVICE_PASSWORD
MESSAGE_ENCRYPTION_KEY=$MESSAGE_ENCRYPTION_KEY

PRIVATE_KEY=$PRIVATE_KEY
PUBLIC_KEY=$PUBLIC_KEY

MANAGER_PORT=
SUPABASE_KEY=
SUPABASE_URL=
DEBUG_LOGGING=
EOF

echo ".env file generated successfully!"
#!/bin/bash

# Setup script for 1147 Gateway
# Creates .env file from environment variables or prompts for input

echo "=== 1147 Gateway Setup ==="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Backing up to .env.bak"
    cp .env .env.bak
fi

# Try to get credentials from environment or .zshrc
SF_USERNAME=${SF_USERNAME:-${SALESFORCE_USERNAME:-""}}
SF_PASSWORD=${SF_PASSWORD:-${SALESFORCE_PASSWORD:-""}}
SF_SECURITY_TOKEN=${SF_SECURITY_TOKEN:-""}
SF_CLIENT_ID=${SF_CLIENT_ID:-"your_oauth_consumer_key_here"}
SF_CLIENT_SECRET=${SF_CLIENT_SECRET:-"your_oauth_consumer_secret_here"}

# Default values
SF_LOGIN_URL=${SF_LOGIN_URL:-"https://test.salesforce.com"}
SF_INSTANCE=${SF_INSTANCE:-"https://maxis--fdrv2.sandbox.my.salesforce.com"}

# Prompt for missing values
if [ -z "$SF_USERNAME" ]; then
    read -p "Salesforce Username: " SF_USERNAME
fi

if [ -z "$SF_PASSWORD" ]; then
    read -sp "Salesforce Password: " SF_PASSWORD
    echo ""
fi

if [ -z "$SF_SECURITY_TOKEN" ]; then
    read -sp "Salesforce Security Token (leave empty if password includes token): " SF_SECURITY_TOKEN
    echo ""
fi

# Create .env file
cat > .env <<EOF
# Salesforce Configuration
SF_LOGIN_URL=${SF_LOGIN_URL}
SF_INSTANCE=${SF_INSTANCE}
SF_USERNAME=${SF_USERNAME}
SF_PASSWORD=${SF_PASSWORD}
SF_SECURITY_TOKEN=${SF_SECURITY_TOKEN}
SF_CLIENT_ID=${SF_CLIENT_ID}
SF_CLIENT_SECRET=${SF_CLIENT_SECRET}

# Rate Limiting
BATCH_DELAY_SECONDS=2
MAX_CONCURRENT_BATCHES=5
EOF

echo "✅ .env file created!"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: pip install -r requirements.txt"
echo "  2. Run the gateway: python -m app.main"
echo "  3. Or with Docker: docker-compose up -d"
echo ""










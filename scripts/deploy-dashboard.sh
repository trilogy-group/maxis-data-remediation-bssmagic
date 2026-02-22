#!/bin/bash
# deploy-dashboard.sh - Deploy BSS Magic Dashboard to AWS S3 + CloudFront

set -e

export AWS_PROFILE=totogi-runtime

APP_DIR="/Users/vladsorici/BSSMagic-RUNTIME/docs/bss-magic-app-template"
S3_BUCKET="bssmagic-dashboard-prod"
CLOUDFRONT_ID="EJ1RFHEGH2GT2"

echo "=========================================="
echo "BSS Magic Dashboard - AWS Deployment"
echo "=========================================="

# Build
echo ""
echo "📦 Building application..."
cd "$APP_DIR"
npm run build

# Deploy to S3
echo ""
echo "☁️  Uploading to S3..."
export AWS_DEFAULT_REGION=ap-southeast-1
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete

# Invalidate CloudFront
echo ""
echo "🔄 Invalidating CloudFront cache..."
export AWS_DEFAULT_REGION=us-east-1
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "   Invalidation ID: $INVALIDATION_ID"

echo ""
echo "=========================================="
echo "✅ Deployment complete!"
echo "=========================================="
echo ""
echo "Production URL: https://d2xndful3azc5x.cloudfront.net"
echo ""
echo "Note: CloudFront cache invalidation may take 1-2 minutes to propagate."

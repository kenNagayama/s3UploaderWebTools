#!/bin/bash

# デプロイ中にエラーが発生した場合は即座に停止する
set -e

PROJECT_ROOT=$(pwd)

echo "🚀 Deploying Infrastructure (Backend & Frontend Stacks)..."
cd infra
npm install
npx cdk deploy --all --require-approval never --outputs-file outputs.json

echo "🔍 Parsing CDK outputs..."
# 'BackendStack' と 'FrontendStack' は infra.ts で定義されたスタック名です。
DASHBOARD_API_URL=$(node -p "require('./outputs.json')['BackendStack']?.DashboardApiUrl")
UPLOAD_API_URL=$(node -p "require('./outputs.json')['BackendStack']?.UploadApiUrl")
ORIGIN_VERIFY_SECRET=$(node -p "require('./outputs.json')['BackendStack']?.OriginVerifySecret")
FRONTEND_BUCKET_NAME=$(node -p "require('./outputs.json')['FrontendStack']?.FrontendBucketName")
FRONTEND_URL=$(node -p "require('./outputs.json')['FrontendStack']?.FrontendUrl")

if [ -z "$DASHBOARD_API_URL" ] || [ "$DASHBOARD_API_URL" == "undefined" ]; then
    echo "❌ Error: Could not retrieve DashboardApiUrl from CDK outputs."
    exit 1
fi

if [ -z "$UPLOAD_API_URL" ] || [ "$UPLOAD_API_URL" == "undefined" ]; then
    echo "❌ Error: Could not retrieve UploadApiUrl from CDK outputs."
    exit 1
fi

if [ -z "$FRONTEND_BUCKET_NAME" ] || [ "$FRONTEND_BUCKET_NAME" == "undefined" ]; then
    echo "❌ Error: Could not retrieve FrontendBucketName from CDK outputs."
    exit 1
fi

echo "✅ Dashboard API URL: ${DASHBOARD_API_URL}"
echo "✅ Upload API URL: ${UPLOAD_API_URL}"
echo "✅ Frontend Bucket Name: ${FRONTEND_BUCKET_NAME}"

echo "🚀 Deploying Frontend (Next.js)..."
cd ../frontend
npm install

# .env.localファイルを作成し、環境変数を設定
# CloudFront + S3 構成ではビルド時に環境変数が埋め込まれるため、ここで設定が必要です。
# ローカル開発時 (next dev) には rewrites で利用されます。
# NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET はローカル開発時のみ使用し、本番ビルドには含めないように注意が必要ですが、
# 今回は簡易的に .env.local に書き込みます。本番ビルドではこの変数は使われません（CloudFrontが付与するため）。
cat <<EOF > .env.local
NEXT_PUBLIC_DASHBOARD_API_URL=${DASHBOARD_API_URL}
NEXT_PUBLIC_UPLOAD_API_URL=${UPLOAD_API_URL}
X_ORIGIN_VERIFY_SECRET=${ORIGIN_VERIFY_SECRET}
NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET=${ORIGIN_VERIFY_SECRET}
EOF

npm run build

echo "☁️ Syncing frontend to S3 bucket: ${FRONTEND_BUCKET_NAME}..."
aws s3 sync out/ "s3://${FRONTEND_BUCKET_NAME}" --delete

echo "🔄 Invalidating CloudFront cache..."
if [ -n "$FRONTEND_URL" ] && [ "$FRONTEND_URL" != "undefined" ]; then
    DOMAIN_NAME=${FRONTEND_URL#https://}
    # aws cli v2 or v1 compatible query
    DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='${DOMAIN_NAME}'].Id" --output text)
    
    if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
        aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
        echo "✅ Invalidation request created for Distribution ID: ${DISTRIBUTION_ID}"
    else
        echo "⚠️ Warning: Could not find Distribution ID for domain ${DOMAIN_NAME}. Skipping invalidation."
    fi
else
    echo "⚠️ Warning: FRONTEND_URL is missing. Skipping invalidation."
fi

cd $PROJECT_ROOT
echo "🎉 Deployment completed successfully!"
if [ -n "$FRONTEND_URL" ] && [ "$FRONTEND_URL" != "undefined" ]; then
    echo "🌐 Dashboard is available at: ${FRONTEND_URL}"
fi

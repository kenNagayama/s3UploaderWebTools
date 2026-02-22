#!/bin/bash
set -e

# ---------------------------------------------------------
# Variables (ご自身の環境に合わせて変更してください)
# ---------------------------------------------------------
GITHUB_ORG="kenNagayama"
GITHUB_REPO="s3UploaderWebTools"
ROLE_NAME="GitHubActionsDeployRole-S3Uploader"
# ---------------------------------------------------------

echo "AWS Account ID を取得しています..."
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo "エラー: AWS CLI の認証情報が設定されていません。"
    exit 1
fi
echo "Account ID: $ACCOUNT_ID"

# 1. OIDC プロバイダの作成
# GitHub OIDC プロバイダの thumbprint は公式提供されている固定値です (複数ある場合がありますが、代表的なもの)
THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

echo "OIDC プロバイダの存在確認..."
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" >/dev/null 2>&1; then
    echo "OIDC プロバイダは既に存在します。"
else
    echo "OIDC プロバイダを作成しています..."
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --client-id-list "sts.amazonaws.com" \
        --thumbprint-list "$THUMBPRINT"
    echo "作成完了"
fi

# 2. IAM ロールの作成
echo "IAM ロールの信頼関係 (Trust Policy) を作成しています..."
cat << EOF > trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

echo "IAM ロール '${ROLE_NAME}' の存在確認..."
if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
    echo "IAM ロール '${ROLE_NAME}' は既に存在するため、信頼関係を更新します..."
    aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document file://trust-policy.json
else
    echo "IAM ロール '${ROLE_NAME}' を作成しています..."
    aws iam create-role --role-name "${ROLE_NAME}" --assume-role-policy-document file://trust-policy.json
fi
rm trust-policy.json

# 3. 権限（ポリシー）のアタッチ
# ※CDKのデプロイには強い権限が必要になるため、ここでは AdministratorAccess を付与しています。
# より厳密な権限管理が必要な場合は適宜変更してください。
echo "AdministratorAccess ポリシーをアタッチしています..."
aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "========================================================="
echo "セットアップが完了しました！"
echo ""
echo "以下の ARN を GitHub の Secrets (AWS_OIDC_ROLE_ARN) に登録してください:"
echo ""
echo "  ${ROLE_ARN}"
echo ""
echo "========================================================="

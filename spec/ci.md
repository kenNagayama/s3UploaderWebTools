# CI/CD

## 概要

`backend` フォルダ内のAWSへのデプロイを自動化するCI/CDを導入します。

## 要件

- GitHub Actions を使う
- python を使うときには **uv** を使う
- AWS認証には **IAM OIDC** を利用する
- PR作成時に `cdk diff` を実行し、変更差分をPR上で確認できるようにする
- `main` ブランチへのPushは禁止し、必ずPRを経由してマージする（GitHubのブランチ保護設定を利用）
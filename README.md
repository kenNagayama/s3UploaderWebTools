# Twins デジタルデータ アップロード & データ分析ダッシュボード

ブラウザ単体（HTML + JS + CSS）で動作するS3へのセキュアなマルチパート対応CSVアップローダー(`index.html`)、およびアップロードされたデータを分析・可視化するためのシステムです。
最新のアップデートにより、アップロードされたデータをクレンジング（Unpivot処理など）し、Next.jsで構築されたダッシュボード（ヒートマップおよび折れ線グラフ）で推移を可視化する機能が追加されました。

インフラストラクチャはAWS CDK (TypeScript) を用いて構築されており、フロントエンド（Next.js）用ホスティングとバックエンド（Lambda, API Gateway, S3, Athena, Glue）が一元管理されています。

## システムアーキテクチャ

システムは大きく分けて3つのコンポーネントで構成されています。

### 1. アップロード用フロントエンド (`index.html`)
HTML/JS/CSSの単一ファイルです。ユーザーUIを提供し、バックエンドから取得した署名付きURLを用いてS3へ直接CSVファイルをマルチパートでアップロードします。

### 2. ダッシュボード用フロントエンド (`frontend/`)
Next.js (App Router, React, Tailwind CSS, Chart.js) で構築された静的サイト (SSG) です。
* Amazon S3 で静的ウェブサイトホスティングされています。
* API Gateway を通じてバックエンドのAPIをコールし、Athenaで集計されたトロリ線の摩耗データを取得・可視化します。

### 3. バックエンド & インフラ (`infra/` & `backend/`)
AWS CDK (TypeScript) を用いてインフラストラクチャを構築しています（`infra/`）。Lambda関数の実体はPythonで記述されています（`backend/lambda/`）。

* **BackendStack**:
  * **DataUploadBucket (生データ用S3)**: `index.html` からのアップロード先。
  * **AthenaDataBucket (クエリ用S3)**: 自動クレンジング・Unpivot処理後のデータが格納されます。
  * **AthenaResultsBucket**: Athenaクエリの実行結果CSVが格納されます。
  * **PresignedUrlHandler (Lambda)**: アップロード用の一時的な署名付きURLを発行。
  * **CsvTransformHandler (Lambda)**: アップロードをトリガーに起動し、Shift-JIS→UTF-8変換、Excel数式除去、データのUnpivot処理（摩耗データの縦持ち化）、および新品時直径の計算ロジックを実行。
  * **DashboardApiHandler (Lambda) & API Gateway**: ダッシュボードからのリクエストを受け、Athenaに対してクエリを発行し、Presigned URL（結果CSVへのリンク）を生成して返却。
  * **AWS Glue & Athena**: S3データをテーブル化し、ダッシュボードやTableauからクエリ可能にします。

* **FrontendStack**:
  * **FrontendHostingBucket**: Next.js (ダッシュボード) のビルド成果物(`out/`)を静的ホスティングするS3バケット。

## クレンジングとデータ可視化の仕組み

1. ユーザーが `index.html` からCSVをアップロード。
2. `DataUploadBucket` への保存をトリガーに `CsvTransformHandler` が非同期で起動。
   * 横持ち（14個のハンガ位置）の摩耗データを「ハンガ位置」「摩耗_最小値」「新品時直径」の縦持ち（Unpivot）形式に変換。
3. `AthenaDataBucket` に処理済みCSVが保存され、Athenaからクエリ可能に。
4. ダッシュボードにアクセスすると、Next.jsがAPI Gateway(`DashboardApi`)を呼び出す。
5. `DashboardApiHandler` がAthenaにクエリを投げ、結果CSVのダウンロード用の一時URLをフロントエンドに返却。
6. ダッシュボード側でCSVをパースし、ヒートマップと折れ線グラフを描画。

## 開発者向けドキュメント

### インフラ (CDK) のデプロイ手順

インフラ環境は AWS CDK (TypeScript) で管理されています。

#### 1. 事前準備
1. Node.js のインストール
2. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) のインストール (`npm install -g aws-cdk`)
3. AWS CLI の設定および認証 (事前配布の `auth.sh` 等で一時クレデンシャルをロード)

#### 2. デプロイ実行

```bash
cd infra
npm install

# CDKのデプロイ (FrontendとBackend両方のスタックをデプロイ)
npx cdk deploy --all
```

ターミナル出力の `Outputs` セクションに以下の重要情報が表示されます：
* `FrontendStack.FrontendUrl` : ダッシュボードへのアクセスURL
* `BackendStack.UploadApiUrl` : `index.html` に設定するAPI URL
* `BackendStack.DashboardApiUrl` : Next.jsの環境変数に設定するAPI URL

### ダッシュボード (フロントエンド) のデプロイ手順

CDKデプロイ後、出力されたAPI URLを使ってフロントエンドをビルド・アップロードします。

```bash
cd frontend
npm install

# .env.localファイルを作成し、BackendStack.DashboardApiUrl を設定
echo "NEXT_PUBLIC_DASHBOARD_API_URL=https://<API_ID>.execute-api.ap-northeast-1.amazonaws.com/prod" > .env.local

# Next.js の静的ビルド (out/ に出力)
npm run build

# FrontendStack で作成されたS3バケットへ同期
aws s3 sync out/ s3://<フロントエンド・バケット名> --delete
```

### アップローダー (`index.html`) の更新手順

CDKを作り直して `UploadApiUrl` が変わった場合のみ、`index.html` 内部の `BACKEND_URL` 定数を書き換えてください。

```javascript
    // Backend API URL
    const BACKEND_URL = "https://<新しいURL>.lambda-url.ap-northeast-1.on.aws/";
```

### GitHub Actions (OIDC) の設定
このプロジェクトはGitHub Actions経由で自動デプロイが可能です。
`BackendStack` 初回デプロイ時に出力される `BackendStack.GitHubActionsRoleArn` の値を、GitHubリポジトリの Secrets (`AWS_OIDC_ROLE_ARN`) に設定してください。

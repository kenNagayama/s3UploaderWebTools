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

### 1. データフロー
1. ユーザーが `index.html` からCSVをアップロード。
2. `DataUploadBucket` への保存をトリガーに `CsvTransformHandler` が非同期で起動。
   * **Unpivot処理**: 横持ち（14個のハンガ位置）の摩耗データを「ハンガ位置」「摩耗_最小値」の縦持ち形式に変換。これにより、Tableauやダッシュボードでの分析が容易になります。
   * **新品時直径の動的判定**: 線種コードに基づき、新品時の直径（基準値）を付与します。
     * 線種 `X, Y, Z, G, H, I, K, L, M`: **15.49mm**
     * 線種 `スペース, B, C` その他: **12.34mm**
3. `AthenaDataBucket` に処理済みCSVが保存され、Athenaからクエリ可能に。
4. ダッシュボードにアクセスすると、Next.jsがAPI Gateway(`DashboardApi`)を呼び出す。
5. `DashboardApiHandler` がAthenaにクエリを投げ、結果CSVのダウンロード用の一時URLをフロントエンドに返却。
6. ダッシュボード側でCSVをパースし、描画を行います。

### 2. ダッシュボード機能 (MVP)
画面は左右に分割され、異なる視点でデータを可視化します。

* **左側：ヒートマップ（俯瞰用）**
  * 縦軸：電柱・ハンガ位置、横軸：測定日で構成。
  * 摩耗の進行状況を色（青→赤）で表現し、全体的な傾向を直感的に把握できます。
  * Canvasベースの描画エンジンを採用し、大量のデータポイントを高速に描画します。

* **右側：折れ線グラフ（詳細分析用）**
  * ヒートマップで選択した箇所の詳細データを表示。
  * 特定の電柱におけるハンガ位置ごとの摩耗推移（時系列変化）を確認できます。

## 開発者向けドキュメント

### 自動デプロイ手順 (推奨)

プロジェクトのルートディレクトリにある `deploy.sh` スクリプトを使用して、AWSインフラ（バックエンド）とNext.js（フロントエンド）両方のデプロイを1コマンドで完了させることができます。

#### 1. 事前準備
1. Node.js のインストール
2. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) のインストール (`npm install -g aws-cdk`)
3. AWS CLI の設定および認証 (事前配布の `auth.sh` 等で一時クレデンシャルをロード)

#### 2. デプロイ実行

```bash
./deploy.sh
```

このスクリプトは以下の処理を自動で行います：
1. `infra/` に移動して `npx cdk deploy --all` を実行
2. CDKの出力結果を `outputs.json` として一時保存
3. 出力結果から API エンドポイントと S3 バケット名を抽出
4. `frontend/` に移動して `.env.local` を自動生成し `npm run build` で静的ビルド
5. ビルド結果を先ほど抽出した S3 バケットへアップロード

最後にターミナルにダッシュボードへのアクセスURLが表示されます。

---

### 手動デプロイ手順

スクリプトを使わずに手動でデプロイする場合は、以下の手順に従ってください。

#### インフラ (CDK) のデプロイ

```bash
cd infra
npm install
npx cdk deploy --all
```

ターミナル出力の `Outputs` セクションに重要情報が表示されます。

#### ダッシュボード (フロントエンド) のデプロイ

CDKデプロイ後、出力された `DashboardApiUrl` と `FrontendBucketName` を使ってフロントエンドをビルド・アップロードします。

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

### Athena コンソールでの動作確認用クエリ

開発者がAWSマネジメントコンソール上の **Athena クエリエディタ** で直接データをテスト・確認する際は、以下のSQLを参考にしてください。Tableau上では全量を抽出（データソース抽出）することが可能です。

```sql
-- すべてのデータを50行だけプレビューする (Tableauでの全量抽出時のプレビューに相当)
SELECT * 
FROM "tableau_access_db"."twins_digital_data" 
LIMIT 50;

-- 測定年などの数値カラムによるフィルタリングと、必要なカラムのみの抽出
SELECT 
    "支社コード",
    "箇所名",
    "測定年", 
    "摩耗_平均値"
FROM "tableau_access_db"."twins_digital_data" 
WHERE "測定年" = 2020      -- 任意のフィルタリング
LIMIT 10;
```
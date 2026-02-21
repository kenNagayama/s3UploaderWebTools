# Twins デジタルデータ アップロード & データ分析基盤

ブラウザ単体（HTML + JS + CSS）で動作する、S3 へのセキュアなマルチパート対応 CSV アップローダー、およびアップロードされたデータをTableauやAmazon Athenaから分析するための自動クレンジングパイプラインを備えたシステムです。

バックエンドとしてAWS CDK (Python) を用いた署名付きURL (Pre-signed URL) 発行用のLambda関数を利用しており、生のAWSアクセスキーをブラウザ側で保持しない安全な設計となっています。アップロードされたデータはLambdaによって自動的に分析に適した形式へと変換されます。

## システムアーキテクチャ

システムは大きく分けて「アップロード」と「データ変換・分析」の2つのフェーズで構成されています。

### 1. フロントエンド (`index.html`)
HTML/JS/CSSの単一ファイルです。ユーザーUIを提供し、バックエンドから取得した署名付きURLを用いてS3へ直接CSVファイルをマルチパートで高速にアップロードします。

### 2. バックエンド (`backend/`)
AWS CDK (Python + `uv`) を用いてインフラストラクチャをコード化しています。

* **DataUploadBucket (生データ用S3)**: フロントエンドからのファイルアップロードを直接受け付けるバケットです。CORS設定が行われています。
* **PresignedUrlHandler (Lambda)**: フロントエンドからのリクエストに基づき、S3へのアップロード・マルチパート結合用の一時的な署名付きURLを発行するAPI（関数URL）を提供します。
* **CsvTransformHandler (Lambda)**: `DataUploadBucket` へのファイルアップロードをトリガーに自動起動します。以下のデータクレンジング処理を実行します：
  * **エンコーディング変換**: Shift-JIS形式のCSVをUTF-8に変換。
  * **Excel数式の除去**: `="2020"` 等のExcel用数式エスケープを純粋な値(`2020`)に変換。
* **AthenaDataBucket (クエリ用S3)**: `CsvTransformHandler` でクレンジングされた後のUTF-8形式のCSVが格納されます。
* **AWS Glue & Athena**: 
  * `tableau_access_db.twins_digital_data` テーブルとしてデータをスキーマ定義。
  * S3上のパスに関わらず、すべてのファイルを再帰的に読み込んでフルデータ（全量）を抽出可能。
  * 空文字をNullとして扱う設定（`use.null.for.invalid.data`）でパースエラーを防止。
* **Tableau 連携用 IAM ユーザー**:
  * Tableau Server等外部BIツールからAthena経由でデータを読み取るための専用IAMユーザー。

## フロントエンドの使い方

1. `index.html` をブラウザ（Chrome, Edge等）で開きます。
2. アップロード先のプレフィックス（支社名やMC名など）を選択・入力します。
3. アップロードしたいローカルのフォルダを選択します。ディレクトリ内の `.csv` ファイルのみが自動抽出されます。
4. 「アップロード開始🚀」ボタンを押して実行します。
5. （内部的にバックエンドから署名付きURLを取得し、S3へのアップロードが進行します）

## クレンジングとデータ分析の仕組み

フロントエンドからアップロードされたファイルは即座にはダッシュボードに反映されません。
1. `DataUploadBucket` にファイルが保存される
2. 数秒以内に自動的にバックエンドのLambda関数が起動し、UTF-8変換と数式除去を実行
3. `AthenaDataBucket` にクリーンなデータが保存される
4. Tableau（またはAWS CLI/コンソール上のAthena）からクエリ可能になる

という非同期処理が行われます。

## 開発者向けドキュメント

### バックエンドのデプロイ手順

バックエンド環境はPythonの高速パッケージマネージャである `uv` と AWS CDK を用いて管理されています。

#### 事前準備

1. [uv](https://github.com/astral-sh/uv) のインストール
2. AWS CLI の設定および認証 (AWS アクセスポータル等から取得した一時クレデンシャル (`auth.sh`等) を使用)

#### デプロイコマンド

`backend` ディレクトリに移動し、以下のコマンドで依存関係のインストールとデプロイを行います。

```bash
cd backend

# 依存関係のインストール（自動で仮想環境 .venv も構築されます）
uv sync

# CDK デプロイ
uv run cdk deploy --require-approval never
```

### デプロイ後のフロントエンド更新手順（重要）

`cdk deploy` を実行してバックエンドスタックを新しく作り直した場合、Lambdaの関数URLが変わります。
その際は、以下の手順でフロントエンド側（`index.html`）の接続先URLを手動で更新してください。

1. デプロイ完了後、ターミナルの出力（Outputs）に表示される `BackendStack.UploadApiUrl` の値（例: `https://xxxxxx.lambda-url.ap-northeast-1.on.aws/`）をコピーします。
2. `index.html` をエディタで開き、`BACKEND_URL` 定数の値をコピーした新しいURLに書き換えて保存します。

```javascript
    // Backend API URL
    const BACKEND_URL = "https://<新しいURL>.lambda-url.ap-northeast-1.on.aws/";
```

### IAM クレデンシャルの取得

デプロイ出力（Outputs）には、Tableau等のBIツールから接続するために使用するクレデンシャルが表示されます。

* `TableauAccessKeyId`
* `TableauSecretAccessKey`

これらをTableauのAmazon Athenaコネクタなどで指定してください。

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

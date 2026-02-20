# Twins デジタルデータ アップロードツール

ブラウザ単体（HTML + JS + CSS）で動作する、S3 へのセキュアなマルチパート対応 CSV アップローダーです。

## 使い方

1. `index.html` をブラウザ（Chrome, Edge等）で開きます。
2. AWS の認証情報が記載された `.env` ファイルを「設定ファイルを登録」から選択します。
   - ※認証情報はブラウザの LocalStorage に保存されるため、次回以降は選択不要です。
3. アップロード先の「S3 バケット名」および「アップロード先フォルダ」を入力します。
4. アップロードしたいローカルのフォルダ（デフォルト: `digital-data`）を選択します。
5. ディレクトリ内の `.csv` ファイルのみが自動抽出されるので、「アップロード開始🚀」ボタンを押して実行します。

## 重要：S3 バケットの CORS 設定について

このツールはローカルPC上（`file://` プロトコル）で動作するため、AWS S3 側からすると「身元不明のオリジン（Origin: `null`）」からの通信となります。
そのため、ブラウザからのアップロードを許可するには、**対象 S3 バケットの CORS (Cross-Origin Resource Sharing) 設定が必須**です。

### 📌 CORS 設定手順

1. AWS マネジメントコンソールにログインし、**S3** を開きます。
2. 対象のバケット（例：`twins-digital-data-test`）をクリックします。
3. **「アクセス許可 (Permissions)」** タブを開きます。
4. 画面下部の **「Cross-Origin Resource Sharing (CORS)」** セクションで「編集」ボタンをクリックします。
5. 以下の JSON ルールを貼り付けて、「変更の保存」をクリックします。

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "DELETE",
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ]
    }
]
```

`AllowedOrigins` を `*` とすることで、ローカル HTML（Origin が `null`）からのアップロード通信がブロックされなくなります。

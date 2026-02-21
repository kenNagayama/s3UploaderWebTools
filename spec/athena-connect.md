# Ahtena でクエリできるようにエンハンス

## 概要

- S3バケットにアップロードしたCSVファイルを対象に、Amazon Athena でクエリできるようにします。
- Tableau Serverから Athena にクエリできるように、 IAM ユーザと認証情報（アクセスキーとセキュリティ）を払い出します。

## 前提条件

- S3バケットは `backend` スタックで作ったアップロード先のバケットを対象にします。
- CSVデータのサンプルは **zai-digital-data-omiya-mc.csv** を使用します。
- CSVデータは、3行目にヘッダーがあり、データは4行目から記載されています。
- S3バケットには `s3://<bucket-name>/tableau-access/<gise-code>/<mc-code>/<file-name>.csv` のように保存されています。
    - `パーティション` は `<gise-code>/<mc-code>/` の部分で、`<gise-code>` が `技セコード`、`<mc-code>` が `メセコード` に対応します。
        - もし `パーティション` を設定するのに適さない条件であれば、 Athena でクエリできるようにすることを優先し、パーティションを設定しない方針とします。

### 各カラムのデータ型

| カラム名 | データ型 |
| --- | --- |
| No | int |
| 測定年 | int |
| 年内通番 | int |
| 支社コード | string |
| 技セコード | string |
| メセコード | string |
| 箇所名 | string |
| 行路ID | string |
| 行路名称 | string |
| 測定年月日 | date |
| 線名コード | string |
| 線名名称 | string |
| 通称線名コード | string |
| 通称線名名称 | string |
| 線別コード | string |
| 線別名称 | string |
| 駅・駅々間コード | string |
| 駅・駅々間名称 | string |
| 電柱番号 | string |
| 電柱通番 | string |
| 架線構造 | string |
| 架線構造名 | string |
| トロリ線種 | string |
| 制御状況 | string |
| 制御状況名 | string |
| 電柱検知 | string |
| 電柱検知名 | string |
| 電柱間隔_標準 | float |
| 電柱間隔_実測 | float |
| CH | float |
| 親ドラム番号 | string |
| 子ドラム番号 | string |
| ドラム識別番号 | string |
| 摩耗_最小値_1 | float |
| 摩耗_最小値_2 | float |
| 摩耗_最小値_3 | float |
| 摩耗_最小値_4 | float |
| 摩耗_最小値_5 | float |
| 摩耗_最小値_6 | float |
| 摩耗_最小値_7 | float |
| 摩耗_最小値_8 | float |
| 摩耗_最小値_9 | float |
| 摩耗_最小値_10 | float |
| 摩耗_最小値_11 | float |
| 摩耗_最小値_12 | float |
| 摩耗_最小値_13 | float |
| 摩耗_最小値_14 | float |
| 摩耗_管理度数－P0 | float |
| 摩耗_管理度数－P1 | float |
| 摩耗_管理度数－P2 | float |
| 摩耗_平均値 | float |
| 摩耗_標準偏差 | float |
| 摩耗_管理値－P0 | float |
| 摩耗_管理値－P1 | float |
| 摩耗_管理値－P2 | float |
| 動的偏位_最大偏位_左 | float |
| 動的偏位_最大偏位_右 | float |
| 動的偏位_起点側支持点 | float |
| 動的偏位_終点側支持点 | float |
| 動的偏位_径間中心 | float |
| 静的偏位_最大偏位_左 | float |
| 静的偏位_最大偏位_右 | float |
| 静的偏位_起点側支持点 | float |
| 静的偏位_終点側支持点 | float |
| 静的偏位_径間中心 | float |
| 高さ_最大値_径間内 | float |
| 高さ_最小値_径間内 | float |
| 高さ_起点側支持点 | float |
| 高さ_終点側支持点 | float |
| 高さ_径間中心 | float |
| 支障物_左 | string |
| 支障物_右 | string |
| 離隔 | float |
| 平行長 | float |
| 勾配 | float |
| 硬点_最大_上 | float |
| 硬点_最大_下 | float |
| パンタ衝撃_最大_前 | float |
| パンタ衝撃_最大_後 | float |
| 降雨フラグ | string |
| 降雨フラグ名 | string |
| タイムコード_先頭 | string |
| 歴重ね無効フラグ | string |
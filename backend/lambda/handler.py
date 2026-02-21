import os
import json
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

region = os.environ.get("AWS_REGION", "ap-northeast-1")
s3_client = boto3.client(
    "s3",
    region_name=region,
    endpoint_url=f"https://s3.{region}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)
BUCKET_NAME = os.environ.get("BUCKET_NAME")


def handler(event, context):
    try:
        if "body" not in event or not event["body"]:
            return response(400, "Missing request body")

        body = json.loads(event["body"])
        action = body.get("action")

        if not action:
            return response(400, "Missing action")

        if action == "getUploadUrls":
            return handle_get_upload_urls(body)
        elif action == "completeUpload":
            return handle_complete_upload(body)
        else:
            return response(400, f"Unsupported action: {action}")

    except Exception as e:
        print(f"Error: {e}")
        return response(500, str(e))


def handle_get_upload_urls(body):
    file_name = body.get("fileName")
    prefix = body.get("prefix", "")
    file_size = body.get("fileSize", 0)
    csv_header = body.get("csvHeader", "")

    if not file_name:
        return response(400, "Missing fileName")

    # CSV Schema validation
    expected_headers = ",".join([
        "No", "測定年", "年内通番", "支社コード", "技セコード", "メセコード", 
        "箇所名", "行路ID", "行路名称", "測定年月日", "線名コード", "線名名称", 
        "通称線名コード", "通称線名名称", "線別コード", "線別名称", "駅・駅々間コード", 
        "駅・駅々間名称", "電柱番号", "電柱通番", "架線構造", "架線構造名", "トロリ線種", 
        "制御状況", "制御状況名", "電柱検知", "電柱検知名", "電柱間隔_標準", "電柱間隔_実測", 
        "CH", "親ドラム番号", "子ドラム番号", "ドラム識別番号", "摩耗_最小値_1", 
        "摩耗_最小値_2", "摩耗_最小値_3", "摩耗_最小値_4", "摩耗_最小値_5", "摩耗_最小値_6", 
        "摩耗_最小値_7", "摩耗_最小値_8", "摩耗_最小値_9", "摩耗_最小値_10", 
        "摩耗_最小値_11", "摩耗_最小値_12", "摩耗_最小値_13", "摩耗_最小値_14", 
        "摩耗_管理度数－P0", "摩耗_管理度数－P1", "摩耗_管理度数－P2", "摩耗_平均値", 
        "摩耗_標準偏差", "摩耗_管理値－P0", "摩耗_管理値－P1", "摩耗_管理値－P2", 
        "動的偏位_最大偏位_左", "動的偏位_最大偏位_右", "動的偏位_起点側支持点", 
        "動的偏位_終点側支持点", "動的偏位_径間中心", "静的偏位_最大偏位_左", 
        "静的偏位_最大偏位_右", "静的偏位_起点側支持点", "静的偏位_終点側支持点", 
        "静的偏位_径間中心", "高さ_最大値_径間内", "高さ_最小値_径間内", "高さ_起点側支持点", 
        "高さ_終点側支持点", "高さ_径間中心", "支障物_左", "支障物_右", "離隔", "平行長", 
        "勾配", "硬点_最大_上", "硬点_最大_下", "パンタ衝撃_最大_前", "パンタ衝撃_最大_後", 
        "降雨フラグ", "降雨フラグ名", "タイムコード_先頭", "歴重ね無効フラグ"
    ])

    if file_name.lower().endswith('.csv') and csv_header != expected_headers:
        return response(400, "Invalid CSV schema")

    object_key = f"{prefix}{file_name}" if prefix else file_name

    # 5MB in bytes
    PART_SIZE = 5 * 1024 * 1024

    if file_size <= PART_SIZE:
        # Single part upload
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": object_key},
            ExpiresIn=3600,  # 1 hour
        )
        return response(
            200, {"uploadType": "single", "url": presigned_url, "objectKey": object_key}
        )
    else:
        # Multipart upload
        create_res = s3_client.create_multipart_upload(
            Bucket=BUCKET_NAME, Key=object_key
        )
        upload_id = create_res["UploadId"]

        import math

        num_parts = math.ceil(file_size / PART_SIZE)

        parts_urls = []
        for part_number in range(1, num_parts + 1):
            presigned_url = s3_client.generate_presigned_url(
                "upload_part",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": object_key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=3600,
            )
            parts_urls.append({"partNumber": part_number, "url": presigned_url})

        return response(
            200,
            {
                "uploadType": "multipart",
                "uploadId": upload_id,
                "objectKey": object_key,
                "parts": parts_urls,
            },
        )


def handle_complete_upload(body):
    object_key = body.get("objectKey")
    upload_id = body.get("uploadId")
    parts = body.get("parts")  # List of { ETag, PartNumber }

    if not all([object_key, upload_id, parts]):
        return response(400, "Missing required fields for completion")

    res = s3_client.complete_multipart_upload(
        Bucket=BUCKET_NAME,
        Key=object_key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )

    return response(
        200, {"message": "Upload completed successfully", "key": object_key}
    )


def response(status_code, body):
    if isinstance(body, str):
        body = {"message": body}

    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }

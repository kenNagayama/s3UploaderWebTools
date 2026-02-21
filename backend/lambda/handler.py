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

    if not file_name:
        return response(400, "Missing fileName")

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

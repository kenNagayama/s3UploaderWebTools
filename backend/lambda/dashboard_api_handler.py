import os
import json
import time
import boto3

athena = boto3.client('athena')
s3 = boto3.client('s3')

DATABASE = os.environ.get('DATABASE_NAME')
TABLE = os.environ.get('TABLE_NAME')
BUCKET = os.environ.get('ATHENA_RESULTS_BUCKET')

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # Check if a specific pole number is queried
    query_params = event.get('queryStringParameters') or {}
    pole_number = query_params.get('pole_number')
    
    # Build Athena query
    # MVP: Fetch a subset of columns needed for the dashboard to keep response small
    # For Heatmap, we need all, but maybe just essential fields to reduce size.
    if pole_number:
        # Prevent SQL injection by basic checking or using parameterized queries if supported,
        # but Athena boto3 start_query_execution doesn't support parameters out of the box easily.
        # We can just sanitize by replacing single quotes.
        safe_pole = pole_number.replace("'", "''")
        query = f"""
            SELECT "測定年月日", "電柱番号", "ハンガ位置", "摩耗_最小値", "新品時直径"
            FROM {DATABASE}.{TABLE}
            WHERE "電柱番号" = '{safe_pole}'
            ORDER BY "測定年月日" ASC, "ハンガ位置" ASC
        """
    else:
        # Default query for MVP heatmap overview
        query = f"""
            SELECT "測定年月日", "電柱番号", "ハンガ位置", "摩耗_最小値", "新品時直径"
            FROM {DATABASE}.{TABLE}
            LIMIT 50000
        """
        
    try:
        # 1. Start query
        response = athena.start_query_execution(
            QueryString=query,
            ResultConfiguration={'OutputLocation': f's3://{BUCKET}/'}
        )
        query_id = response['QueryExecutionId']
        
        # 2. Wait for query to complete (Simple polling since this is MVP and usually fast for small data)
        status = 'QUEUED'
        while status in ['QUEUED', 'RUNNING']:
            res = athena.get_query_execution(QueryExecutionId=query_id)
            status = res['QueryExecution']['Status']['State']
            if status in ['FAILED', 'CANCELLED']:
                reason = res['QueryExecution']['Status'].get('StateChangeReason', 'Unknown error')
                raise Exception(f"Athena query {status}: {reason}")
            time.sleep(1)
            
        # 3. Get results
        # Warning: get_query_results paginates at 1000 rows.
        # For a full heatmap array (e.g. 50k poles * 14 hangers = 700k rows), fetching via get_query_results takes too long and times out API Gateway.
        # Better approach for MVP is to generate a presigned URL to the CSV result in S3,
        # or paginating the response.
        # Here we do a simple CSV download and JSON conversion if small, otherwise presigned URL.
        
        s3_key = f"{query_id}.csv"
        
        # Generate presigned URL (valid for 5 mins)
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': s3_key},
            ExpiresIn=300
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True,
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'query_id': query_id,
                'status': 'SUCCEEDED',
                'download_url': presigned_url
            })
        }
        
    except Exception as e:
        print(f"Error executing Athena query: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True,
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }

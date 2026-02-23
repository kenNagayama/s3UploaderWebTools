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
    
    # 1. Verify custom header from CloudFront
    headers = event.get('headers') or {}
    expected_secret = os.environ.get('X_ORIGIN_VERIFY')
    # headers keys are lowercase in API Gateway proxy integration
    provided_secret = headers.get('x-origin-verify') or headers.get('X-Origin-Verify')
    
    if expected_secret and provided_secret != expected_secret:
        print(f"Forbidden: expected {expected_secret}, got {provided_secret}")
        return {
            'statusCode': 403,
            'body': json.dumps({'error': 'Forbidden'})
        }
    
    # Check if a specific pole number is queried
    query_params = event.get('queryStringParameters') or {}
    pole_number = query_params.get('pole_number')
    location = query_params.get('location')
    line_type = query_params.get('line_type')
    line_name = query_params.get('line_name')
    direction = query_params.get('direction')
    station = query_params.get('station')
    
    # Build Athena query with dynamic WHERE clause
    conditions = []
    
    if pole_number:
        conditions.append(f""""電柱番号" = '{pole_number.replace("'", "''")}'""")
    if location:
        # Use exact match to avoid matching other centers (e.g. 大宮電力設備技術センター vs 大宮電力メンテナンスセンター)
        safe_location = location.replace("'", "''")
        conditions.append(f""""箇所名" = '{safe_location}'""")
    if line_name and line_type:
        safe_line = line_name.replace("'", "''")
        if line_type == 'route':
            conditions.append(f""""行路名称" = '{safe_line}'""")
        elif line_type == 'line':
            conditions.append(f""""通称線名名称" = '{safe_line}'""")
    elif line_name:
        # Fallback if line_type not provided
        safe_line = line_name.replace("'", "''")
        conditions.append(f"""("通称線名名称" LIKE '%{safe_line}%' OR "行路名称" LIKE '%{safe_line}%')""")
    
    if direction:
        conditions.append(f""""線別名称" = '{direction.replace("'", "''")}'""")
    if station:
        conditions.append(f""""駅_駅々間名称" = '{station.replace("'", "''")}'""")
        
    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT "測定年月日", "電柱番号", "ハンガ位置", "摩耗_最小値", "新品時直径", "行路名称", "通称線名名称", "駅_駅々間名称"
        FROM {DATABASE}.{TABLE}
        {where_clause}
        ORDER BY "駅_駅々間名称" ASC, "電柱番号" ASC, "ハンガ位置" ASC, "測定年月日" ASC
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

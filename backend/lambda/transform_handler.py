import os
import boto3
import urllib.parse
import csv
import io

s3 = boto3.client('s3')

DEST_BUCKET = os.environ.get('DEST_BUCKET')

def clean_excel_formula(val):
    """
    Remove Excel formula syntax.
    Example: '="2020"' -> '2020'
    Example: '="001"' -> '001'
    """
    if val.startswith('="') and val.endswith('"'):
        return val[2:-1]
    return val

def handler(event, context):
    print(f"Received event: {event}")
    
    # Process each record in the S3 event
    for record in event.get('Records', []):
        source_bucket = record['s3']['bucket']['name']
        object_key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        
        print(f"Processing object s3://{source_bucket}/{object_key}")
        
        # Only process CSV files
        if not object_key.lower().endswith('.csv'):
            print(f"Skipping non-CSV file: {object_key}")
            continue
            
        try:
            # 1. Read object from source bucket
            response = s3.get_object(Bucket=source_bucket, Key=object_key)
            body = response['Body']
            
            # Read the raw bytes and decode using Shift-JIS
            raw_data = body.read()
            text_data = raw_data.decode('shift_jis', errors='replace')
            
            # 2. Process CSV line by line
            csv_reader = csv.reader(text_data.splitlines())
            
            output_io = io.StringIO()
            csv_writer = csv.writer(output_io, quoting=csv.QUOTE_MINIMAL)
            
            for row in csv_reader:
                # Clean each column
                cleaned_row = [clean_excel_formula(col) for col in row]
                csv_writer.writerow(cleaned_row)
            
            # 3. Upload to destination bucket
            cleaned_csv_content = output_io.getvalue().encode('utf-8')
            
            print(f"Uploading cleaned data to s3://{DEST_BUCKET}/{object_key} ({len(cleaned_csv_content)} bytes)")
            
            s3.put_object(
                Bucket=DEST_BUCKET,
                Key=object_key,
                Body=cleaned_csv_content,
                ContentType='text/csv'
            )
            
            print(f"Successfully processed {object_key}")
            
        except Exception as e:
            print(f"Error processing {object_key}: {e}")
            raise e
            
    return {
        'statusCode': 200,
        'body': 'Successfully processed S3 event'
    }

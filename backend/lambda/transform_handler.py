import os
import boto3
import urllib.parse
import csv
import codecs

s3 = boto3.client('s3')

DEST_BUCKET = os.environ.get('DEST_BUCKET')

def clean_excel_formula(val):
    if val.startswith('="') and val.endswith('"'):
        return val[2:-1]
    return val

def get_nominal_diameter(wire_type):
    wt = wire_type.strip()
    if wt in ['X', 'Y', 'Z', 'G', 'H', 'I', 'K', 'L', 'M']:
        return "15.49"
    elif wt in ['', 'B', 'C', ' ']:
        return "12.34"
    return "15.49"

def handler(event, context):
    print(f"Received event: {event}")
    
    for record in event.get('Records', []):
        source_bucket = record['s3']['bucket']['name']
        object_key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        
        print(f"Processing object s3://{source_bucket}/{object_key}")
        
        if not object_key.lower().endswith('.csv'):
            print(f"Skipping non-CSV file: {object_key}")
            continue
            
        try:
            # Output file in /tmp
            tmp_output_path = f"/tmp/{os.path.basename(object_key)}"
            
            # Read object as a stream
            response = s3.get_object(Bucket=source_bucket, Key=object_key)
            body = response['Body']
            
            # Stream body, decode and process line-by-line
            lines = codecs.iterdecode(body.iter_lines(), 'shift_jis', errors='replace')
            csv_reader = csv.reader(lines)
            
            with open(tmp_output_path, 'w', encoding='utf-8', newline='') as f:
                csv_writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
                
                for i, row in enumerate(csv_reader):
                    if i < 3:
                        continue
                    
                    cleaned_row = [clean_excel_formula(col) for col in row]
                    
                    if len(cleaned_row) < 83:
                        continue
                        
                    wire_type = cleaned_row[22]
                    nominal_dia = get_nominal_diameter(wire_type)
                    
                    base_info_1 = cleaned_row[0:33]
                    base_info_2 = cleaned_row[47:83]
                    
                    for hanger_pos in range(1, 15):
                        wear_val = cleaned_row[33 + hanger_pos - 1]
                        unpivoted_row = base_info_1 + base_info_2 + [str(hanger_pos), wear_val, nominal_dia]
                        csv_writer.writerow(unpivoted_row)
            
            # Upload the processed file
            print(f"Uploading cleaned data to s3://{DEST_BUCKET}/{object_key}")
            s3.upload_file(
                tmp_output_path,
                DEST_BUCKET,
                object_key,
                ExtraArgs={'ContentType': 'text/csv'}
            )
            
            # Clean up /tmp
            os.remove(tmp_output_path)
            
            print(f"Successfully processed {object_key}")
            
        except Exception as e:
            print(f"Error processing {object_key}: {e}")
            raise e
            
    return {
        'statusCode': 200,
        'body': 'Successfully processed S3 event'
    }

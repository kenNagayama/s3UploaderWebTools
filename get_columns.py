import boto3
import time

athena = boto3.client('athena', region_name='ap-northeast-1')
query = 'SELECT * FROM "tableau_access_db"."twins_digital_data" LIMIT 1'

response = athena.start_query_execution(
    QueryString=query,
    ResultConfiguration={'OutputLocation': 's3://tableau-access-bucket-cfw8200/'}
)
query_id = response['QueryExecutionId']

while True:
    status = athena.get_query_execution(QueryExecutionId=query_id)['QueryExecution']['Status']['State']
    if status in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
        break
    time.sleep(1)

if status == 'SUCCEEDED':
    results = athena.get_query_results(QueryExecutionId=query_id)
    columns = [col['VarCharValue'] for col in results['ResultSet']['Rows'][0]['Data']]
    print("Columns:", columns)
else:
    print("Failed or Cancelled:")
    print(athena.get_query_execution(QueryExecutionId=query_id)['QueryExecution']['Status'].get('StateChangeReason', 'Unknown'))

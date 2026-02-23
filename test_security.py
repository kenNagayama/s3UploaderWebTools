import urllib.request
import urllib.error
import urllib.parse
import json

CF_URL = "https://d176s6s9lrwevb.cloudfront.net"
API_GW_URL = "https://pm4sn6fk8i.execute-api.ap-northeast-1.amazonaws.com/prod"

print("--- Testing CloudFront /api/dashboard ---")
try:
    url = f"{CF_URL}/api/dashboard/?location={urllib.parse.quote('大宮電力メンテナンスセンター')}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Success! Response keys: {list(data.keys())}")
        print(f"Sample download URL: {data.get('download_url', 'None')[:50]}...")
except urllib.error.HTTPError as e:
    print(f"Failed via CloudFront: {e.code} {e.reason}")
    print(e.read().decode())

print("\n--- Testing Direct API Gateway Access (Should Fail with 403) ---")
try:
    url = f"{API_GW_URL}/api/dashboard/?location={urllib.parse.quote('大宮電力メンテナンスセンター')}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        print("WARNING: Direct access succeeded when it should have failed!")
except urllib.error.HTTPError as e:
    print(f"Success (Direct access blocked): {e.code} {e.reason}")
    print(e.read().decode())

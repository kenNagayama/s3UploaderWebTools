import urllib.request
import json
import pandas as pd

url = "https://pm4sn6fk8i.execute-api.ap-northeast-1.amazonaws.com/prod/dashboard?location=%E5%A4%A7%E5%AE%AE%E9%9B%BB%E5%8A%9B%E3%83%A1%E3%83%B3%E3%83%86%E3%83%8A%E3%83%B3%E3%82%B9%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    csv_url = data['download_url']

print(f"Downloading CSV from Athena: {csv_url}")
df = pd.read_csv(csv_url)
print("\n--- Basic Info ---")
print("Total rows:", len(df))
print("Unique poles:", df['電柱番号'].nunique())
print("Unique lines:", df['通称線名名称'].nunique())
print("Unique routes:", df['行路名称'].nunique())

print("\n--- First 5 Rows ---")
print(df.head())

print("\n--- Data Sample grouped by route and pole ---")
# Show how many poles exist for each route
summary = df.groupby('行路名称')['電柱番号'].nunique().reset_index()
print(summary)

print("\n--- Unique Values for '行路名称' ---")
print(df['行路名称'].unique())

print("\n--- Why is the frontend failing? ---")
# Check if there are any valid wear values
valid_wear = df['摩耗_最小値'].notna().sum()
print(f"Valid wear values count: {valid_wear}")

# Check dates formatting
print("Dates sample:", df['測定年月日'].head(5).tolist())

import pandas as pd
import numpy as np
import os
import re
import glob
from pymongo import MongoClient
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# 1. 데이터 통합
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
all_csv = sorted(glob.glob(os.path.join(DATA_DIR, '*.csv')))
frames = [pd.read_csv(f, dtype=str, encoding='cp949') for f in all_csv]
df = pd.concat(frames, ignore_index=True)

cols = ["collect_day", "pum_name", "good_name", "sales_price"]
df = df[cols]
df = df.rename(columns={'collect_day': 'date', 'pum_name': 'item_name', 'good_name': 'product_name', 'sales_price': 'price'})
df['price'] = pd.to_numeric(df['price'], errors='coerce')
df = df.dropna(subset=['price'])
df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')

# 2. 분석 대상 필터링
TARGET_ITEMS = ['삼겹살', '계란', '우유', '딸기']
df = df[df['item_name'].isin(TARGET_ITEMS)].copy()

# 3. 우유 flavor 분류

def classify_uw_flavor(name):
    s = str(name)
    func_keywords = ['멸균', '유기농', '저지방', '무지방', '고칼슘', '소화가 잘되는', 'A2', '단백', '프로틴']
    if any(x in s for x in func_keywords):
        return '가공/기능성 우유'
    if '딸기' in s:
        return '딸기우유'
    if '바나나' in s:
        return '바나나우유'
    if any(x in s for x in ['초코', '초콜릿', '쵸코']):
        return '초코우유'
    return '일반 흰우유'

def extract_bundle_count(prod_name):
    s = str(prod_name)
    patterns = [
        r'(\d+)\s*개입', r'(\d+)\s*개', r'(\d+)\s*입', r'(\d+)\s*팩', r'(\d+)\s*롤', r'(\d+)\s*병',
        r'[x\*]\s*(\d+)', r'\((?:[^\d]*)(\d+)\s*[x\*]\s*(\d+)\)',
    ]
    m = re.search(patterns[-1], s, re.IGNORECASE)
    if m:
        return int(m.group(2))
    for pat in patterns[:-1]:
        m = re.search(pat, s, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return 1

def extract_quantity_unit(prod_name, item_name):
    s = str(prod_name)
    if item_name == '우유':
        m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(ml|l)', s, re.IGNORECASE)
        if m:
            qty = float(m.group(1))
            unit = m.group(2).lower()
            return qty, unit
    if item_name in ['삼겹살', '딸기']:
        m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(kg|g)', s, re.IGNORECASE)
        if m:
            qty = float(m.group(1)) * (1000 if m.group(2).lower() == 'kg' else 1)
            return qty, 'g'
    if item_name == '계란':
        m = re.search(r'(\d+)\s*구', s)
        if m:
            return int(m.group(1)), '구'
    return None, None

def normalize_price(row):
    name = row['item_name']
    prod = row['product_name']
    price = row['price']
    bundle_count = extract_bundle_count(prod)
    unit_price = price / bundle_count if bundle_count > 0 else price
    qty, unit = extract_quantity_unit(prod, name)
    if qty is None or unit is None or qty == 0:
        return np.nan, '', ''
    if name == '삼겹살' and unit == 'g':
        return unit_price / qty * 100, '100g', ''
    if name == '계란' and unit == '구':
        return unit_price * (30 / qty), '30개', ''
    if name == '우유' and unit in ['ml', 'l']:
        vol = qty * (1 if unit == 'ml' else 1000)
        return unit_price * (1000 / vol), '1L', ''
    if name == '딸기' and unit == 'g':
        return unit_price * (1000 / qty), '1kg', ''
    return np.nan, '', ''

# 4. flavor 분류 및 용량 필터링 적용
df['flavor'] = None
if '우유' in df['item_name'].values:
    mask_uw = df['item_name'] == '우유'
    df.loc[mask_uw, 'flavor'] = df.loc[mask_uw, 'product_name'].apply(classify_uw_flavor)
    qtys, units = zip(*df.loc[mask_uw, 'product_name'].map(lambda x: extract_quantity_unit(x, '우유')))
    df.loc[mask_uw, 'qty'] = qtys
    df.loc[mask_uw, 'unit'] = units
    ml_per_unit = []
    for q, u in zip(qtys, units):
        if q is None or u is None:
            ml_per_unit.append(None)
        elif u == 'ml':
            ml_per_unit.append(q)
        elif u == 'l':
            ml_per_unit.append(q * 1000)
        else:
            ml_per_unit.append(None)
    df.loc[mask_uw, 'ml_per_unit'] = ml_per_unit
    mask_white = (df['flavor'] == '일반 흰우유')
    mask_vol = (df['ml_per_unit'] >= 900) & (df['ml_per_unit'] <= 1000)
    df = df[~mask_uw | (mask_white & mask_vol) | (df['flavor'] != '일반 흰우유')]
    mask = (mask_uw & df['flavor'].isnull())
    mask = mask.reindex(df.index, fill_value=False)
    df = df.loc[~mask]

df.loc[df['flavor'].isnull(), 'flavor'] = df['item_name']

df[['std_price', 'std_unit', '_']] = df.apply(lambda row: pd.Series(normalize_price(row)), axis=1)
df = df.dropna(subset=['std_price'])

def trim_outliers(df, group_cols, value_col):
    def trim_group(g):
        s = g[value_col].sort_values()
        n = len(s)
        lower = int(n * 0.05)
        upper = int(n * 0.95)
        trimmed = s.iloc[lower:upper] if upper > lower else s
        g = g.loc[trimmed.index]
        return g
    return df.groupby(group_cols, group_keys=False).apply(trim_group).reset_index(drop=True)

df = trim_outliers(df, ['date', 'flavor'], 'std_price')

daily_avg = (
    df.groupby(['date', 'flavor', 'std_unit'], as_index=False)['std_price']
    .mean()
)
daily_avg = daily_avg.sort_values(['flavor', 'date'])
daily_avg['prev_price'] = daily_avg.groupby(['flavor', 'std_unit'])['std_price'].shift(1)
daily_avg['change_pct'] = ((daily_avg['std_price'] - daily_avg['prev_price']) / daily_avg['prev_price'] * 100).round(1)

# 5. MongoDB Atlas에 저장
MONGO_URI = os.environ.get('MONGO_URI')  # 환경변수로 Atlas URI 지정
client = MongoClient(MONGO_URI)
db = client.get_default_database()
coll = db['daily_summaries']

# 기존 날짜 데이터 삭제 후 새로 insert (idempotent)
for date in daily_avg['date'].unique():
    coll.delete_many({'date': str(date.date())})

records = []
for _, row in daily_avg.iterrows():
    records.append({
        'date': str(row['date'].date()),
        'category': row['flavor'],
        'unit': row['std_unit'],
        'avg_price': int(round(row['std_price'])),
        'change_pct': None if pd.isna(row['change_pct']) else float(row['change_pct'])
    })
if records:
    coll.insert_many(records)

print(f"[완료] {len(records)}건의 일일 요약 데이터가 daily_summaries 컬렉션에 저장되었습니다.") 
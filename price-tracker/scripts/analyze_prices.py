import pandas as pd
import os
import re
import numpy as np
import glob
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# 1. 분석 대상 품목 정의
TARGET_ITEMS = ['삼겹살', '계란', '우유', '딸기']
STANDARD_UNIT = {
    '삼겹살': '100g',
    '계란': '30개',
    '우유': '1L',
    '딸기': '1kg',
}

# 2. 다중 CSV 파일 로드 및 통합
data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
all_csv = sorted(glob.glob(os.path.join(data_dir, '2025-06-*.csv')))
if not all_csv:
    raise FileNotFoundError('No 2025-06-*.csv files found in data directory.')
frames = []
for f in all_csv:
    df = pd.read_csv(f, dtype=str, encoding='cp949')
    frames.append(df)
df = pd.concat(frames, ignore_index=True)

cols = ["collect_day", "pum_name", "good_name", "sales_price"]
df = df[cols]
df = df.rename(columns={'collect_day': 'date', 'pum_name': 'item_name', 'good_name': 'product_name', 'sales_price': 'price'})
df['price'] = pd.to_numeric(df['price'], errors='coerce')
df = df.dropna(subset=['price'])
df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')

# 3. 분석 대상 필터링 (4개 품목만)
df = df[df['item_name'].isin(TARGET_ITEMS)].copy()

# 4. 우유 flavor 분류 함수 (가공/기능성 우유 우선)
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

# 5. flavor 분류 및 용량 필터링 적용
df['flavor'] = None
if '우유' in df['item_name'].values:
    mask_uw = df['item_name'] == '우유'
    df.loc[mask_uw, 'flavor'] = df.loc[mask_uw, 'product_name'].apply(classify_uw_flavor)
    # 우유 용량 추출
    qtys, units = zip(*df.loc[mask_uw, 'product_name'].map(lambda x: extract_quantity_unit(x, '우유')))
    df.loc[mask_uw, 'qty'] = qtys
    df.loc[mask_uw, 'unit'] = units
    # 개당 용량(ml) 계산
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
    # '일반 흰우유'만 800ml~1200ml 범위 필터 적용
    mask_white = (df['flavor'] == '일반 흰우유')
    mask_vol = (df['ml_per_unit'] >= 800) & (df['ml_per_unit'] <= 1200)
    df = df[~mask_uw | (mask_white & mask_vol) | (df['flavor'] != '일반 흰우유')]
    # flavor 없는 우유만 제거 (인덱스 일치 보장)
    mask = (mask_uw & df['flavor'].isnull())
    mask = mask.reindex(df.index, fill_value=False)
    df = df.loc[~mask]

# flavor 없는 나머지 품목(삼겹살, 계란, 딸기)은 flavor=품목명으로 지정
df.loc[df['flavor'].isnull(), 'flavor'] = df['item_name']

# 6. 표준 단위 환산 및 이상치(상하위 5%) 제거
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

# 7. 일자+flavor별 평균 및 등락률 계산
daily_avg = (
    df.groupby(['date', 'flavor', 'std_unit'], as_index=False)['std_price']
    .mean()
)
daily_avg = daily_avg.sort_values(['flavor', 'date'])
daily_avg['prev_price'] = daily_avg.groupby(['flavor', 'std_unit'])['std_price'].shift(1)
daily_avg['change_pct'] = ((daily_avg['std_price'] - daily_avg['prev_price']) / daily_avg['prev_price'] * 100).round(1)

# 8. 분석 기간별 가격 변동폭 계산 및 리포트 출력
start_date = daily_avg['date'].min().strftime('%Y-%m-%d')
end_date = daily_avg['date'].max().strftime('%Y-%m-%d')
print(f"분석 기간: {start_date} ~ {end_date}\n")

def print_report():
    flavor_order = [
        '일반 흰우유', '가공/기능성 우유', '초코우유', '바나나우유', '딸기우유',
        '삼겹살', '계란', '딸기'
    ]
    for flavor in flavor_order:
        group = daily_avg[daily_avg['flavor'] == flavor]
        if group.empty:
            continue
        std_unit = group['std_unit'].iloc[0]
        first = group.iloc[0]
        last = group.iloc[-1]
        price0 = int(round(first['std_price']))
        price1 = int(round(last['std_price']))
        if price0 == 0:
            continue
        change = ((price1 - price0) / price0 * 100)
        if change > 0:
            change_str = f"(+{change:.1f}%)"
        elif change < 0:
            change_str = f"({change:.1f}%)"
        else:
            change_str = "(변동 없음)"
        print(f"{flavor} ({std_unit} 기준): {price0:,}원 → {price1:,}원 {change_str}")

print_report() 
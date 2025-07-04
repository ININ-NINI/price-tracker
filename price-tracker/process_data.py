import os
import glob
import pandas as pd
from pymongo import MongoClient
from datetime import datetime
import numpy as np

# MongoDB Atlas 연결
MONGO_URI = os.environ.get('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client.get_default_database()
collection = db['daily_summaries']

def load_and_concat_csvs(data_dir='data'):
    files = glob.glob(os.path.join(data_dir, '*.csv'))
    df_list = [pd.read_csv(f) for f in files]
    return pd.concat(df_list, ignore_index=True)

def filter_and_process(df):
    # 1. 핵심 품목 4개만 필터링
    items = ['삼겹살', '계란', '우유', '딸기']
    df = df[df['품목명'].isin(items)].copy()
    # 2. 우유 세부 분류
    if '세부분류' in df.columns:
        df['세부분류'] = df['세부분류'].fillna('')
    else:
        df['세부분류'] = ''
    # 3. 일반 흰우유 900~1000ml만
    mask = ~((df['품목명'] == '우유') & (df['세부분류'] == '일반 흰우유') & ~df['용량'].between(900, 1000))
    df = df[mask]
    # 4. 표준 단위 환산 (예시)
    def normalize_price(row):
        if row['품목명'] == '삼겹살':
            return row['가격'] / row['용량'] * 100  # 100g당 가격
        if row['품목명'] == '계란':
            return row['가격'] / row['묶음수']      # 1판당 가격
        if row['품목명'] == '우유':
            return row['가격'] / row['용량'] * 1000 # 1L당 가격
        if row['품목명'] == '딸기':
            return row['가격'] / row['용량'] * 1000 # 1kg당 가격
        return row['가격']
    df['표준가격'] = df.apply(normalize_price, axis=1)
    # 5. 이상치 제거 (IQR)
    def remove_outliers(group):
        q1 = group['표준가격'].quantile(0.25)
        q3 = group['표준가격'].quantile(0.75)
        iqr = q3 - q1
        return group[(group['표준가격'] >= q1 - 1.5*iqr) & (group['표준가격'] <= q3 + 1.5*iqr)]
    df = df.groupby(['날짜', '품목명', '세부분류', '단위']).apply(remove_outliers).reset_index(drop=True)
    # 6. 일일 요약 데이터 생성
    summary = df.groupby(['날짜', '품목명', '단위']).agg(
        평균가격=('표준가격', 'mean')
    ).reset_index()
    # 7. 등락률 계산
    summary = summary.sort_values(['품목명', '날짜'])
    summary['등락률'] = summary.groupby('품목명')['평균가격'].pct_change().fillna(0).round(3) * 100
    return summary

def main():
    df = load_and_concat_csvs()
    summary = filter_and_process(df)
    # MongoDB에 저장 (날짜별로 upsert)
    for _, row in summary.iterrows():
        doc = row.to_dict()
        doc['date'] = doc.pop('날짜')
        collection.update_one(
            {'date': doc['date'], '품목명': doc['품목명'], '단위': doc['단위']},
            {'$set': doc},
            upsert=True
        )
    print('데이터 파이프라인 완료')

if __name__ == '__main__':
    main() 
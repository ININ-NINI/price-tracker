require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

// 미들웨어
app.use(express.json());

app.get('/api/summary', async (req, res) => {
  try {
    await client.connect();
    const db = client.db();
    const coll = db.collection('daily_summaries');
    // 가장 최신 날짜 구하기
    const latest = await coll.find().sort({ date: -1 }).limit(1).toArray();
    if (!latest.length) return res.json([]);
    const latestDate = latest[0].date;
    // 해당 날짜의 모든 요약 데이터 조회
    const result = await coll.find({ date: latestDate }).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// Vercel에서 사용할 수 있도록 app을 export
module.exports = app;
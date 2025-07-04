require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/summary', async (req, res) => {
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('daily_summaries');
    // 최신 날짜 찾기
    const latest = await collection.find().sort({ date: -1 }).limit(1).toArray();
    if (!latest.length) return res.json([]);
    const latestDate = latest[0].date;
    // 최신 날짜의 모든 요약 데이터 조회
    const summaries = await collection.find({ date: latestDate }).toArray();
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// 모든 나머지 라우트는 index.html로
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Vercel에서 사용할 수 있도록 app을 export
module.exports = app;
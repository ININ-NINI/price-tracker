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

// API가 아닌 요청에 대해서만 public 폴더를 서비스하도록 수정
// 이 부분은 vercel.json이 처리하므로 사실상 로컬 테스트용입니다.
app.use(express.static('public')); 

// 프론트엔드 라우트
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// 서버리스 환경에서는 listen을 호출하지 않을 수 있으므로,
// Vercel 환경이 아닐 때만 listen하도록 설정
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Vercel에서 사용할 수 있도록 app을 export
module.exports = app;
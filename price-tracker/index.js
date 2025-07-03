// 1. 환경 변수를 가장 먼저 불러옵니다.
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- 미들웨어 설정 ---
app.use(express.json());

// --- MongoDB 연결 ---
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB에 성공적으로 연결되었습니다.'))
  .catch(err => console.error('MongoDB 연결 실패:', err));

// --- 스키마 및 모델 정의 ---
const priceSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

const Price = mongoose.models.Price || mongoose.model('Price', priceSchema);

// --- API 라우트 ---
// 데이터 생성
app.post('/api/prices', async (req, res) => {
  try {
    const price = new Price(req.body);
    const savedPrice = await price.save();
    res.status(201).json(savedPrice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 데이터 조회 (가격 변동 포함)
app.get('/api/prices', async (req, res) => {
    try {
        const aggregation = await Price.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$itemName',
                    docs: { $push: '$$ROOT' }
                }
            },
            {
                $project: {
                    itemName: '$_id',
                    latestDoc: { $first: '$docs' },
                    previousDoc: { $arrayElemAt: ['$docs', 1] }
                }
            },
            {
                $project: {
                    _id: '$itemName',
                    itemName: '$itemName',
                    currentPrice: '$latestDoc.price',
                    lastUpdated: '$latestDoc.createdAt',
                    priceChange: {
                        $ifNull: [
                            { $subtract: ['$latestDoc.price', '$previousDoc.price'] },
                            0
                        ]
                    }
                }
            }
        ]);
        res.json(aggregation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 데이터 삭제
app.delete('/api/prices/:id', async (req, res) => {
  try {
    const result = await Price.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: '해당 ID의 데이터를 찾을 수 없습니다.' });
    }
    res.status(200).json({ message: '데이터가 성공적으로 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- 프론트엔드 제공 ---
// Express가 public 폴더의 파일들을 제공하도록 합니다.
app.use(express.static(path.join(__dirname, 'public')));
// 모든 그 외 요청은 index.html로 보냅니다 (Single Page App 스타일).
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- 서버 실행 ---
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
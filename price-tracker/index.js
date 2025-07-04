require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// 미들웨어 순서 중요: JSON 파싱을 먼저, 정적 파일은 나중에
app.use(express.json());
app.use(express.static('public'));

// MongoDB 연결 - 환경 변수 확인
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://ININ:ingu0325@cluster0.ppavhbw.mongodb.net/price-tracker?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB에 성공적으로 연결되었습니다.'))
  .catch(err => console.error('MongoDB 연결 실패:', err));

// 스키마 및 모델 정의
const PriceSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

const Price = mongoose.models.Price || mongoose.model('Price', PriceSchema);

// API 라우트
app.get('/api/prices', async (req, res) => {
    try {
        const data = await Price.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$itemName', docs: { $push: '$$ROOT' } } },
            { $project: {
                itemName: '$_id',
                latestDoc: { $first: '$docs' },
                previousDoc: { $arrayElemAt: ['$docs', 1] }
            }},
            { $project: {
                _id: 0,
                id: '$latestDoc._id',
                itemName: '$itemName',
                currentPrice: '$latestDoc.price',
                lastUpdated: '$latestDoc.createdAt',
                priceChange: { $ifNull: [{ $subtract: ['$latestDoc.price', '$previousDoc.price'] }, 0] }
            }}
        ]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/prices', async (req, res) => {
  try {
    const price = new Price(req.body);
    await price.save();
    res.status(201).json(price);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/prices/:id', async (req, res) => {
  try {
    const result = await Price.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "데이터를 찾지 못했습니다."});
    res.status(200).json({ message: "성공적으로 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 루트 경로 핸들러 추가
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 서버 실행
app.listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행 중입니다.`);
});
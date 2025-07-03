// 1. 우리가 설치한 express 라이브러리를 가져온다.
const express = require('express');
// 2. mongoose 라이브러리를 가져온다.
const mongoose = require('mongoose');

// 3. express를 실행해서 app 객체를 만든다. 이 app이 서버의 본체다.
const app = express();

// 4. 서버가 사용할 포트 번호를 정한다. 3000번 문을 사용하겠다는 의미.
const port = 3000;

// 5. JSON 형태의 데이터를 처리할 수 있도록 미들웨어를 추가한다.
app.use(express.json());

// public 폴더를 정적 파일 디렉토리로 제공
app.use(express.static('public'));

// 6. MongoDB 연결
const mongoUri = 'mongodb+srv://ININ:ingu0325@cluster0.ppavhbw.mongodb.net/price-tracker?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoUri);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 연결 오류:'));
db.once('open', () => {
  console.log('MongoDB에 성공적으로 연결되었습니다.');
});

// 7. Price 스키마 및 모델 정의
const priceSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

const Price = mongoose.model('Price', priceSchema);

// 8. POST 요청 처리 - 가격 데이터 추가
app.post('/api/prices', async (req, res) => {
  try {
    const price = new Price(req.body);
    const savedPrice = await price.save();
    res.status(201).json(savedPrice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. GET 요청 처리 - 모든 가격 데이터 조회
app.get('/api/prices', async (req, res) => {
  try {
    const result = await Price.aggregate([
      // 1. 최신순 정렬
      { $sort: { itemName: 1, createdAt: -1 } },
      // 2. 상품별로 그룹화, 최신 2개 가격만 배열로 저장
      {
        $group: {
          _id: "$itemName",
          itemName: { $first: "$itemName" },
          prices: { $push: "$price" },
          lastUpdated: { $first: "$createdAt" }
        }
      },
      // 3. 필요한 필드 가공
      {
        $project: {
          _id: 1,
          itemName: 1,
          currentPrice: { $arrayElemAt: ["$prices", 0] },
          priceChange: {
            $cond: [
              { $gt: [ { $size: "$prices" }, 1 ] },
              { $subtract: [ { $arrayElemAt: ["$prices", 0] }, { $arrayElemAt: ["$prices", 1] } ] },
              0
            ]
          },
          lastUpdated: 1
        }
      },
      // 4. 상품명 가나다순 정렬
      { $sort: { itemName: 1 } }
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. 서버 실행 전에 삭제 API 추가
app.delete('/api/prices/:id', async (req, res) => {
  try {
    const deleted = await Price.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: '해당 ID의 데이터가 존재하지 않습니다.' });
    }
    res.json({ message: '데이터가 성공적으로 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류로 삭제에 실패했습니다.' });
  }
});

// 10. 서버 실행
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});

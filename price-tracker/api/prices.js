const mongoose = require('mongoose');
const Price = require('../models/Price');

const connect = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
};

module.exports = async (req, res) => {
  await connect();
  if (req.method === 'GET') {
    try {
      const prices = await Price.find().sort({ createdAt: -1 });
      return res.status(200).json(prices);
    } catch (error) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }
  if (req.method === 'POST') {
    try {
      const { itemName, price } = req.body;
      const numericPrice = Number(price);
      if (!itemName || isNaN(numericPrice)) {
        return res.status(400).json({ error: '상품명과 가격을 모두 입력해주세요.' });
      }
      const existingItem = await Price.findOne({ itemName });
      if (existingItem) {
        const priceChange = numericPrice - existingItem.currentPrice;
        existingItem.currentPrice = numericPrice;
        existingItem.priceChange = priceChange;
        existingItem.lastUpdated = new Date();
        await existingItem.save();
        return res.status(200).json(existingItem);
      } else {
        const newPrice = new Price({
          itemName,
          currentPrice: numericPrice,
          priceChange: 0
        });
        await newPrice.save();
        return res.status(201).json(newPrice);
      }
    } catch (error) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}; 
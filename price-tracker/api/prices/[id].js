const mongoose = require('mongoose');
const Price = require('../../models/Price');

const connect = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
};

module.exports = async (req, res) => {
  await connect();
  if (req.method === 'DELETE') {
    try {
      let { id } = req.query;
      const realId = Array.isArray(id) ? id[0] : id;
      if (!mongoose.Types.ObjectId.isValid(realId)) {
        return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
      }
      const deletedPrice = await Price.findByIdAndDelete(realId);
      if (!deletedPrice) {
        return res.status(404).json({ error: '해당 데이터를 찾을 수 없습니다.' });
      }
      return res.status(200).json({ message: '데이터가 성공적으로 삭제되었습니다.' });
    } catch (error) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}; 
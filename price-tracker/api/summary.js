const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('daily_summaries');
    const latest = await collection.find().sort({ date: -1 }).limit(1).toArray();
    if (!latest.length) return res.json([]);
    const latestDate = latest[0].date;
    const summaries = await collection.find({ date: latestDate }).toArray();
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
}; 
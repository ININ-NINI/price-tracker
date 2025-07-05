require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');

const app = express();
const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

app.use(express.json());

app.get('/summary', async (req, res) => {
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
});

module.exports = app; 
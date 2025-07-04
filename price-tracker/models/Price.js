const mongoose = require('mongoose');

const PriceSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  currentPrice: { type: Number, required: true },
  priceChange: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Price || mongoose.model('Price', PriceSchema); 
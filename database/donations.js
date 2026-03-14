const mongoose = require('./config');

const donationSchema = new mongoose.Schema({
    user_name: String,
    discord_tag: String,
    clan_name: String,
    amount: Number,
    notes: String,
    date: { type: Date, default: Date.now },
    payment_status: String
});

const Donation = mongoose.model('Donation', donationSchema);
module.exports = Donation;
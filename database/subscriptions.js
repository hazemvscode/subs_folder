const mongoose = require('./config');

const subscriptionSchema = new mongoose.Schema({
    user_name: String,
    discord_tag: String,
    discord_id: String,
    tacticool_id: String,
    clan_name: String,
    server_id: String,
    subscription_type: String, // monthly / yearly
    start_date: Date,
    end_date: Date,
    payment_status: String,
    payment_id: String,
    notes: String,
    join_date: { type: Date, default: Date.now },
    is_banned: { type: Boolean, default: false },
    reminder_sent: { type: Boolean, default: false }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;

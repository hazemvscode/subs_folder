const mongoose = require('mongoose');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/subsDB';

mongoose.connect(DB_URI)
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database error:', err));

module.exports = mongoose;

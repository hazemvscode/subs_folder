const express = require('express');
const path = require('path');

const app = express();
const routes = require('./routes/routes');

const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

// HTTPS is handled by Railway at the edge — no redirect middleware needed.

app.use(express.static(path.join(__dirname, 'public')));
app.use('/user', express.static(path.join(__dirname, 'user')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/api/paypal/webhook', express.raw({ type: '*/*' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', routes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

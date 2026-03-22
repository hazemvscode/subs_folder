require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const routes = require('./routes/routes');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'tactiopbot.com';
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use((req, res, next) => {
    if (!FORCE_HTTPS) return next();

    const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const isSecure = req.secure || forwardedProto === 'https';
    const requestHost = (req.headers.host || '').toLowerCase();

    if (isSecure && requestHost === CANONICAL_HOST.toLowerCase()) return next();

    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/user', express.static(path.join(__dirname, 'user')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/api/paypal/webhook', express.raw({ type: '*/*' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', routes);

app.listen(PORT, HOST, () => {
    console.log('Server started successfully');
    console.log(`http://${HOST}:${PORT}`);
});

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('../database/config');

const app = express();
const routes = require('./routes/routes');
const Subscription = require('../database/subscriptions');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'tactiopbot.com';
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';

// Admin login (as requested: hardcoded)
const ADMIN_EMAIL = 'mazenabosenna15@gmail.com';
const ADMIN_PASSWORD = 'hazemmazen10';
const adminSessions = new Set();
const userSessions = new Set();

const parseCookies = (req) => {
    const header = req.headers.cookie || '';
    return header.split(';').reduce((acc, part) => {
        const [rawKey, ...rest] = part.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
};

const adminAuth = (req, res, next) => {
    const cookies = parseCookies(req);
    const token = cookies.admin_auth;
    if (token && adminSessions.has(token)) return next();
    return res.redirect('/admin/login');
};

const userAuth = (req, res, next) => {
    const cookies = parseCookies(req);
    const token = cookies.user_auth;
    if (token && userSessions.has(token)) return next();
    return res.redirect('/user/login');
};

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
app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Admin login routes (must be before auth middleware)
app.get('/admin/login', (req, res) => {
    res.sendFile('login.html', { root: __dirname + '/admin/' });
});

app.post('/admin/login', (req, res) => {
    const { email, password } = req.body || {};
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = crypto.randomUUID();
        adminSessions.add(token);
        res.setHeader('Set-Cookie', `admin_auth=${token}; HttpOnly; Path=/; SameSite=Lax`);
        return res.redirect('/admin/dashboard');
    }
    return res.status(401).send('Invalid email or password.');
});

app.post('/admin/logout', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies.admin_auth;
    if (token) adminSessions.delete(token);
    res.setHeader('Set-Cookie', 'admin_auth=; Max-Age=0; Path=/; SameSite=Lax');
    return res.redirect('/admin/login');
});

// User login routes
app.get('/user/login', (req, res) => {
    res.sendFile('login.html', { root: __dirname + '/user/' });
});

app.post('/user/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).send('Email and password are required.');

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.redirect('/admin/login');
    }

    const token = crypto.randomUUID();
    userSessions.add(token);
    res.setHeader('Set-Cookie', `user_auth=${token}; HttpOnly; Path=/; SameSite=Lax`);
    return res.redirect('/home');
});

app.post('/user/logout', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies.user_auth;
    if (token) userSessions.delete(token);
    res.setHeader('Set-Cookie', 'user_auth=; Max-Age=0; Path=/; SameSite=Lax');
    return res.redirect('/user/login');
});

// Subscription intake (basic)
app.post('/api/subscriptions', async (req, res) => {
    try {
        const {
            user_name,
            discord_tag,
            discord_id,
            tacticool_id,
            clan_name,
            server_id,
            subscription_type
        } = req.body || {};

        if (!user_name || !discord_tag || !discord_id || !tacticool_id || !server_id || !subscription_type) {
            return res.status(400).json({ ok: false, error: 'Missing required fields.' });
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        if (subscription_type === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            endDate.setMonth(endDate.getMonth() + 1);
        }

        await Subscription.create({
            user_name,
            discord_tag,
            discord_id,
            tacticool_id,
            clan_name,
            server_id,
            subscription_type,
            start_date: startDate,
            end_date: endDate,
            payment_status: 'pending'
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error('Subscription create failed:', err);
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

// Admin API
app.get('/api/admin/users', adminAuth, async (req, res) => {
    const users = await Subscription.find().sort({ join_date: -1 });
    return res.json(users);
});

app.post('/api/admin/users/:id/ban', adminAuth, async (req, res) => {
    await Subscription.findByIdAndUpdate(req.params.id, { is_banned: true });
    return res.json({ ok: true });
});

app.post('/api/admin/users/:id/unban', adminAuth, async (req, res) => {
    await Subscription.findByIdAndUpdate(req.params.id, { is_banned: false });
    return res.json({ ok: true });
});

app.post('/api/admin/users/:id/delete', adminAuth, async (req, res) => {
    await Subscription.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
});

app.get('/api/admin/subscriptions', adminAuth, async (req, res) => {
    const subs = await Subscription.find().sort({ start_date: -1 });
    return res.json(subs);
});

app.get('/api/admin/payments', adminAuth, async (req, res) => {
    const subs = await Subscription.find().sort({ start_date: -1 });
    const payments = subs.map(sub => ({
        user_name: sub.user_name,
        subscription_type: sub.subscription_type,
        amount: sub.subscription_type === 'yearly' ? '$100' : '$10',
        payment_status: sub.payment_status || 'pending',
        payment_date: sub.start_date,
        payment_id: sub.payment_id || '--'
    }));
    return res.json(payments);
});

// Protect admin pages + assets
app.use('/admin', adminAuth, express.static(path.join(__dirname, 'admin')));

// Landing page is login
app.get('/', (req, res) => {
    return res.redirect('/user/login');
});

// Require login to access user pages
app.use((req, res, next) => {
    const protectedPaths = ['/home', '/user/subscription', '/user/support'];
    if (protectedPaths.includes(req.path)) {
        return userAuth(req, res, next);
    }
    return next();
});

app.use('/', routes);

app.listen(PORT, HOST, () => {
    console.log('Server started successfully');
    console.log(`http://${HOST}:${PORT}`);
});

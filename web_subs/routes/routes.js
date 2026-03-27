const express = require('express');
const router = express.Router();
const store = require('../../database/store');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');

const PRICING = {
    monthly: { amount: 6, months: 1 },
    yearly: { amount: 60, months: 12 }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mazenabosenna15@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hazemmazen';
const TEST_USER_EMAIL = (process.env.TEST_USER_EMAIL || 'mazenabosenna15@gmail.com').toLowerCase();
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'hazemmazen';
const ADMIN_COOKIE = 'admin_auth';
const USER_EMAIL_COOKIE = 'user_email';
const BOT_INVITE_LINK = 'https://discord.com/oauth2/authorize?client_id=1344047946638954716&scope=bot%20applications.commands&permissions=8';
const PW_ITERATIONS = 120000;
const PW_KEYLEN = 64;
const PW_DIGEST = 'sha512';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || 'USD').toUpperCase();
const normalizeBaseUrl = (value) => {
    const raw = (value || '').trim();
    if (!raw) return 'http://localhost:3000';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProtocol.replace(/\/$/, '');
};
const PUBLIC_BASE_URL = normalizeBaseUrl(process.env.PUBLIC_BASE_URL || 'http://localhost:3000');
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
const ALLOWED_SERVER_ID = process.env.ALLOWED_SERVER_ID || '1085614826233016411';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || 'no-reply@example.com';
const PAYPAL_ME_LINK = (process.env.PAYPAL_ME_LINK || 'https://paypal.me/mazenabosenna').replace(/\/$/, '');
const CLAIM_ACCESS_HOURS = Number(process.env.CLAIM_ACCESS_HOURS || 24);

const hashPassword = (password, salt) => {
    return crypto.pbkdf2Sync(password, salt, PW_ITERATIONS, PW_KEYLEN, PW_DIGEST).toString('hex');
};

const isClaimAccessValid = (sub, now = new Date()) => {
    if (!sub || sub.payment_status !== 'claimed') return false;
    const claimedAt = sub.payment_claimed_at ? new Date(sub.payment_claimed_at) : null;
    const end = sub.end_date ? new Date(sub.end_date) : null;
    if (!claimedAt || Number.isNaN(claimedAt.getTime())) return false;
    if (!end || Number.isNaN(end.getTime()) || end <= now) return false;
    const validUntil = new Date(claimedAt.getTime() + (CLAIM_ACCESS_HOURS * 60 * 60 * 1000));
    return validUntil > now;
};

const hasSubscriptionAccess = (sub, now = new Date()) => {
    if (!sub || sub.is_banned === true) return false;
    const end = sub.end_date ? new Date(sub.end_date) : null;
    if (!end || Number.isNaN(end.getTime()) || end <= now) return false;
    return sub.payment_status === 'active' || isClaimAccessValid(sub, now);
};

const paypalConfigured = () => PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET;

const getPaypalAccessToken = async () => {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'PayPal auth failed');
    return data.access_token;
};

const createPaypalOrder = async ({ amount, customId, description }) => {
    const accessToken = await getPaypalAccessToken();
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: PAYPAL_CURRENCY, value: amount.toFixed(2) },
                description: description || undefined,
                custom_id: customId
            }],
            application_context: {
                brand_name: 'Tactiop Bot',
                return_url: `${PUBLIC_BASE_URL}/user/status?paid=1`,
                cancel_url: `${PUBLIC_BASE_URL}/user/subscription?cancel=1`
            }
        })
    });
    const data = await res.json();
    if (!res.ok) {
        const issue = data?.details?.map(d => d.description).filter(Boolean).join(' | ');
        throw new Error(issue || data.message || data.error_description || 'PayPal order failed');
    }
    return data;
};

const capturePaypalOrder = async (orderId) => {
    const accessToken = await getPaypalAccessToken();
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'PayPal capture failed');
    return data;
};

const verifyPaypalWebhook = async (headers, body) => {
    if (!PAYPAL_WEBHOOK_ID) return false;
    const accessToken = await getPaypalAccessToken();
    const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: PAYPAL_WEBHOOK_ID,
            webhook_event: body
        })
    });
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
};

const parseCookies = (cookieHeader) => {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const [key, ...rest] = part.trim().split('=');
        acc[key] = decodeURIComponent(rest.join('=') || '');
        return acc;
    }, {});
};

const setUserEmailCookie = (res, email) => {
    res.append('Set-Cookie', `${USER_EMAIL_COOKIE}=${encodeURIComponent(email)}; Path=/; SameSite=Lax`);
};

let mailTransporter = null;

const emailConfigured = () => SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS;

const getMailTransporter = () => {
    if (!emailConfigured()) return null;
    if (mailTransporter) return mailTransporter;
    mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
    return mailTransporter;
};

const sendSubscriptionSuccessEmail = async (subscription) => {
    if (!subscription?.payer_email || !emailConfigured() || subscription.purchase_email_sent_at) {
        return false;
    }

    const transporter = getMailTransporter();
    if (!transporter) return false;

    const plan = subscription.subscription_type === 'yearly' ? 'yearly' : 'monthly';
    const subject = `Your ${plan} bot subscription is active`;
    const lines = [
        `Hello${subscription.user_name ? ` ${subscription.user_name}` : ''},`,
        '',
        `You have successfully bought the ${plan} subscription.`,
        '',
        ...(PAYPAL_MODE === 'sandbox' ? [
            'Note: this is test servers, means that you did not send any real money.',
            ''
        ] : []),
        'Here is your bot invite link:',
        BOT_INVITE_LINK,
        '',
        'If you already have the bot, you can ignore the invite link.',
        '',
        `Allowed server ID: ${ALLOWED_SERVER_ID}`,
        '',
        'Thank you for your support.'
    ];

    await transporter.sendMail({
        from: MAIL_FROM,
        to: subscription.payer_email,
        subject,
        text: lines.join('\n')
    });

    store.updateSubscriptionById(subscription._id, {
        purchase_email_sent_at: new Date().toISOString()
    });
    return true;
};

const sendAdminPurchaseEmail = async (subscription) => {
    if (!emailConfigured() || !ADMIN_EMAIL || subscription.admin_email_sent_at) {
        return false;
    }

    const transporter = getMailTransporter();
    if (!transporter) return false;

    const plan = subscription.subscription_type === 'yearly' ? 'yearly' : 'monthly';
    const subject = `Payment successful: ${plan} subscription`;
    const lines = [
        'A customer completed a successful payment on your website.',
        '',
        `Plan: ${plan}`,
        `Amount: ${subscription.amount ?? ''} ${PAYPAL_CURRENCY}`,
        `Payment ID: ${subscription.payment_id || 'N/A'}`,
        `Payment Date: ${subscription.payment_date || new Date().toISOString()}`,
        ...(PAYPAL_MODE === 'sandbox' ? [
            'Note: this is test servers, means that you did not get any money.',
            ''
        ] : []),
        `Name: ${subscription.user_name || 'N/A'}`,
        `Email: ${subscription.payer_email || 'N/A'}`,
        `Discord Name: ${subscription.discord_tag || 'N/A'}`,
        `Discord ID: ${subscription.discord_id || 'N/A'}`,
        `Game ID: ${subscription.tacticool_id || 'N/A'}`,
        `Clan Name: ${subscription.clan_name || 'N/A'}`,
        `Server ID: ${subscription.server_id || 'N/A'}`,
        '',
        `The customer paid to you ${plan} successfully.`
    ];

    await transporter.sendMail({
        from: MAIL_FROM,
        to: ADMIN_EMAIL,
        subject,
        text: lines.join('\n')
    });

    store.updateSubscriptionById(subscription._id, {
        admin_email_sent_at: new Date().toISOString()
    });
    return true;
};

const sendAdminClaimEmail = async (subscription) => {
    if (!emailConfigured() || !ADMIN_EMAIL) return false;
    const transporter = getMailTransporter();
    if (!transporter) return false;

    const plan = subscription.subscription_type === 'yearly' ? 'yearly' : 'monthly';
    const lines = [
        'A user claimed they sent a PayPal.Me payment and temporary access was unlocked.',
        '',
        `Plan: ${plan}`,
        `Expected Amount: ${subscription.amount ?? ''} USD`,
        `Name: ${subscription.user_name || 'N/A'}`,
        `Email: ${subscription.payer_email || 'N/A'}`,
        `Discord Name: ${subscription.discord_tag || 'N/A'}`,
        `Discord ID: ${subscription.discord_id || 'N/A'}`,
        `Game ID: ${subscription.tacticool_id || 'N/A'}`,
        `Clan Name: ${subscription.clan_name || 'N/A'}`,
        `Server ID: ${subscription.server_id || 'N/A'}`,
        '',
        `Temporary access window: ${CLAIM_ACCESS_HOURS} hours`,
        'Please verify the PayPal payment manually and then confirm or cancel access in admin.'
    ];

    await transporter.sendMail({
        from: MAIL_FROM,
        to: ADMIN_EMAIL,
        subject: `Payment claim pending verification: ${plan}`,
        text: lines.join('\n')
    });
    return true;
};

const activateSubscriptionAndNotify = async (subscription, paymentId, extraUpdates = {}) => {
    const updated = store.updateSubscriptionById(subscription._id, {
        payment_status: 'active',
        payment_date: new Date().toISOString(),
        payment_id: paymentId || subscription.payment_id,
        ...extraUpdates
    });

    try {
        await sendSubscriptionSuccessEmail(updated);
    } catch (err) {
        console.error('Failed to send subscription email:', err.message || err);
    }

    try {
        await sendAdminPurchaseEmail(updated);
    } catch (err) {
        console.error('Failed to send admin payment email:', err.message || err);
    }

    return updated;
};

const isAdminAuthed = (req) => {
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[ADMIN_COOKIE] === '1';
};

const requireAdmin = (req, res, next) => {
    if (isAdminAuthed(req)) return next();
    return res.status(401).send('Unauthorized');
};

const addMonths = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0);
    return d;
};

const parseDateInput = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
};

router.get('/home', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bot Subscriptions</title>
    
    <!-- Icon and Social Banner -->
    <link rel="icon" type="image/png" href="/images/icon/icon.png">
    <meta property="og:title" content="Tactiop Bot Subscriptions">
    <meta property="og:description" content="Clean, organized automation for serious clans.">
    <meta property="og:image" content="${PUBLIC_BASE_URL}/images/banner/banner.jpg">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${PUBLIC_BASE_URL}">
    <meta name="twitter:card" content="summary_large_image">

    <link rel="stylesheet" href="/blue_galaxy.css" />
    <style>
        * { box-sizing: border-box; }
        body { padding: 36px 22px 70px; }
        .wrap { max-width: 1160px; margin: 0 auto; position: relative; z-index: 2; display: grid; gap: 26px; }
        .nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: 0.5px; }
        .nav-pill { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(20,20,20,0.15); background: rgba(255,255,255,0.7); font-size: 0.8rem; color: var(--muted); }
        .nav-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .hero { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-items: center; }
        .hero h1 { font-size: clamp(2.3rem, 4.5vw, 3.4rem); margin: 0; }
        .hero p { color: var(--muted); font-size: 1.05rem; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .ghost { background: transparent; color: var(--ink); border: 1px solid rgba(20,20,20,0.2); box-shadow: none; }
        .hero-card { padding: 22px; border-radius: 20px; background: rgba(255,255,255,0.8); border: 1px solid rgba(20,20,20,0.08); box-shadow: 0 18px 35px rgba(20,20,20,0.12); display: grid; gap: 12px; }
        .price { font-size: 2rem; font-weight: 700; }
        .pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(20,20,20,0.15); background: rgba(255,255,255,0.7); font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.7px; }
        .section { display: grid; gap: 14px; }
        .section h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.1rem); }
        .features { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .feature { padding: 16px; border-radius: 16px; border: 1px solid rgba(20,20,20,0.08); background: rgba(255,255,255,0.85); box-shadow: 0 12px 26px rgba(20,20,20,0.08); }
        .feature h3 { margin: 0 0 6px; }
        .muted { color: var(--muted); }
        .pricing { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .price-card { padding: 20px; border-radius: 18px; background: rgba(255,255,255,0.9); border: 1px solid rgba(20,20,20,0.1); box-shadow: 0 16px 30px rgba(20,20,20,0.12); display: grid; gap: 10px; }
        .price-card.highlight { border: 2px solid rgba(255,107,74,0.4); }
        .price-card .tag { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); }
        .stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
        .stat { padding: 14px; border-radius: 14px; border: 1px solid rgba(20,20,20,0.08); background: rgba(255,255,255,0.85); text-align: center; }
        .stat strong { display: block; font-size: 1.4rem; }
        .cta { display: grid; gap: 10px; padding: 22px; border-radius: 20px; border: 1px solid rgba(20,20,20,0.1); background: linear-gradient(135deg, rgba(255,107,74,0.12), rgba(31,157,139,0.12)); }
        .socials { display: flex; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 720px) {
            body { padding: 28px 16px 60px; }
        }

        /* Powerful Animations */
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hero h1, .hero p, .hero-actions, .hero-card, .feature, .price-card, .stat, .cta {
            animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .hero-card { animation-delay: 0.2s; }
        .feature:nth-child(1) { animation-delay: 0.3s; }
        .feature:nth-child(2) { animation-delay: 0.4s; }
        .feature:nth-child(3) { animation-delay: 0.5s; }
        .feature:nth-child(4) { animation-delay: 0.6s; }

        .feature:hover, .price-card:hover {
            transform: translateY(-8px) scale(1.02);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="nav">
            <div class="nav-brand">
                <span class="nav-pill">Tactiop Bot</span>
                <span>Subscriptions</span>
            </div>
            <div class="nav-actions">
                <a class="button ghost" href="/user/login">Login</a>
                <a class="button" href="/user/subscription">Subscribe</a>
                <button class="button secondary" data-action="toggle-theme" type="button">Dark Mode</button>
            </div>
        </div>

        <section class="hero">
            <div>
                <h1 class="neon-text">Clean, organized automation for serious clans.</h1>
                <p>Everything you need to run missions faster, answer questions instantly, and keep your server synchronized.</p>
                <div class="hero-actions">
                    <a class="button" href="/user/subscription">Start Subscription</a>
                    <a class="button ghost" href="/user/support">Support The Project</a>
                </div>
                <div class="pill-row" style="margin-top:12px;">
                    <div class="pill">Verified Payments</div>
                    <div class="pill">Instant Setup</div>
                    <div class="pill">Community Driven</div>
                </div>
            </div>
            <div class="hero-card">
                <div class="tag muted">Most Popular</div>
                <div class="price">$6<span class="muted"> / month</span></div>
                <div class="muted">Upgrade anytime or save with yearly.</div>
                <div class="price">$60<span class="muted"> / year</span></div>
                <div class="hero-actions">
                    <a class="button" href="/user/subscription">Buy Subscription</a>
                    <a class="button ghost" href="/user/support">Donate</a>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Why clans choose this bot</h2>
            <div class="features">
                <div class="feature">
                    <h3>Clan Missions Generator</h3>
                    <p class="muted">Auto-create clean mission images with the best operators per mission.</p>
                </div>
                <div class="feature">
                    <h3>AI Assistant</h3>
                    <p class="muted">Ask questions and get instant answers inside Discord.</p>
                </div>
                <div class="feature">
                    <h3>Automation Tools</h3>
                    <p class="muted">Less manual work, more reliable results.</p>
                </div>
                <div class="feature">
                    <h3>Fast Slash Commands</h3>
                    <p class="muted">Simple, clean commands built for speed.</p>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Pricing</h2>
            <div class="pricing">
                <div class="price-card">
                    <div class="tag">Monthly</div>
                    <div class="price">$6</div>
                    <div class="muted">Perfect for getting started.</div>
                    <a class="button" href="/user/subscription">Subscribe Monthly</a>
                </div>
                <div class="price-card highlight">
                    <div class="tag">Yearly</div>
                    <div class="price">$60</div>
                    <div class="muted">Save $12 vs monthly.</div>
                    <a class="button" href="/user/subscription">Subscribe Yearly</a>
                </div>
                <div class="price-card">
                    <div class="tag">Support</div>
                    <div class="price">Any amount</div>
                    <div class="muted">Help fund new features.</div>
                    <a class="button ghost" href="/user/support">Support Now</a>
                </div>
            </div>
        </section>

        <section class="section">
            <h2>Performance</h2>
            <div class="stats">
                <div class="stat"><strong>99.9%</strong><span class="muted">Reliability</span></div>
                <div class="stat"><strong>&lt; 1s</strong><span class="muted">Command Speed</span></div>
                <div class="stat"><strong>24/7</strong><span class="muted">Monitoring</span></div>
                <div class="stat"><strong>Global</strong><span class="muted">Clan Ready</span></div>
            </div>
        </section>

        <section class="cta">
            <h2>Ready to organize your server?</h2>
            <p class="muted">Subscribe now, then invite the bot right away.</p>
            <div class="hero-actions">
                <a class="button" href="/user/subscription">Start Subscription</a>
                <a class="button ghost" href="/user/login">Back To Login</a>
            </div>
            <div class="socials">
                <a class="button ghost" href="https://www.youtube.com/@MAZENEAGLEEYE" target="_blank" rel="noopener">YouTube</a>
                <a class="button ghost" href="https://www.instagram.com/mazeneagleeye?igsh=ZGNvbWJ6eHQwMDhj" target="_blank" rel="noopener">Instagram</a>
                <a class="button ghost" href="https://discord.com/users/1019254470191890473" target="_blank" rel="noopener">Discord Contact</a>
            </div>
        </section>
    </div>
    <script src="/script.js"></script>
</body>
</html>
    `);
});

router.get('/', (req, res) => {
    res.redirect('/user/login');
});

router.get('/user/login', (req, res) => {
    res.sendFile('login.html', { root: path.join(__dirname, '../user') });
});

router.get('/user/signup', (req, res) => {
    res.sendFile('signup.html', { root: path.join(__dirname, '../user') });
});

router.get('/user/subscription', (req, res) => {
    res.sendFile('subscription.html', { root: path.join(__dirname, '../user') });
});

router.get('/user/status', (req, res) => {
    res.sendFile('status.html', { root: path.join(__dirname, '../user') });
});

router.get('/user/support', (req, res) => {
    res.sendFile('support.html', { root: path.join(__dirname, '../user') });
});

router.get('/user/test-account', (req, res) => {
    res.sendFile('test-account.html', { root: path.join(__dirname, '../user') });
});

router.get('/user', (req, res) => {
    res.redirect('/user/login');
});

router.get('/admin/dashboard', requireAdmin, (req, res) => {
    res.sendFile('dashboard.html', { root: path.join(__dirname, '../admin') });
});

router.get('/admin/login', (req, res) => {
    res.sendFile('login.html', { root: path.join(__dirname, '../admin') });
});

router.post('/admin/login', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();

    if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax`);
        return res.redirect('/admin/dashboard');
    }

    return res.status(401).send('Invalid credentials');
});

router.post('/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return res.redirect('/user/login');
});

router.get('/admin/payments', requireAdmin, (req, res) => {
    res.sendFile('payments.html', { root: path.join(__dirname, '../admin') });
});

router.get('/admin/subscriptions', requireAdmin, (req, res) => {
    res.sendFile('subscriptions.html', { root: path.join(__dirname, '../admin') });
});

router.get('/api/paypal/status', (req, res) => {
    return res.json({
        ok: true,
        configured: paypalConfigured(),
        client_id: PAYPAL_CLIENT_ID,
        mode: PAYPAL_MODE,
        currency: PAYPAL_CURRENCY
    });
});

router.post('/api/auth/signup', async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const password = (req.body.password || '').trim();
        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Missing fields.' });
        }

        const existing = store.findUserByEmail(email);
        if (existing) {
            return res.status(400).json({ ok: false, error: 'Email already exists.' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const password_hash = hashPassword(password, salt);

        store.addUser({
            email,
            password_hash,
            salt,
            created_at: new Date().toISOString(),
            source: 'signup'
        });

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

router.post('/api/auth/login', async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const password = (req.body.password || '').trim();
        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Missing fields.' });
        }

        if (email === TEST_USER_EMAIL && password === TEST_USER_PASSWORD) {
            setUserEmailCookie(res, email);
            store.addLoginEvent({
                email,
                user_id: 'test-user',
                ip: req.ip,
                user_agent: req.headers['user-agent'] || '',
                date: new Date().toISOString(),
                source: 'test-account'
            });

            return res.json({
                ok: true,
                redirect: '/user/test-account',
                account_name: 'Test User Account'
            });
        }

        const user = store.findUserByEmail(email);
        if (!user || !user.password_hash || !user.salt) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
        }

        const check = hashPassword(password, user.salt);
        if (check !== user.password_hash) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
        }

        setUserEmailCookie(res, email);
        store.addLoginEvent({
            email,
            user_id: user._id,
            ip: req.ip,
            user_agent: req.headers['user-agent'] || '',
            date: new Date().toISOString()
        });

        return res.json({ ok: true, redirect: '/home' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

router.post('/api/subscriptions', async (req, res) => {
    try {
        const subscriptionType = (req.body.subscription_type || '').toLowerCase().trim();
        const pricing = PRICING[subscriptionType];
        if (!pricing) {
            return res.status(400).json({ ok: false, error: 'Invalid subscription type.' });
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const payerEmail = (cookies[USER_EMAIL_COOKIE] || req.body.email || '').trim().toLowerCase();

        const now = new Date();
        const endDate = addMonths(now, pricing.months);

        store.addSubscription({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            discord_id: req.body.discord_id,
            tacticool_id: req.body.tacticool_id,
            clan_name: req.body.clan_name,
            server_id: req.body.server_id,
            subscription_type: subscriptionType,
            amount: pricing.amount,
            payer_email: payerEmail,
            payment_method: req.body.payment_method,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            payment_status: 'pending',
            join_date: new Date().toISOString()
        });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

router.post('/api/subscriptions/start-paypalme', async (req, res) => {
    try {
        const subscriptionType = (req.body.subscription_type || '').toLowerCase().trim();
        const pricing = PRICING[subscriptionType];
        if (!pricing) {
            return res.status(400).json({ ok: false, error: 'Invalid subscription type.' });
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const payerEmail = (cookies[USER_EMAIL_COOKIE] || req.body.email || '').trim().toLowerCase();
        const now = new Date();
        const endDate = addMonths(now, pricing.months);
        const claimToken = crypto.randomBytes(18).toString('hex');

        const record = store.addSubscription({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            discord_id: req.body.discord_id,
            tacticool_id: req.body.tacticool_id,
            clan_name: req.body.clan_name,
            server_id: req.body.server_id,
            subscription_type: subscriptionType,
            amount: pricing.amount,
            payer_email: payerEmail,
            payment_method: 'paypal_me',
            payment_provider: 'paypal_me',
            payment_status: 'pending',
            payment_claim_token: claimToken,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            join_date: now.toISOString()
        });

        return res.json({
            ok: true,
            claim_token: claimToken,
            paypal_url: `${PAYPAL_ME_LINK}/${pricing.amount}`,
            amount: pricing.amount,
            item_id: record._id
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Failed to start PayPal payment.' });
    }
});

router.post('/api/subscriptions/claim-paypalme', async (req, res) => {
    try {
        const claimToken = (req.body.claim_token || '').trim();
        if (!claimToken) {
            return res.status(400).json({ ok: false, error: 'Missing claim token.' });
        }

        const sub = store.listSubscriptions().find(s => s.payment_claim_token === claimToken);
        if (!sub) {
            return res.status(404).json({ ok: false, error: 'Payment request not found.' });
        }

        if (sub.is_banned === true) {
            return res.status(403).json({ ok: false, error: 'This subscription is banned.' });
        }

        const updated = store.updateSubscriptionById(sub._id, {
            payment_status: 'claimed',
            payment_claimed_at: new Date().toISOString()
        });

        try {
            await sendAdminClaimEmail(updated);
        } catch (err) {
            console.error('Failed to send admin claim email:', err.message || err);
        }

        return res.json({
            ok: true,
            invite: BOT_INVITE_LINK,
            server_id: updated.server_id,
            discord_id: updated.discord_id,
            claim_hours: CLAIM_ACCESS_HOURS
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Failed to claim access.' });
    }
});

router.post('/api/paypal/create-order', async (req, res) => {
    try {
        if (!paypalConfigured()) {
            return res.status(400).json({ ok: false, error: 'PayPal not configured.' });
        }

        const subscriptionType = (req.body.subscription_type || '').toLowerCase().trim();
        const pricing = PRICING[subscriptionType];
        if (!pricing) {
            return res.status(400).json({ ok: false, error: 'Invalid subscription type.' });
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const payerEmail = (cookies[USER_EMAIL_COOKIE] || req.body.email || '').trim().toLowerCase();

        const now = new Date();
        const endDate = addMonths(now, pricing.months);

        const record = store.addSubscription({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            discord_id: req.body.discord_id,
            tacticool_id: req.body.tacticool_id,
            clan_name: req.body.clan_name,
            server_id: req.body.server_id,
            subscription_type: subscriptionType,
            amount: pricing.amount,
            payer_email: payerEmail,
            payment_method: req.body.payment_method,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            payment_status: 'pending',
            payment_provider: 'paypal',
            join_date: new Date().toISOString()
        });

        const order = await createPaypalOrder({
            amount: pricing.amount,
            customId: record._id,
            description: `Subscription (${subscriptionType})`
        });

        store.updateSubscriptionById(record._id, {
            paypal_order_id: order.id
        });

        const approve = (order.links || []).find(l => l.rel === 'approve');
        return res.json({ ok: true, approve_url: approve ? approve.href : '', order_id: order.id });
    } catch (err) {
        console.error('PayPal create-order failed:', err.message || err);
        return res.status(500).json({ ok: false, error: err.message || 'PayPal order failed.' });
    }
});

router.post('/api/paypal/create-donation-order', async (req, res) => {
    try {
        if (!paypalConfigured()) {
            return res.status(400).json({ ok: false, error: 'PayPal not configured.' });
        }

        const amount = Number(req.body.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ ok: false, error: 'Invalid amount.' });
        }

        const record = store.addDonation({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            clan_name: req.body.clan_name,
            amount,
            payment_method: req.body.payment_method,
            payment_status: 'pending',
            payment_provider: 'paypal',
            date: new Date().toISOString()
        });

        const order = await createPaypalOrder({
            amount,
            customId: record._id,
            description: 'Donation'
        });

        store.updateDonationById(record._id, {
            paypal_order_id: order.id
        });

        const approve = (order.links || []).find(l => l.rel === 'approve');
        return res.json({ ok: true, approve_url: approve ? approve.href : '', order_id: order.id });
    } catch (err) {
        console.error('PayPal create-donation-order failed:', err.message || err);
        return res.status(500).json({ ok: false, error: err.message || 'PayPal order failed.' });
    }
});

router.post('/api/paypal/capture-order', async (req, res) => {
    try {
        if (!paypalConfigured()) {
            return res.status(400).json({ ok: false, error: 'PayPal not configured.' });
        }

        const orderId = (req.body.order_id || req.body.orderId || '').trim();
        if (!orderId) return res.status(400).json({ ok: false, error: 'Missing order id.' });

        const capture = await capturePaypalOrder(orderId);
        const purchase = capture.purchase_units?.[0];
        const captureData = purchase?.payments?.captures?.[0];
        const amountValue = Number(captureData?.amount?.value || 0);
        const currency = captureData?.amount?.currency_code || PAYPAL_CURRENCY;
        const captureId = captureData?.id;

        let sub = store.findSubscriptionByPaypalOrderId(orderId);
        let donation = null;
        if (!sub) donation = store.findDonationByPaypalOrderId?.(orderId);

        if (sub) {
            const expected = PRICING[sub.subscription_type]?.amount || 0;
            if (currency !== PAYPAL_CURRENCY || Number(amountValue.toFixed(2)) !== Number(expected.toFixed(2))) {
                return res.status(400).json({ ok: false, error: 'Payment amount mismatch.' });
            }
            await activateSubscriptionAndNotify(sub, captureId);
            return res.json({ ok: true, type: 'subscription' });
        }

        if (donation) {
            const expected = Number(donation.amount || 0);
            if (currency !== PAYPAL_CURRENCY || Number(amountValue.toFixed(2)) !== Number(expected.toFixed(2))) {
                return res.status(400).json({ ok: false, error: 'Payment amount mismatch.' });
            }
            store.updateDonationById(donation._id, {
                payment_status: 'active',
                payment_date: new Date().toISOString(),
                payment_id: captureId || donation.payment_id
            });
            return res.json({ ok: true, type: 'donation' });
        }

        return res.status(404).json({ ok: false, error: 'Order not found.' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Capture failed.' });
    }
});

router.post('/api/paypal/complete-subscription', async (req, res) => {
    try {
        const subscriptionType = (req.body.subscription_type || '').toLowerCase().trim();
        const pricing = PRICING[subscriptionType];
        if (!pricing) {
            return res.status(400).json({ ok: false, error: 'Invalid subscription type.' });
        }

        const orderId = (req.body.order_id || '').trim();
        const captureId = (req.body.payment_id || '').trim();
        const currency = (req.body.currency || PAYPAL_CURRENCY).toUpperCase().trim();
        const amountValue = Number(req.body.amount || 0);
        if (!orderId || !captureId) {
            return res.status(400).json({ ok: false, error: 'Missing PayPal payment details.' });
        }
        if (currency !== PAYPAL_CURRENCY || Number(amountValue.toFixed(2)) !== Number(pricing.amount.toFixed(2))) {
            return res.status(400).json({ ok: false, error: 'Payment amount mismatch.' });
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const payerEmail = (cookies[USER_EMAIL_COOKIE] || req.body.email || '').trim().toLowerCase();
        const now = new Date();
        const endDate = addMonths(now, pricing.months);

        const record = store.addSubscription({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            discord_id: req.body.discord_id,
            tacticool_id: req.body.tacticool_id,
            clan_name: req.body.clan_name,
            server_id: req.body.server_id,
            subscription_type: subscriptionType,
            amount: pricing.amount,
            payer_email: payerEmail,
            payment_method: req.body.payment_method || 'paypal',
            payment_provider: 'paypal',
            paypal_order_id: orderId,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            payment_status: 'active',
            join_date: now.toISOString()
        });

        const updated = await activateSubscriptionAndNotify(record, captureId);
        return res.json({ ok: true, item: updated });
    } catch (err) {
        console.error('PayPal complete-subscription failed:', err.message || err);
        return res.status(500).json({ ok: false, error: err.message || 'Payment completion failed.' });
    }
});

router.post('/api/paypal/complete-donation', async (req, res) => {
    try {
        const orderId = (req.body.order_id || '').trim();
        const captureId = (req.body.payment_id || '').trim();
        const amount = Number(req.body.amount || 0);
        const currency = (req.body.currency || PAYPAL_CURRENCY).toUpperCase().trim();
        if (!orderId || !captureId || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ ok: false, error: 'Missing PayPal payment details.' });
        }
        if (currency !== PAYPAL_CURRENCY) {
            return res.status(400).json({ ok: false, error: 'Payment currency mismatch.' });
        }

        const record = store.addDonation({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            clan_name: req.body.clan_name,
            amount,
            payment_method: req.body.payment_method || 'paypal',
            payment_provider: 'paypal',
            paypal_order_id: orderId,
            payment_status: 'active',
            payment_id: captureId,
            payment_date: new Date().toISOString(),
            date: new Date().toISOString()
        });

        return res.json({ ok: true, item: record });
    } catch (err) {
        console.error('PayPal complete-donation failed:', err.message || err);
        return res.status(500).json({ ok: false, error: err.message || 'Payment completion failed.' });
    }
});

router.post('/api/donations', async (req, res) => {
    try {
        store.addDonation({
            user_name: req.body.user_name,
            discord_tag: req.body.discord_tag,
            clan_name: req.body.clan_name,
            amount: Number(req.body.amount),
            payment_method: req.body.payment_method,
            payment_status: 'pending',
            date: new Date().toISOString()
        });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

router.post('/api/subscriptions/check', async (req, res) => {
    try {
        const discordId = (req.body.discord_id || '').trim();
        const serverId = (req.body.server_id || '').trim();

        if (serverId && serverId === ALLOWED_SERVER_ID) {
            return res.json({ ok: true, invite: BOT_INVITE_LINK });
        }

        const now = new Date();
        const match = store.listSubscriptions().find(s => {
            const okId = (discordId && s.discord_id === discordId) || (serverId && s.server_id === serverId);
            return okId && hasSubscriptionAccess(s, now);
        });

        if (!match) {
            return res.json({ ok: false, error: 'No active subscription found yet.' });
        }

        return res.json({
            ok: true,
            invite: BOT_INVITE_LINK,
            provisional: match.payment_status === 'claimed'
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

router.post('/api/paypal/webhook', async (req, res) => {
    try {
        if (!paypalConfigured() || !PAYPAL_WEBHOOK_ID) {
            return res.status(400).json({ ok: false });
        }

        const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
        const body = raw ? JSON.parse(raw) : req.body;
        const verified = await verifyPaypalWebhook(req.headers, body);
        if (!verified) return res.status(401).json({ ok: false });

        if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
            const orderId = body.resource?.supplementary_data?.related_ids?.order_id;
            const captureId = body.resource?.id;
            const amountValue = Number(body.resource?.amount?.value || 0);
            const currency = body.resource?.amount?.currency_code || 'USD';

            let sub = null;
            let donation = null;
            if (orderId) {
                sub = store.findSubscriptionByPaypalOrderId(orderId);
                if (!sub && store.findDonationByPaypalOrderId) {
                    donation = store.findDonationByPaypalOrderId(orderId);
                }
            }
            const customId = body.resource?.custom_id || body.resource?.supplementary_data?.related_ids?.custom_id;
            if (!sub && !donation && customId) {
                sub = store.findSubscriptionById(customId);
                if (!sub && store.findDonationByPaypalOrderId) {
                    donation = store.findDonationById?.(customId);
                }
            }
            if (!sub && !donation) return res.json({ ok: true });

            if (sub) {
                const expected = PRICING[sub.subscription_type]?.amount || 0;
                if (currency !== PAYPAL_CURRENCY || Number(amountValue.toFixed(2)) !== Number(expected.toFixed(2))) {
                    return res.json({ ok: true });
                }
                await activateSubscriptionAndNotify(sub, captureId);
            }

            if (donation) {
                const expected = Number(donation.amount || 0);
                if (currency !== PAYPAL_CURRENCY || Number(amountValue.toFixed(2)) !== Number(expected.toFixed(2))) {
                    return res.json({ ok: true });
                }
                store.updateDonationById(donation._id, {
                    payment_status: 'active',
                    payment_date: new Date().toISOString(),
                    payment_id: captureId || donation.payment_id
                });
            }
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = store.listSubscriptions()
            .sort((a, b) => new Date(b.join_date || 0) - new Date(a.join_date || 0));
        return res.json(users);
    } catch (err) {
        return res.status(500).json([]);
    }
});

router.post('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
    try {
        const updated = store.updateSubscriptionById(req.params.id, { is_banned: true });
        if (!updated) return res.status(404).json({ ok: false });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.post('/api/admin/users/:id/unban', requireAdmin, async (req, res) => {
    try {
        const updated = store.updateSubscriptionById(req.params.id, { is_banned: false });
        if (!updated) return res.status(404).json({ ok: false });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.post('/api/admin/users/:id/delete', requireAdmin, async (req, res) => {
    try {
        const ok = store.deleteSubscriptionById(req.params.id);
        if (!ok) return res.status(404).json({ ok: false });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.get('/api/admin/subscriptions', requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const subs = store.listSubscriptions()
            .filter(s => hasSubscriptionAccess(s, now))
            .sort((a, b) => new Date(a.end_date || 0) - new Date(b.end_date || 0));
        return res.json(subs);
    } catch (err) {
        return res.status(500).json([]);
    }
});

router.post('/api/admin/subscriptions', requireAdmin, async (req, res) => {
    try {
        const subscriptionType = (req.body.subscription_type || '').toLowerCase().trim();
        const pricing = PRICING[subscriptionType];
        if (!pricing) {
            return res.status(400).json({ ok: false, error: 'Invalid subscription type.' });
        }

        const startDate = parseDateInput(req.body.start_date) || new Date();
        const endDate = parseDateInput(req.body.end_date) || addMonths(startDate, pricing.months);

        const update = {
            user_name: req.body.user_name,
            discord_id: req.body.discord_id,
            tacticool_id: req.body.tacticool_id,
            server_id: req.body.server_id,
            subscription_type: subscriptionType,
            amount: pricing.amount,
            payment_status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            payment_method: 'admin'
        };

        update.join_date = update.join_date || new Date().toISOString();
        store.upsertSubscriptionByServerId(req.body.server_id, update);

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.get('/api/admin/payments', requireAdmin, async (req, res) => {
    try {
        const subs = store.listSubscriptions()
            .sort((a, b) => new Date(b.payment_date || b.start_date || 0) - new Date(a.payment_date || a.start_date || 0));
        const donations = store.listDonations()
            .sort((a, b) => new Date(b.payment_date || b.date || 0) - new Date(a.payment_date || a.date || 0));

        const mappedSubs = subs.map(s => ({
            _id: s._id,
            type: 'subscription',
            user_name: s.user_name,
            subscription_type: s.subscription_type,
            amount: s.amount,
            payment_status: s.payment_status,
            payment_date: s.payment_date || s.start_date,
            payment_id: s.payment_id
        }));

        const mappedDonations = donations.map(d => ({
            _id: d._id,
            type: 'donation',
            user_name: d.user_name,
            subscription_type: 'donation',
            amount: d.amount,
            payment_status: d.payment_status,
            payment_date: d.payment_date || d.date,
            payment_id: d.payment_id
        }));

        const payments = [...mappedSubs, ...mappedDonations].sort((a, b) => {
            const da = a.payment_date ? new Date(a.payment_date).getTime() : 0;
            const db = b.payment_date ? new Date(b.payment_date).getTime() : 0;
            return db - da;
        });

        return res.json(payments);
    } catch (err) {
        return res.status(500).json([]);
    }
});

router.post('/api/admin/payments/:type/:id/confirm', requireAdmin, async (req, res) => {
    try {
        const type = req.params.type;
        const id = req.params.id;
        const paymentId = req.body.payment_id || req.body.paymentId || req.body.paymentID || req.body.paypal_id;
        const paymentDate = new Date().toISOString();

        if (type === 'subscription') {
            const sub = store.findSubscriptionById(id);
            if (!sub) return res.status(404).json({ ok: false });
            const pricing = PRICING[sub.subscription_type] || PRICING.monthly;
            const startDate = sub.start_date || paymentDate;
            const endDate = sub.end_date || addMonths(new Date(startDate), pricing.months).toISOString();
            await activateSubscriptionAndNotify(sub, paymentId || sub.payment_id, {
                payment_date: paymentDate,
                start_date: startDate,
                end_date: endDate
            });
            return res.json({ ok: true });
        }

        if (type === 'donation') {
            const donation = store.findDonationById(id);
            if (!donation) return res.status(404).json({ ok: false });
            store.updateDonationById(id, {
                payment_status: 'active',
                payment_id: paymentId || donation.payment_id,
                payment_date: paymentDate
            });
            return res.json({ ok: true });
        }

        return res.status(400).json({ ok: false });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

router.post('/api/admin/payments/:type/:id/pending', requireAdmin, async (req, res) => {
    try {
        const type = req.params.type;
        const id = req.params.id;

        if (type === 'subscription') {
            const updated = store.updateSubscriptionById(id, { payment_status: 'pending' });
            if (!updated) return res.status(404).json({ ok: false });
            return res.json({ ok: true });
        }

        if (type === 'donation') {
            const updated = store.updateDonationById(id, { payment_status: 'pending' });
            if (!updated) return res.status(404).json({ ok: false });
            return res.json({ ok: true });
        }

        return res.status(400).json({ ok: false });
    } catch (err) {
        return res.status(500).json({ ok: false });
    }
});

module.exports = router;

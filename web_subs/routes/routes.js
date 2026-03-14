const express = require('express');
const router = express.Router();

router.get('/home', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bot Subscriptions</title>
    <link rel="stylesheet" href="/blue_galaxy.css" />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        :root {
            --ink: #e9f6ff;
            --muted: rgba(233, 246, 255, 0.78);
            --line: rgba(87, 245, 255, 0.5);
            --glow: rgba(68, 248, 255, 0.45);
            --teal: #2af5ff;
            --mint: #7dffb5;
            --deep: #050814;
            --panel: rgba(8, 12, 28, 0.78);
            --panel-strong: rgba(0, 4, 18, 0.85);
        }

        * { box-sizing: border-box; }
        body {
            color: var(--ink);
            margin: 0;
            padding: 42px 28px 70px;
            font-family: 'Space Grotesk', system-ui, sans-serif;
            background:
                radial-gradient(1200px 700px at 10% -10%, rgba(45, 245, 255, 0.25), transparent 60%),
                radial-gradient(900px 520px at 100% 0%, rgba(125, 255, 181, 0.2), transparent 55%),
                radial-gradient(800px 400px at 60% 100%, rgba(60, 120, 255, 0.18), transparent 60%),
                linear-gradient(160deg, #040510 0%, #090f24 50%, #050814 100%);
            min-height: 100vh;
            overflow-x: hidden;
        }
        body::before {
            content: "";
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(transparent 92%, rgba(45, 245, 255, 0.15) 92%),
                linear-gradient(90deg, transparent 92%, rgba(45, 245, 255, 0.12) 92%);
            background-size: 80px 80px;
            opacity: 0.16;
            pointer-events: none;
            animation: grid-float 16s linear infinite;
        }
        body::after {
            content: "";
            position: fixed;
            inset: -20% 0 0 0;
            background: radial-gradient(circle at 30% 20%, rgba(42, 245, 255, 0.2), transparent 55%),
                        radial-gradient(circle at 80% 10%, rgba(125, 255, 181, 0.16), transparent 50%);
            filter: blur(12px);
            opacity: 0.8;
            pointer-events: none;
            animation: aura-pulse 10s ease-in-out infinite;
        }

        .wrap { max-width: 1220px; margin: 0 auto; position: relative; z-index: 2; }
        h1, h2 { margin-top: 0; font-family: 'Orbitron', 'Space Grotesk', sans-serif; letter-spacing: 0.6px; }
        .hero { text-align: center; padding: 20px 10px 10px; position: relative; }
        .hero-title { font-size: clamp(2.4rem, 5vw, 3.9rem); margin-bottom: 10px; text-shadow: 0 0 25px rgba(42, 245, 255, 0.35); }
        .hero p { max-width: 920px; margin: 12px auto 0; opacity: 0.92; font-size: 1.1rem; }
        .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-top: 20px; }
        .auth-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
        .glow-line { height: 2px; width: 160px; margin: 18px auto; background: linear-gradient(90deg, transparent, rgba(55,243,255,0.95), transparent); }

        .card {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 20px;
            padding: 28px;
            margin-bottom: 18px;
            box-shadow: 0 0 35px rgba(55, 243, 255, 0.18);
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }
        .card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 20% 0%, rgba(42, 245, 255, 0.2), transparent 45%);
            opacity: 0.7;
            pointer-events: none;
        }
        .section-title { text-transform: uppercase; letter-spacing: 1.4px; font-size: 0.9rem; opacity: 0.8; margin-bottom: 12px; }
        .feature-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
        .feature-card {
            padding: 20px;
            border-radius: 16px;
            background: var(--panel-strong);
            border: 1px solid rgba(55, 243, 255, 0.3);
            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.35);
            transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .feature-card:hover { transform: translateY(-6px); box-shadow: 0 18px 35px rgba(42, 245, 255, 0.18); }
        .feature-card h3 { margin: 0 0 8px; font-size: 1.08rem; }
        .feature-card p { margin: 0; opacity: 0.9; }
        .grid-2 { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .btn {
            display: inline-block;
            text-decoration: none;
            background: linear-gradient(135deg, rgba(55,243,255,0.18), rgba(102,255,183,0.28));
            border: 1px solid rgba(55, 243, 255, 0.7);
            color: #fff;
            padding: 13px 22px;
            border-radius: 12px;
            box-shadow: 0 0 18px rgba(55,243,255,0.35);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 0.9rem;
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .btn:hover {
            background: rgba(55,243,255,0.45);
            color: #001022;
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 0 28px rgba(55,243,255,0.5);
        }
        .btn.big { padding: 15px 28px; font-size: 0.95rem; }
        .btn.alt { background: rgba(16, 30, 60, 0.5); border-color: rgba(125, 255, 181, 0.6); }

        .big-cta { min-height: 260px; display: flex; flex-direction: column; justify-content: space-between; }
        .cta-kicker { text-transform: uppercase; letter-spacing: 1.6px; font-size: 0.8rem; opacity: 0.75; }
        .socials { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
        .socials .btn { min-width: 160px; text-align: center; }
        .soft { opacity: 0.85; }
        .pill-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
        .pill {
            padding: 7px 14px;
            border-radius: 999px;
            border: 1px solid rgba(55,243,255,0.55);
            background: rgba(55,243,255,0.1);
            font-size: 0.78rem;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            box-shadow: inset 0 0 12px rgba(55,243,255,0.15);
        }

        .trust-bar {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            margin-top: 18px;
        }
        .trust-item {
            padding: 14px 16px;
            border-radius: 14px;
            border: 1px solid rgba(125, 255, 181, 0.45);
            background: rgba(6, 18, 38, 0.65);
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .trust-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2af5ff, #7dffb5);
            box-shadow: 0 0 10px rgba(42, 245, 255, 0.6);
        }

        .stats {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            margin-top: 12px;
        }
        .stat-card {
            border: 1px solid rgba(55, 243, 255, 0.3);
            border-radius: 16px;
            padding: 18px;
            background: rgba(5, 14, 30, 0.65);
        }
        .stat-number {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--teal);
            margin-bottom: 4px;
        }
        .stat-label { font-size: 0.85rem; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; }

        .quote {
            border-left: 2px solid rgba(55, 243, 255, 0.7);
            padding-left: 14px;
            margin: 0;
            font-size: 1rem;
            color: var(--muted);
        }
        .fade-up {
            animation: fade-up 0.9s ease both;
        }
        .delay-1 { animation-delay: 0.15s; }
        .delay-2 { animation-delay: 0.3s; }
        .delay-3 { animation-delay: 0.45s; }

        @keyframes fade-up {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aura-pulse {
            0%, 100% { opacity: 0.65; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(12px); }
        }
        @keyframes grid-float {
            from { transform: translateY(0); }
            to { transform: translateY(80px); }
        }

        @media (max-width: 700px) {
            body { padding: 34px 18px 60px; }
            .hero p { font-size: 1rem; }
        }
        @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
        }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="hero fade-up">
            <h1 class="neon-text hero-title">Bot Subscription Website</h1>
            <p class="soft">Super-powered automation for clan leaders, trusted by competitive squads, engineered for speed and control.</p>
            <div class="pill-row">
                <div class="pill">Verified Payments</div>
                <div class="pill">Fast Setup</div>
                <div class="pill">Community Built</div>
                <div class="pill">Secure Dashboard</div>
            </div>
            <div class="hero-actions">
                <a class="btn big" href="/user/subscription">Start Subscription</a>
                <a class="btn big alt" href="/user/support">Support The Project</a>
            </div>
            <div class="auth-actions">
                <a class="btn" href="/user/login">Back To Login</a>
            </div>
            <div class="glow-line"></div>
            <div class="trust-bar">
                <div class="trust-item"><span class="trust-dot"></span>PCI-style secure payment flow</div>
                <div class="trust-item"><span class="trust-dot"></span>Uptime focused hosting</div>
                <div class="trust-item"><span class="trust-dot"></span>Fast response support</div>
                <div class="trust-item"><span class="trust-dot"></span>Transparent pricing</div>
            </div>
            
        </div>
        <div class="card fade-up delay-1">
            <div class="section-title">Bot Features</div>
            <div class="feature-grid">
                <div class="feature-card">
                    <h3>Clan Missions Generator</h3>
                    <p>Create a clean image showing all clan missions and the best operators for each mission.</p>
                </div>
                <div class="feature-card">
                    <h3>AI Assistant</h3>
                    <p>Ask questions and get smart answers directly inside the bot.</p>
                </div>
                <div class="feature-card">
                    <h3>Automation Tools</h3>
                    <p>Helpful tools for players and servers with less manual work.</p>
                </div>
                <div class="feature-card">
                    <h3>Fast & Simple Commands</h3>
                    <p>Easy slash commands for quick use and clean results.</p>
                </div>
            </div>
            <p class="soft" style="margin-top:12px;"><em>Built for the community to make clan management and missions easier.</em></p>
        </div>
        <div class="card fade-up delay-2">
            <div class="section-title">Coming Soon</div>
            <div class="feature-grid">
                <div class="feature-card">
                    <h3>Account Linking (/link)</h3>
                    <p>Connect your game account if API access becomes available.</p>
                </div>
                <div class="feature-card">
                    <h3>Game Data Integration</h3>
                    <p>Live information and advanced tools using the Tacticool API.</p>
                </div>
            </div>
        </div>
        <div class="card fade-up delay-3">
            <div class="section-title">Power Metrics</div>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">99.9%</div>
                    <div class="stat-label">Bot Reliability</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">&lt; 1s</div>
                    <div class="stat-label">Command Speed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">24/7</div>
                    <div class="stat-label">Monitoring</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">Global</div>
                    <div class="stat-label">Clan Ready</div>
                </div>
            </div>
        </div>
        <div class="grid-2">
            <div class="card big-cta fade-up delay-1">
                <div>
                    <div class="cta-kicker">Premium Access</div>
                    <h2>Subscribe</h2>
                    <p><strong>Monthly:</strong> $10</p>
                    <p><strong>Yearly:</strong> $100 (discounted from $120)</p>
                    <p class="soft">Unlock premium features and priority tools for your clan.</p>
                </div>
                <div class="actions">
                    <a class="btn big" href="/user/subscription">Buy Subscription</a>
                </div>
            </div>
            <div class="card big-cta fade-up delay-2">
                <div>
                    <div class="cta-kicker">Keep It Alive</div>
                    <h2>Support / Donate</h2>
                    <p><strong>Support:</strong> pay any amount you want.</p>
                    <p class="soft">Help keep development active and unlock faster updates.</p>
                </div>
                <div class="actions">
                    <a class="btn big" href="/user/support">Support / Donate</a>
                </div>
            </div>
        </div>
        <div class="card fade-up delay-3">
            <h2>Trusted by the Community</h2>
            <p class="soft">Updates, guides, and announcements:</p>
            <p class="quote">"We built this for competitive clans who need speed, clarity, and zero downtime. Every command is engineered to feel instant."</p>
            <div class="socials">
                <a class="btn" href="https://www.youtube.com/@MAZENEAGLEEYE" target="_blank" rel="noopener">YouTube</a>
                <a class="btn" href="https://www.instagram.com/mazeneagleeye?igsh=ZGNvbWJ6eHQwMDhj" target="_blank" rel="noopener">Instagram</a>
                <a class="btn" href="https://www.tiktok.com/@mazeneagleeye?_r=1&_t=ZS-94doPgiTU6z" target="_blank" rel="noopener">TikTok</a>
                <a class="btn" href="https://discord.com/users/1019254470191890473" target="_blank" rel="noopener">Discord Contact</a>
            </div>
        </div>
    </div>
</body>
</html>
    `);
});

router.get('/user/subscription', (req, res) => {
    res.sendFile('subscription.html', { root: __dirname + '/../user/' });
});

router.get('/user/support', (req, res) => {
    res.sendFile('support.html', { root: __dirname + '/../user/' });
});

router.get('/user', (req, res) => {
    res.redirect('/user/login');
});

router.get('/admin/dashboard', (req, res) => {
    res.sendFile('dashboard.html', { root: __dirname + '/../admin/' });
});

router.get('/admin/payments', (req, res) => {
    res.sendFile('payments.html', { root: __dirname + '/../admin/' });
});

router.get('/admin/subscriptions', (req, res) => {
    res.sendFile('subscriptions.html', { root: __dirname + '/../admin/' });
});

module.exports = router;

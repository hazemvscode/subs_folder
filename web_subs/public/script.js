// script.js

document.addEventListener('DOMContentLoaded', () => {
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
            btn.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        });
    };

    const storedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(storedTheme);

    document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    });

    const PAYPAL_LINK = 'https://paypal.me/mazenabosenna';
    const PAYPAL_STATUS_URL = '/api/paypal/status';
    let paypalStatus = null;

    const formatDate = (value) => {
        if (!value) return '--';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '--';
        return d.toISOString().slice(0, 10);
    };

    const formatPlan = (plan) => {
        if (!plan) return '--';
        return plan.charAt(0).toUpperCase() + plan.slice(1);
    };

    const paymentDetailsByMethod = {
        paypal: [
            `PayPal link: <a href="${PAYPAL_LINK}" target="_blank" rel="noopener">paypal.me/mazenabosenna</a>`,
            'You can pay with PayPal or pay by card without a PayPal account.',
            'Steps: Click Pay with PayPal, then choose "Pay with Debit/Credit Card".'
        ],
        card: [
            'Card payments are processed by PayPal.',
            'You do NOT need a PayPal account to pay by Visa/Mastercard.',
            `PayPal link: <a href="${PAYPAL_LINK}" target="_blank" rel="noopener">paypal.me/mazenabosenna</a>`
        ],
        other: [
            'Other credits: Contact the admin to arrange payment.',
            'Email: mazenabosenna15@gmail.com'
        ]
    };

    const updatePaymentDetailsForConfigured = (configured) => {
        paymentDetailsByMethod.paypal = [
            'You will open PayPal.Me and send the exact amount there.'
        ];
        paymentDetailsByMethod.card = [
            'Card payments are handled on PayPal.Me if available in your region.'
        ];
    };

    const updatePaymentInfo = (container) => {
        const select = container.querySelector('.payment-method');
        const details = container.querySelector('[data-role="details"]');
        if (!select || !details) return;
        const lines = paymentDetailsByMethod[select.value] || [];
        details.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    };

    document.querySelectorAll('.payment-block').forEach(block => {
        const select = block.querySelector('.payment-method');
        if (!select) return;
        updatePaymentInfo(block);
        select.addEventListener('change', () => updatePaymentInfo(block));
    });

    const loadPaypalSdk = (clientId, currency) => new Promise((resolve, reject) => {
        if (window.paypal) return resolve();
        if (document.getElementById('paypal-sdk')) {
            const check = setInterval(() => {
                if (window.paypal) {
                    clearInterval(check);
                    resolve();
                }
            }, 50);
            return;
        }
        const script = document.createElement('script');
        script.id = 'paypal-sdk';
        const params = new URLSearchParams({
            'client-id': clientId,
            currency: currency || 'USD',
            intent: 'CAPTURE',
            components: 'buttons',
            'enable-funding': 'card'
        });
        script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('PayPal SDK failed'));
        document.head.appendChild(script);
    });

    const fetchPaypalStatus = async () => {
        if (paypalStatus) return paypalStatus;
        try {
            const res = await fetch(PAYPAL_STATUS_URL);
            const data = await res.json();
            paypalStatus = data;
            updatePaymentDetailsForConfigured(data.configured);
            if (data.configured) {
                document.querySelectorAll('.payment-block').forEach(block => updatePaymentInfo(block));
            }
            return data;
        } catch (err) {
            return { ok: false, configured: false };
        }
    };

    const getSubscriptionAmount = (form) => {
        const type = (form.querySelector('[name="subscription_type"]')?.value || '').toLowerCase();
        return type === 'yearly' ? '60.00' : '6.00';
    };

    const userForm = document.getElementById('userSubForm');
    if (userForm) {
        const fallbackButton = document.getElementById('subFallbackButton');
        const paypalInfo = document.getElementById('subPaypalInfo');
        const paypalSummary = document.getElementById('subPaypalSummary');
        const paymentMethodSelect = document.getElementById('subPaymentMethod');
        const claimInfo = document.getElementById('subClaimInfo');
        const claimButton = document.getElementById('subClaimButton');
        const statusLink = document.getElementById('subStatusLink');
        let currentClaimToken = null;

        const getSelectedPlan = () => (userForm.querySelector('[name="subscription_type"]')?.value || 'monthly').toLowerCase();
        const getSelectedAmount = () => getSelectedPlan() === 'yearly' ? 60 : 6;
        const getPaypalMeUrl = () => `${PAYPAL_LINK}/${getSelectedAmount()}`;

        const togglePaypalVisibility = () => {
            if (!paypalInfo) return;
            const allow = !paymentMethodSelect || paymentMethodSelect.value !== 'other';
            paypalInfo.style.display = allow ? 'block' : 'none';
            if (!allow && claimInfo) claimInfo.style.display = 'none';
        };

        const refreshPaypalSummary = () => {
            if (!paypalSummary) return;
            const amount = getSelectedAmount();
            paypalSummary.innerHTML = `
                <div>Exact amount to send: <strong>$${amount}</strong></div>
                <div>PayPal.Me link: <a href="${getPaypalMeUrl()}" target="_blank" rel="noopener">${getPaypalMeUrl().replace('https://', '')}</a></div>
                <div>After sending, come back here and press <strong>I Sent The Money</strong>.</div>
            `;
        };

        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const payload = new URLSearchParams(new FormData(userForm));
                const res = await fetch('/api/subscriptions/start-paypalme', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');
                currentClaimToken = data.claim_token;
                if (claimInfo) claimInfo.style.display = 'block';
                const popup = window.open(data.paypal_url || getPaypalMeUrl(), '_blank', 'noopener');
                if (!popup) {
                    window.location.href = data.paypal_url || getPaypalMeUrl();
                    return;
                }
            } catch (err) {
                alert(err.message || 'Failed to start PayPal.Me payment.');
            }
        });

        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', togglePaypalVisibility);
        }
        userForm.querySelector('[name="subscription_type"]')?.addEventListener('change', refreshPaypalSummary);
        togglePaypalVisibility();
        refreshPaypalSummary();
        if (fallbackButton) fallbackButton.style.display = 'block';

        if (claimButton) {
            claimButton.addEventListener('click', async () => {
                if (!currentClaimToken) {
                    alert('Open PayPal.Me first, then come back and click this button.');
                    return;
                }
                try {
                    const payload = new URLSearchParams();
                    payload.set('claim_token', currentClaimToken);
                    const res = await fetch('/api/subscriptions/claim-paypalme', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: payload
                    });
                    const data = await res.json();
                    if (!data.ok) throw new Error(data.error || 'Failed to unlock access.');
                    const success = document.getElementById('subSuccess');
                    const successText = document.getElementById('subSuccessText');
                    if (successText) {
                        successText.textContent = `Temporary access unlocked for ${data.claim_hours} hours. Admin can still cancel it later if payment was fake or wrong.`;
                    }
                    if (statusLink) {
                        const query = new URLSearchParams({
                            server_id: data.server_id || '',
                            discord_id: data.discord_id || ''
                        });
                        statusLink.href = `/user/status?${query.toString()}`;
                    }
                    if (success) success.style.display = 'block';
                } catch (err) {
                    alert(err.message || 'Failed to unlock temporary access.');
                }
            });
        }
    }

    const donationForm = document.getElementById('donationForm');
    if (donationForm) {
        const fallbackButton = document.getElementById('donationFallbackButton');
        const paypalInfo = document.getElementById('donationPaypalInfo');
        const paypalContainer = document.getElementById('paypalDonationButtons');
        const paymentMethodSelect = document.getElementById('donationPaymentMethod');
        let paypalButtonsReady = false;

        const togglePaypalVisibility = () => {
            if (!paypalInfo) return;
            const allow = !paymentMethodSelect || paymentMethodSelect.value !== 'other';
            paypalInfo.style.display = allow ? 'block' : 'none';
        };

        donationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusData = await fetchPaypalStatus();
            if (statusData.configured) {
                if (paypalButtonsReady) {
                    alert('Please use the PayPal buttons below to complete payment.');
                    return;
                }
                try {
                    const payload = new URLSearchParams(new FormData(donationForm));
                    const res = await fetch('/api/paypal/create-donation-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: payload
                    });
                    const data = await res.json();
                    if (!data.ok || !data.approve_url) throw new Error(data.error || 'PayPal order failed');
                    window.location.href = data.approve_url;
                    return;
                } catch (err) {
                    alert(err.message || 'Failed to start PayPal checkout. Please try again.');
                    return;
                }
            }
            const payload = new URLSearchParams(new FormData(donationForm));
            try {
                const res = await fetch('/api/donations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');

                window.location.href = PAYPAL_LINK;
            } catch (err) {
                alert('Failed to save donation. Please try again.');
            }
        });

        fetchPaypalStatus().then(statusData => {
            if (!statusData.configured || !paypalInfo || !paypalContainer) return;
            if (fallbackButton) fallbackButton.style.display = 'none';
            togglePaypalVisibility();
            if (paymentMethodSelect) {
                paymentMethodSelect.addEventListener('change', togglePaypalVisibility);
            }
            loadPaypalSdk(statusData.client_id, statusData.currency)
                .then(() => {
                    paypalButtonsReady = true;
                    paypalContainer.innerHTML = '';
                    paypal.Buttons({
                        style: { layout: 'vertical' },
                        createOrder: async (data, actions) => {
                            if (!donationForm.reportValidity()) {
                                return Promise.reject(new Error('Invalid form'));
                            }
                            const amount = String(Number(donationForm.querySelector('[name="amount"]')?.value || 0).toFixed(2));
                            return actions.order.create({
                                purchase_units: [{
                                    amount: {
                                        currency_code: statusData.currency || 'USD',
                                        value: amount
                                    },
                                    description: 'Donation'
                                }]
                            });
                        },
                        onApprove: async (data, actions) => {
                            const details = await actions.order.capture();
                            const capture = details?.purchase_units?.[0]?.payments?.captures?.[0];
                            const payload = new URLSearchParams(new FormData(donationForm));
                            payload.set('order_id', data.orderID || details.id || '');
                            payload.set('payment_id', capture?.id || '');
                            payload.set('amount', capture?.amount?.value || payload.get('amount') || '0.00');
                            payload.set('currency', capture?.amount?.currency_code || statusData.currency || 'USD');
                            const res = await fetch('/api/paypal/complete-donation', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: payload
                            });
                            const out = await res.json();
                            if (!out.ok) throw new Error(out.error || 'Payment completion failed');
                            alert('Payment complete. Thank you for your support!');
                        },
                        onError: (err) => {
                            alert(err?.message || 'PayPal payment failed. Please try again.');
                        }
                    }).render(paypalContainer);
                })
                .catch(() => {
                    paypalButtonsReady = false;
                    if (fallbackButton) fallbackButton.style.display = 'block';
                });
        });
    }

    const loginForm = document.getElementById('userLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = new URLSearchParams(new FormData(loginForm));
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');
                window.location.href = data.redirect || '/home';
            } catch (err) {
                alert('Login failed. Please try again.');
            }
        });
    }

    const signupForm = document.getElementById('userSignupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = new URLSearchParams(new FormData(signupForm));
            try {
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');
                alert('Signup complete. You can log in now.');
                window.location.href = '/user/login';
            } catch (err) {
                alert('Signup failed. Please try again.');
            }
        });
    }

    const statusForm = document.getElementById('statusForm');
    if (statusForm) {
        const params = new URLSearchParams(window.location.search);
        const discordInput = statusForm.querySelector('[name="discord_id"]');
        const serverInput = statusForm.querySelector('[name="server_id"]');
        if (discordInput && params.get('discord_id')) discordInput.value = params.get('discord_id');
        if (serverInput && params.get('server_id')) serverInput.value = params.get('server_id');

        statusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = new URLSearchParams(new FormData(statusForm));
            try {
                const res = await fetch('/api/subscriptions/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                const result = document.getElementById('statusResult');
                const text = document.getElementById('statusText');
                const link = document.getElementById('inviteLink');
                if (result) result.style.display = 'block';
                if (!data.ok) {
                    if (text) text.textContent = data.error || 'No active subscription found yet.';
                    if (link) link.style.display = 'none';
                    return;
                }
                if (text) {
                    text.textContent = data.provisional
                        ? 'Temporary access unlocked. You can invite the bot now while payment is being checked.'
                        : 'Payment confirmed! You can invite the bot now.';
                }
                if (link) {
                    link.href = data.invite;
                    link.style.display = 'inline-block';
                }
            } catch (err) {
                const result = document.getElementById('statusResult');
                const text = document.getElementById('statusText');
                const link = document.getElementById('inviteLink');
                if (result) result.style.display = 'block';
                if (text) text.textContent = 'Failed to check status. Please try again.';
                if (link) link.style.display = 'none';
            }
        });
    }

    const addSubForm = document.getElementById('addSubForm');
    if (addSubForm) {
        addSubForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = new URLSearchParams(new FormData(addSubForm));
            try {
                const res = await fetch('/api/admin/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');

                window.location.reload();
            } catch (err) {
                alert('Failed to save subscription. Please try again.');
            }
        });
    }

    const usersTable = document.getElementById('usersTable');
    if (usersTable) {
        fetch('/api/admin/users')
            .then(res => res.json())
            .then(users => {
                usersTable.innerHTML = users.map(u => `
                    <tr>
                        <td>${u.user_name || '--'}</td>
                        <td>${u.discord_id || u.discord_tag || '--'}</td>
                        <td>${u.tacticool_id || '--'}</td>
                        <td>${formatDate(u.join_date)}</td>
                        <td>${formatPlan(u.subscription_type)}</td>
                        <td>${formatDate(u.end_date)}</td>
                        <td>${u.is_banned ? 'Banned' : 'Active'}</td>
                        <td>
                            <button class="button" data-action="ban" data-id="${u._id}">Ban</button>
                            <button class="button" data-action="unban" data-id="${u._id}">Unban</button>
                            <button class="button" data-action="delete" data-id="${u._id}">Delete</button>
                        </td>
                    </tr>
                `).join('');

                const overviewTable = document.getElementById('overviewTable');
                if (overviewTable) {
                    const total = users.length;
                    const active = users.filter(u => !u.is_banned).length;
                    const expiring = users.filter(u => {
                        const daysLeft = Math.floor((new Date(u.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                        return daysLeft >= 0 && daysLeft <= 7;
                    }).length;
                    overviewTable.innerHTML = `
                        <tr>
                            <td>${total}</td>
                            <td>${active}</td>
                            <td>${expiring}</td>
                            <td>$--</td>
                        </tr>
                    `;
                }
            })
            .catch(() => {
                usersTable.innerHTML = '<tr><td colspan="8">No users found.</td></tr>';
            });

        usersTable.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (!id) return;

            const res = await fetch(`/api/admin/users/${id}/${action}`, { method: 'POST' });
            if (res.ok) window.location.reload();
        });
    }

    const subsTable = document.getElementById('subsTable');
    if (subsTable) {
        fetch('/api/admin/subscriptions')
            .then(res => res.json())
            .then(subs => {
                subsTable.innerHTML = subs.map(s => `
                    <tr>
                        <td>${s.user_name || '--'}</td>
                        <td>${formatPlan(s.subscription_type)}</td>
                        <td>${formatDate(s.start_date)}</td>
                        <td>${formatDate(s.end_date)}</td>
                        <td>${s.server_id || '--'}</td>
                        <td>${s.payment_status || 'active'}</td>
                    </tr>
                `).join('');
            })
            .catch(() => {
                subsTable.innerHTML = '<tr><td colspan="6">No subscriptions found.</td></tr>';
            });
    }

    const paymentsTable = document.getElementById('paymentsTable');
    if (paymentsTable) {
        fetch('/api/admin/payments')
            .then(res => res.json())
            .then(payments => {
                paymentsTable.innerHTML = payments.map(p => `
                    <tr>
                        <td>${p.user_name || '--'}</td>
                        <td>${formatPlan(p.subscription_type)}</td>
                        <td>${p.amount || '$--'}</td>
                        <td>${p.payment_status || 'pending'}</td>
                        <td>${formatDate(p.payment_date)}</td>
                        <td>${p.payment_id || '--'}</td>
                        <td>
                            <button class="button" data-action="confirm" data-id="${p._id}" data-type="${p.type}">Confirm Paid</button>
                            <button class="button" data-action="pending" data-id="${p._id}" data-type="${p.type}">Cancel Access</button>
                        </td>
                    </tr>
                `).join('');
            })
            .catch(() => {
                paymentsTable.innerHTML = '<tr><td colspan="7">No payments found.</td></tr>';
            });

        paymentsTable.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            if (!id || !type) return;

            let body = null;
            if (action === 'confirm') {
                const paymentId = window.prompt('Enter PayPal Transaction ID (optional):') || '';
                body = JSON.stringify({ payment_id: paymentId });
            }

            const res = await fetch(`/api/admin/payments/${type}/${id}/${action}`, {
                method: 'POST',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body
            });
            if (res.ok) window.location.reload();
        });
    }

    document.querySelectorAll('[data-action="toggle-password"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isHidden = input.getAttribute('type') === 'password';
            input.setAttribute('type', isHidden ? 'text' : 'password');
            btn.textContent = isHidden ? 'Hide' : 'Show';
        });
    });
});

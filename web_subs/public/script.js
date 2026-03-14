// script.js

document.addEventListener('DOMContentLoaded', () => {
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
            'PayPal email: coming soon',
            'You can pay with PayPal or pay by card without a PayPal account.',
            'Steps: Click Pay with PayPal, then choose "Pay with Debit/Credit Card".'
        ],
        card: [
            'Card payments are processed by PayPal.',
            'You do NOT need a PayPal account to pay by Visa/Mastercard.',
            'PayPal email: coming soon'
        ],
        other: [
            'Other credits: Contact the admin to arrange payment.',
            'Email: mazenabosenna15@gmail.com'
        ]
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

    const userForm = document.getElementById('userSubForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = new URLSearchParams(new FormData(userForm));
            try {
                const res = await fetch('/api/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payload
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Request failed');

                const success = document.getElementById('subSuccess');
                if (success) success.style.display = 'block';

                alert('Subscription saved. Complete payment, then use the bot invite link.');
            } catch (err) {
                alert('Failed to save subscription. Please try again.');
            }
        });
    }

    const donationForm = document.getElementById('donationForm');
    if (donationForm) {
        donationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Donation Submitted:', Object.fromEntries(new FormData(donationForm)));
            alert('Thank you for your support!');
        });
    }

    const addSubForm = document.getElementById('addSubForm');
    if (addSubForm) {
        addSubForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Admin Add Subscription:', Object.fromEntries(new FormData(addSubForm)));
            alert('Subscription added successfully!');
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
                    </tr>
                `).join('');
            })
            .catch(() => {
                paymentsTable.innerHTML = '<tr><td colspan="6">No payments found.</td></tr>';
            });
    }
});

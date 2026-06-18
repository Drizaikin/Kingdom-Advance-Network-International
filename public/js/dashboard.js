// js/dashboard.js — Partner Dashboard: loads real data from the API

(function () {
    'use strict';

    let session = null;
    let currentUser = null;
    let activePrayerTab = 'list';

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        session = JSON.parse(localStorage.getItem('kani_session') || 'null');
        currentUser = JSON.parse(localStorage.getItem('kani_user') || 'null');

        if (!session || !session.access_token) {
            window.location.href = 'partnership.html';
            return;
        }

        // Check token expiry
        if (session.expires_at && Date.now() / 1000 > session.expires_at) {
            logout();
            return;
        }

        await loadDashboard();
    });

    // ──────────────────────────────────────────────
    // AUTH HELPERS
    // ──────────────────────────────────────────────
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        };
    }

    window.logout = function () {
        localStorage.removeItem('kani_session');
        localStorage.removeItem('kani_user');
        window.location.href = 'partnership.html';
    };

    // ──────────────────────────────────────────────
    // LOAD ALL DASHBOARD DATA
    // ──────────────────────────────────────────────
    async function loadDashboard() {
        try {
            const [profileRes, eventsRes, donationsRes, prayersRes] = await Promise.allSettled([
                fetch('/api/partner/profile', { headers: getAuthHeaders() }),
                fetch('/api/partner/events', { headers: getAuthHeaders() }),
                fetch('/api/partner/donations', { headers: getAuthHeaders() }),
                fetch('/api/partner/prayers', { headers: getAuthHeaders() }),
            ]);

            const profile = profileRes.status === 'fulfilled' ? await profileRes.value.json() : null;
            const events = eventsRes.status === 'fulfilled' ? await eventsRes.value.json() : null;
            const donations = donationsRes.status === 'fulfilled' ? await donationsRes.value.json() : null;
            const prayers = prayersRes.status === 'fulfilled' ? await prayersRes.value.json() : null;

            renderProfile(profile?.data);
            renderEvents(events?.data || []);
            renderDonations(donations?.data || []);
            renderPrayers(prayers?.data || []);

        } catch (err) {
            console.error('Dashboard load error:', err);
            showError('Failed to load dashboard data.');
        }
    }

    // ──────────────────────────────────────────────
    // RENDER PROFILE
    // ──────────────────────────────────────────────
    function renderProfile(profile) {
        const firstName = profile?.first_name || currentUser?.user_metadata?.first_name || 'Partner';
        const lastName = profile?.last_name || currentUser?.user_metadata?.last_name || '';
        const email = profile?.email || currentUser?.email || '';
        const tier = profile?.tier || 'Silver';
        const joinDate = profile?.join_date ? new Date(profile.join_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'long' }) : '';

        const tierColors = { Silver: '#94a3b8', Gold: '#f59e0b', 'Kingdom Builder': '#6366f1' };
        const tierColor = tierColors[tier] || '#94a3b8';

        const el = document.getElementById('dashboardProfile');
        if (el) {
            el.innerHTML = `
                <div class="dash-welcome">
                    <div class="dash-avatar">${firstName.charAt(0)}${lastName.charAt(0) || ''}</div>
                    <div class="dash-welcome-text">
                        <h1>Welcome back, <span style="color:var(--gold)">${firstName}</span>!</h1>
                        <p>${email}</p>
                        <div style="margin-top:8px">
                            <span class="card-badge" style="background:${tierColor};color:white;font-size:0.85rem;">
                                ⭐ ${tier} Partner
                            </span>
                            ${joinDate ? `<span style="color:var(--text-muted);font-size:0.85rem;margin-left:12px">Member since ${joinDate}</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }
    }

    // ──────────────────────────────────────────────
    // RENDER REGISTERED EVENTS
    // ──────────────────────────────────────────────
    function renderEvents(registrations) {
        const el = document.getElementById('dashboardEvents');
        if (!el) return;

        const countEl = document.getElementById('eventsCount');
        if (countEl) countEl.textContent = registrations.length;

        if (registrations.length === 0) {
            el.innerHTML = `
                <div class="dash-empty">
                    <div class="dash-empty-icon">📅</div>
                    <p>You haven't registered for any events yet.</p>
                    <a href="events.html" class="btn btn-primary" style="margin-top:12px">Browse Events</a>
                </div>`;
            return;
        }

        el.innerHTML = registrations.map(reg => {
            const event = reg.events || {};
            const date = event.event_date ? new Date(event.event_date) : null;
            const dateStr = date ? date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD';
            const isPast = date && date < new Date();
            const TYPE_COLORS = { Prayer: '#6366f1', Conference: '#f59e0b', Training: '#10b981', Crusade: '#ef4444', General: '#64748b' };
            const color = TYPE_COLORS[event.type] || '#64748b';

            return `
            <div class="dash-list-item">
                <div class="dash-list-icon" style="background:${color}20;color:${color}">
                    ${event.type === 'Prayer' ? '🙏' : event.type === 'Conference' ? '🎤' : event.type === 'Training' ? '📚' : '✨'}
                </div>
                <div class="dash-list-content">
                    <h4>${event.title || 'Event'}</h4>
                    <p>📅 ${dateStr} &nbsp;|&nbsp; 📍 ${event.location || 'TBD'}</p>
                </div>
                <div>
                    <span class="card-badge" style="background:${isPast ? '#64748b' : '#10b981'};color:white;font-size:0.8rem;">
                        ${isPast ? 'Attended' : 'Upcoming'}
                    </span>
                </div>
            </div>`;
        }).join('');
    }

    // ──────────────────────────────────────────────
    // RENDER GIVING HISTORY
    // ──────────────────────────────────────────────
    function renderDonations(donations) {
        const el = document.getElementById('dashboardDonations');
        if (!el) return;

        const total = donations.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
        const totalEl = document.getElementById('givingTotal');
        if (totalEl) totalEl.textContent = total > 0 ? `KSh ${total.toLocaleString()}` : '—';

        if (donations.length === 0) {
            el.innerHTML = `
                <div class="dash-empty">
                    <div class="dash-empty-icon">💳</div>
                    <p>No giving history yet.</p>
                    <a href="give.html" class="btn btn-primary" style="margin-top:12px">Give Now</a>
                </div>`;
            return;
        }

        el.innerHTML = donations.map(d => {
            const date = new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
            const amount = new Intl.NumberFormat('en-KE', { style: 'currency', currency: d.currency || 'KES' }).format(d.amount);
            return `
            <div class="dash-list-item">
                <div class="dash-list-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b">💰</div>
                <div class="dash-list-content">
                    <h4>${amount} <span style="font-weight:400;color:var(--text-muted);font-size:0.9rem;">— ${d.designation || 'General Fund'}</span></h4>
                    <p>📅 ${date} &nbsp;|&nbsp; ${d.frequency === 'monthly' ? '🔄 Monthly' : '1️⃣ One-Time'}</p>
                </div>
                <span class="card-badge" style="background:#10b981;color:white;font-size:0.8rem;">Received</span>
            </div>`;
        }).join('');
    }

    // ──────────────────────────────────────────────
    // RENDER PRAYER REQUESTS
    // ──────────────────────────────────────────────
    function renderPrayers(prayers) {
        const listEl = document.getElementById('dashboardPrayers');
        if (!listEl) return;

        const countEl = document.getElementById('prayersCount');
        if (countEl) countEl.textContent = prayers.length;

        if (prayers.length === 0) {
            listEl.innerHTML = `
                <div class="dash-empty">
                    <div class="dash-empty-icon">🙏</div>
                    <p>You haven't submitted any prayer requests yet.</p>
                </div>`;
        } else {
            const statusColors = { pending: '#f59e0b', praying: '#6366f1', answered: '#10b981' };
            listEl.innerHTML = prayers.map(p => {
                const date = new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                const color = statusColors[p.status] || '#64748b';
                return `
                <div class="dash-list-item">
                    <div class="dash-list-icon" style="background:${color}20;color:${color}">🙏</div>
                    <div class="dash-list-content">
                        <h4>${p.subject}</h4>
                        <p>📅 ${date} ${p.is_anonymous ? '&nbsp;|&nbsp; 🔒 Anonymous' : ''}</p>
                    </div>
                    <span class="card-badge" style="background:${color};color:white;font-size:0.8rem;text-transform:capitalize">${p.status}</span>
                </div>`;
            }).join('');
        }
    }

    // ──────────────────────────────────────────────
    // SUBMIT PRAYER REQUEST
    // ──────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const prayerForm = document.getElementById('prayerForm');
        if (prayerForm) {
            prayerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('prayerSubmitBtn');
                const statusEl = document.getElementById('prayerStatus');
                const subject = document.getElementById('prayerSubject').value.trim();
                const message = document.getElementById('prayerMessage').value.trim();
                const isAnonymous = document.getElementById('prayerAnonymous')?.checked || false;

                btn.textContent = 'Submitting...';
                btn.disabled = true;
                if (statusEl) statusEl.style.display = 'none';

                try {
                    const response = await fetch('/api/prayer', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ subject, message, isAnonymous }),
                    });
                    const result = await response.json();

                    if (response.ok) {
                        if (statusEl) {
                            statusEl.textContent = '✅ Your prayer request has been submitted. We are praying for you!';
                            statusEl.style.color = '#0d9488';
                            statusEl.style.display = 'block';
                        }
                        prayerForm.reset();
                        // Refresh prayers list
                        const updatedRes = await fetch('/api/partner/prayers', { headers: getAuthHeaders() });
                        const updated = await updatedRes.json();
                        renderPrayers(updated.data || []);
                    } else {
                        if (statusEl) {
                            statusEl.textContent = '❌ ' + (result.error || 'Submission failed.');
                            statusEl.style.color = '#ef4444';
                            statusEl.style.display = 'block';
                        }
                    }
                } catch {
                    if (statusEl) {
                        statusEl.textContent = '❌ Network error. Please try again.';
                        statusEl.style.color = '#ef4444';
                        statusEl.style.display = 'block';
                    }
                } finally {
                    btn.textContent = 'Submit Prayer Request';
                    btn.disabled = false;
                }
            });
        }
    });

    function showError(msg) {
        console.error(msg);
    }
})();

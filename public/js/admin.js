// js/admin.js — KANI Admin Panel Frontend Logic

(function () {
    'use strict';

    let adminToken = null;
    let currentPage = 'dashboard';

    // Cache for data
    const cache = {};

    // All events (for filter dropdowns etc.)
    let allEvents = [];
    let allContacts = [];
    let allDonations = [];
    let allPartners = [];
    let allNewsletter = [];
    let allPrayers = [];
    let allRegistrations = [];

    // ──────────────────────────────────────────────
    // AUTH
    // ──────────────────────────────────────────────
    window.adminLogin = async function () {
        const tokenInput = document.getElementById('adminTokenInput');
        const errorEl = document.getElementById('loginError');
        const token = tokenInput.value.trim();

        if (!token) {
            errorEl.textContent = 'Please enter your admin token.';
            return;
        }

        errorEl.textContent = 'Verifying...';

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const result = await res.json();

            if (result.success) {
                adminToken = token;
                localStorage.setItem('kani_admin_token', token);
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('adminApp').style.display = 'flex';
                errorEl.textContent = '';
                initDashboard();
            } else {
                errorEl.textContent = '❌ ' + (result.error || 'Invalid token.');
            }
        } catch {
            errorEl.textContent = '❌ Connection error. Is the server running?';
        }
    };

    window.adminLogout = function () {
        localStorage.removeItem('kani_admin_token');
        adminToken = null;
        document.getElementById('adminApp').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminTokenInput').value = '';
    };

    // Check for saved session
    document.addEventListener('DOMContentLoaded', () => {
        const saved = localStorage.getItem('kani_admin_token');
        if (saved) {
            document.getElementById('adminTokenInput').value = saved;
            adminLogin();
        }

        // Online link toggle
        document.getElementById('evIsOnline').addEventListener('change', (e) => {
            document.getElementById('onlineLinkGroup').style.display = e.target.checked ? 'block' : 'none';
        });
    });

    function adminHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
        };
    }

    // ──────────────────────────────────────────────
    // NAVIGATION
    // ──────────────────────────────────────────────
    window.showPage = function (page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        document.getElementById(`page-${page}`)?.classList.add('active');
        document.getElementById(`nav-${page}`)?.classList.add('active');
        document.getElementById('topbarTitle').textContent = {
            dashboard: 'Dashboard Overview',
            events: 'Events Management',
            registrations: 'Event Registrations',
            contacts: 'Contact Messages',
            prayers: 'Prayer Requests',
            donations: 'Donation Records',
            partners: 'Registered Partners',
            newsletter: 'Newsletter Subscribers',
            settings: 'Admin Profile & Settings',
        }[page] || page;

        currentPage = page;

        if (!cache[page]) {
            loadPageData(page);
        }
    };

    window.refreshCurrentPage = function () {
        delete cache[currentPage];
        loadPageData(currentPage);
    };

    async function loadPageData(page) {
        switch (page) {
            case 'dashboard': return loadStats();
            case 'events': return loadEvents();
            case 'registrations': return loadRegistrations();
            case 'contacts': return loadContacts();
            case 'prayers': return loadPrayers();
            case 'donations': return loadDonations();
            case 'partners': return loadPartners();
            case 'newsletter': return loadNewsletter();
            case 'blogs': return loadBlogs();
            case 'settings': return loadSettings();
        }
    }

    async function initDashboard() {
        await loadStats();
        cache['dashboard'] = true;
    }

    // ──────────────────────────────────────────────
    // STATS
    // ──────────────────────────────────────────────
    async function loadStats() {
        try {
            const res = await fetch('/api/admin/stats', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            const s = result.stats;
            document.getElementById('statEvents').textContent = s.events;
            document.getElementById('statDonations').textContent = `KSh ${Number(s.totalDonations).toLocaleString()}`;
            document.getElementById('statPartners').textContent = s.partners;
            document.getElementById('statNewsletter').textContent = s.newsletter;
            document.getElementById('statContacts').textContent = s.contacts;
            document.getElementById('statRegistrations').textContent = s.registrations;
            document.getElementById('statPrayers').textContent = s.prayers;
            document.getElementById('statDonationCount').textContent = s.donations;

            // Update nav badges
            document.getElementById('navBadgeContacts').textContent = s.contacts;
            document.getElementById('navBadgeEvents').textContent = s.events;

            cache['dashboard'] = true;
        } catch (err) {
            toast('Failed to load stats: ' + err.message, 'error');
        }
    }

    // ──────────────────────────────────────────────
    // EVENTS
    // ──────────────────────────────────────────────
    async function loadEvents() {
        const el = document.getElementById('eventsTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/events', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            allEvents = result.data || [];
            renderEventsTable(allEvents);
            cache['events'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    function renderEventsTable(events) {
        const el = document.getElementById('eventsTable');
        if (!events.length) { el.innerHTML = emptyState('📅', 'No events found. Create your first event!'); return; }

        el.innerHTML = `<table>
            <thead><tr>
                <th>Title</th><th>Date</th><th>Type</th><th>Location</th><th>Capacity</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
            ${events.map(ev => {
                const date = new Date(ev.event_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                const isPast = new Date(ev.event_date) < new Date();
                return `<tr>
                    <td style="font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ev.title}</td>
                    <td class="${isPast ? 'text-muted' : ''}">${date}</td>
                    <td><span class="badge badge-${ev.type.toLowerCase()}">${ev.type}</span></td>
                    <td class="text-muted text-clamp">${ev.location}</td>
                    <td class="text-muted">${ev.capacity ? ev.capacity.toLocaleString() : 'Unlimited'}</td>
                    <td><span class="badge badge-${ev.is_active ? 'active' : 'inactive'}">${ev.is_active ? 'Active' : 'Hidden'}</span></td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.8rem;" onclick="openEventModal('${ev.id}')">Edit</button>
                            <button class="btn btn-danger" style="padding:5px 10px;font-size:0.8rem;" onclick="deleteEvent('${ev.id}','${ev.title.replace(/'/g, "\\'")}')">Hide</button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    // Event Modal
    window.openEventModal = function (eventId) {
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        form.reset();
        document.getElementById('eventFormStatus').style.display = 'none';
        document.getElementById('eventFormId').value = eventId || '';
        document.getElementById('onlineLinkGroup').style.display = 'none';

        if (eventId) {
            document.getElementById('eventModalTitle').textContent = 'Edit Event';
            document.getElementById('eventFormBtn').textContent = 'Save Changes';
            const ev = allEvents.find(e => e.id === eventId);
            if (ev) {
                document.getElementById('evTitle').value = ev.title || '';
                document.getElementById('evDescription').value = ev.description || '';
                document.getElementById('evDate').value = ev.event_date ? ev.event_date.slice(0, 16) : '';
                document.getElementById('evEndDate').value = ev.end_date ? ev.end_date.slice(0, 16) : '';
                document.getElementById('evLocation').value = ev.location || '';
                document.getElementById('evType').value = ev.type || 'General';
                document.getElementById('evCapacity').value = ev.capacity || '';
                document.getElementById('evLatitude').value = ev.latitude || '';
                document.getElementById('evLongitude').value = ev.longitude || '';
                document.getElementById('evSocialFB').checked = ev.social_platforms?.includes('facebook');
                document.getElementById('evSocialIG').checked = ev.social_platforms?.includes('instagram');
                document.getElementById('evSocialYT').checked = ev.social_platforms?.includes('youtube');
                document.getElementById('evIsOnline').checked = !!ev.is_online;
                document.getElementById('evIsActive').checked = !!ev.is_active;
                document.getElementById('evOnlineLink').value = ev.online_link || '';
                document.getElementById('onlineLinkGroup').style.display = ev.is_online ? 'block' : 'none';
            }
        } else {
            document.getElementById('eventModalTitle').textContent = 'Create New Event';
            document.getElementById('eventFormBtn').textContent = 'Create Event';
            document.getElementById('evIsActive').checked = true;
        }

        modal.classList.add('open');
    };

    window.closeEventModal = function () {
        document.getElementById('eventModal').classList.remove('open');
    };

    window.submitEventForm = async function (e) {
        e.preventDefault();
        const btn = document.getElementById('eventFormBtn');
        const statusEl = document.getElementById('eventFormStatus');
        const eventId = document.getElementById('eventFormId').value;

        const platforms = [];
        if (document.getElementById('evSocialFB').checked) platforms.push('facebook');
        if (document.getElementById('evSocialIG').checked) platforms.push('instagram');
        if (document.getElementById('evSocialYT').checked) platforms.push('youtube');

        const payload = {
            title: document.getElementById('evTitle').value.trim(),
            description: document.getElementById('evDescription').value.trim(),
            event_date: document.getElementById('evDate').value,
            end_date: document.getElementById('evEndDate').value || null,
            location: document.getElementById('evLocation').value.trim(),
            type: document.getElementById('evType').value,
            capacity: document.getElementById('evCapacity').value || null,
            latitude: document.getElementById('evLatitude').value || null,
            longitude: document.getElementById('evLongitude').value || null,
            social_platforms: platforms,
            is_online: document.getElementById('evIsOnline').checked,
            online_link: document.getElementById('evOnlineLink').value.trim() || null,
            is_active: document.getElementById('evIsActive').checked,
        };

        btn.textContent = 'Saving...';
        btn.disabled = true;
        statusEl.style.display = 'none';

        try {
            const method = eventId ? 'PUT' : 'POST';
            const url = eventId ? `/api/admin/events/${eventId}` : '/api/admin/events';
            const res = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify(payload) });
            const result = await res.json();

            if (result.success) {
                toast(`Event ${eventId ? 'updated' : 'created'} successfully! ✅`, 'success');
                closeEventModal();
                delete cache['events'];
                loadEvents();
            } else {
                statusEl.textContent = '❌ ' + result.error;
                statusEl.className = 'form-status error';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            statusEl.textContent = '❌ Network error: ' + err.message;
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
        } finally {
            btn.textContent = eventId ? 'Save Changes' : 'Create Event';
            btn.disabled = false;
        }
    };

    window.deleteEvent = async function (id, title) {
        if (!confirm(`Hide "${title}" from the public site?`)) return;
        try {
            const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE', headers: adminHeaders() });
            const result = await res.json();
            if (result.success) {
                toast('Event hidden from public. ✅', 'success');
                delete cache['events'];
                loadEvents();
            } else {
                toast('Error: ' + result.error, 'error');
            }
        } catch (err) {
            toast('Network error.', 'error');
        }
    };

    // ──────────────────────────────────────────────
    // REGISTRATIONS
    // ──────────────────────────────────────────────
    async function loadRegistrations() {
        const el = document.getElementById('registrationsTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/registrations', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            allRegistrations = result.data || [];
            renderRegistrationsTable(allRegistrations);
            buildRegEventFilter();
            cache['registrations'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    function buildRegEventFilter() {
        const container = document.getElementById('regEventFilter');
        const uniqueEvents = [...new Map(allRegistrations.map(r => [r.event_id, r.events])).entries()]
            .filter(([, ev]) => ev);
        container.innerHTML = `
            <button class="filter-btn active" onclick="filterRegs(null, this)">All</button>
            ${uniqueEvents.map(([id, ev]) => `<button class="filter-btn" onclick="filterRegs('${id}', this)">${ev.title?.substring(0, 20)}...</button>`).join('')}`;
    }

    window.filterRegs = function (eventId, btn) {
        document.querySelectorAll('#regEventFilter .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filtered = eventId ? allRegistrations.filter(r => r.event_id === eventId) : allRegistrations;
        renderRegistrationsTable(filtered);
    };

    function renderRegistrationsTable(regs) {
        const el = document.getElementById('registrationsTable');
        if (!regs.length) { el.innerHTML = emptyState('📋', 'No registrations found.'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Event</th><th>Registered</th></tr></thead>
            <tbody>
            ${regs.map(r => {
                const date = new Date(r.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                return `<tr>
                    <td style="font-weight:600;">${r.first_name} ${r.last_name}</td>
                    <td class="text-muted">${r.email}</td>
                    <td class="text-muted">${r.phone || '—'}</td>
                    <td class="text-clamp" style="max-width:200px;">${r.events?.title || 'Unknown event'}</td>
                    <td class="text-muted">${date}</td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    // ──────────────────────────────────────────────
    // CONTACTS
    // ──────────────────────────────────────────────
    async function loadContacts(status) {
        const el = document.getElementById('contactsTable');
        el.innerHTML = loadingHtml();
        try {
            const url = status && status !== 'all' ? `/api/admin/contacts?status=${status}` : '/api/admin/contacts';
            const res = await fetch(url, { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            allContacts = result.data || [];
            renderContactsTable(allContacts);
            cache['contacts'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    window.filterContacts = function (status, btn) {
        document.querySelectorAll('.filter-btn').forEach(b => { if (b.closest('#page-contacts')) b.classList.remove('active'); });
        btn.classList.add('active');
        delete cache['contacts'];
        loadContacts(status);
    };

    function renderContactsTable(contacts) {
        const el = document.getElementById('contactsTable');
        if (!contacts.length) { el.innerHTML = emptyState('✉️', 'No messages found.'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
            ${contacts.map(c => {
                const date = new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
                return `<tr>
                    <td style="font-weight:600;">${c.first_name} ${c.last_name}</td>
                    <td class="text-muted">${c.email}</td>
                    <td class="text-clamp" style="max-width:220px;">${c.subject}</td>
                    <td><span class="badge badge-${c.status || 'new'}">${c.status || 'new'}</span></td>
                    <td class="text-muted">${date}</td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.8rem;" onclick="viewContact('${c.id}')">View</button>
                            <button class="btn btn-success" style="padding:5px 10px;font-size:0.8rem;" onclick="updateContactStatus('${c.id}', 'resolved')">Resolve</button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    window.viewContact = async function (id) {
        const contact = allContacts.find(c => c.id === id);
        if (!contact) return;

        // Mark as read if new
        if (contact.status === 'new') {
            await updateContactStatus(id, 'read', true);
            contact.status = 'read';
        }

        document.getElementById('contactModalBody').innerHTML = `
            <div style="margin-bottom:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                    <div><div style="color:var(--muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">From</div>
                    <div style="font-weight:600;">${contact.first_name} ${contact.last_name}</div></div>
                    <div><div style="color:var(--muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Email</div>
                    <div><a href="mailto:${contact.email}" style="color:var(--teal);text-decoration:none;">${contact.email}</a></div></div>
                </div>
                <div style="margin-bottom:16px;"><div style="color:var(--muted);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Subject</div>
                <div style="font-weight:600;color:var(--gold);">${contact.subject}</div></div>
                <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:16px;line-height:1.7;color:rgba(255,255,255,0.8);">${contact.message}</div>
                <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
                    <button class="btn btn-danger" onclick="updateContactStatus('${contact.id}','new');closeContactModal()">Mark as New</button>
                    <button class="btn btn-ghost" onclick="updateContactStatus('${contact.id}','read');closeContactModal()">Mark Read</button>
                    <button class="btn btn-success" onclick="updateContactStatus('${contact.id}','resolved');closeContactModal()">Resolve</button>
                    <a href="mailto:${contact.email}?subject=Re: ${encodeURIComponent(contact.subject)}" class="btn btn-primary" target="_blank">Reply via Email →</a>
                </div>
            </div>`;
        document.getElementById('contactModal').classList.add('open');
    };

    window.closeContactModal = function () { document.getElementById('contactModal').classList.remove('open'); };

    window.updateContactStatus = async function (id, status, silent) {
        try {
            await fetch(`/api/admin/contacts/${id}`, {
                method: 'PATCH',
                headers: adminHeaders(),
                body: JSON.stringify({ status }),
            });
            if (!silent) {
                toast(`Contact marked as "${status}". ✅`, 'success');
                delete cache['contacts'];
                loadContacts();
            }
        } catch (err) {
            toast('Update failed.', 'error');
        }
    };

    // ──────────────────────────────────────────────
    // PRAYER REQUESTS
    // ──────────────────────────────────────────────
    let currentPrayerFilter = 'all';

    async function loadPrayers() {
        const el = document.getElementById('prayersTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/prayers', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            allPrayers = result.data || [];
            renderPrayersTable(allPrayers);
            cache['prayers'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    window.filterPrayers = function (status, btn) {
        document.querySelectorAll('#page-prayers .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPrayerFilter = status;
        const filtered = status === 'all' ? allPrayers : allPrayers.filter(p => p.status === status);
        renderPrayersTable(filtered);
    };

    function renderPrayersTable(prayers) {
        const el = document.getElementById('prayersTable');
        if (!prayers.length) { el.innerHTML = emptyState('🙏', 'No prayer requests found.'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Subject</th><th>Submitted By</th><th>Status</th><th>Anonymous</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
            ${prayers.map(p => {
                const date = new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                const submitter = p.is_anonymous ? '🔒 Anonymous' : (p.partners ? `${p.partners.first_name || ''} ${p.partners.last_name || ''}`.trim() : 'Partner');
                return `<tr>
                    <td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.subject}">${p.subject}</td>
                    <td class="text-muted">${submitter}</td>
                    <td><span class="badge badge-${p.status}">${p.status}</span></td>
                    <td class="text-muted">${p.is_anonymous ? 'Yes' : 'No'}</td>
                    <td class="text-muted">${date}</td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.8rem;" onclick="viewPrayer('${p.id}')">View</button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    window.viewPrayer = function (id) {
        const p = allPrayers.find(x => x.id === id);
        if (!p) return;
        const submitter = p.is_anonymous ? '🔒 Anonymous' : (p.partners ? `${p.partners.first_name || ''} ${p.partners.last_name || ''}`.trim() : 'Unknown Partner');
        document.getElementById('prayerModalBody').innerHTML = `
            <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                <span class="badge badge-${p.status}" style="font-size:0.85rem;">${p.status}</span>
                <span style="color:var(--muted);font-size:0.8rem;">${new Date(p.created_at).toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
            </div>
            <div style="font-weight:700;font-size:1.1rem;margin-bottom:8px;color:var(--gold);">${p.subject}</div>
            <div style="color:var(--muted);font-size:0.85rem;margin-bottom:16px;">Submitted by: ${submitter}</div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:16px;line-height:1.7;color:rgba(255,255,255,0.8);margin-bottom:20px;">${p.message}</div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn btn-ghost" onclick="updatePrayerStatus('${p.id}','pending')">Pending</button>
                <button class="btn btn-ghost" style="color:var(--blue);" onclick="updatePrayerStatus('${p.id}','praying')">🙏 Mark Praying</button>
                <button class="btn btn-success" onclick="updatePrayerStatus('${p.id}','answered')">✅ Mark Answered</button>
            </div>`;
        document.getElementById('prayerModal').classList.add('open');
    };

    window.closePrayerModal = function () { document.getElementById('prayerModal').classList.remove('open'); };

    window.updatePrayerStatus = async function (id, status) {
        try {
            await fetch(`/api/admin/prayers/${id}`, {
                method: 'PATCH',
                headers: adminHeaders(),
                body: JSON.stringify({ status }),
            });
            toast(`Prayer marked as "${status}". 🙏`, 'success');
            closePrayerModal();
            delete cache['prayers'];
            loadPrayers();
        } catch {
            toast('Update failed.', 'error');
        }
    };

    // ──────────────────────────────────────────────
    // DONATIONS
    // ──────────────────────────────────────────────
    async function loadDonations() {
        const el = document.getElementById('donationsTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/donations', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            allDonations = result.data || [];
            renderDonationsTable(allDonations);
            cache['donations'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    window.searchDonations = function (query) {
        const q = query.toLowerCase();
        renderDonationsTable(allDonations.filter(d =>
            d.email?.toLowerCase().includes(q) ||
            d.first_name?.toLowerCase().includes(q) ||
            d.last_name?.toLowerCase().includes(q)
        ));
    };

    function renderDonationsTable(donations) {
        const el = document.getElementById('donationsTable');
        if (!donations.length) { el.innerHTML = emptyState('💳', 'No donations yet.'); return; }

        const total = donations.filter(d => d.paystack_status === 'success').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
        el.innerHTML = `
            <div style="padding:16px 20px;background:rgba(245,158,11,0.06);border-bottom:1px solid var(--border);display:flex;gap:32px;">
                <div><span style="color:var(--muted);font-size:0.8rem;">Total Confirmed</span><br><span style="font-weight:700;color:var(--gold);">KSh ${total.toLocaleString()}</span></div>
                <div><span style="color:var(--muted);font-size:0.8rem;">Transactions</span><br><span style="font-weight:700;color:white;">${donations.filter(d=>d.paystack_status==='success').length} successful</span></div>
            </div>
            <table>
            <thead><tr><th>Donor</th><th>Email</th><th>Amount</th><th>Designation</th><th>Frequency</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
            ${donations.map(d => {
                const amt = new Intl.NumberFormat('en-KE', { style: 'currency', currency: d.currency || 'KES' }).format(d.amount);
                const date = new Date(d.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                return `<tr>
                    <td style="font-weight:600;">${d.first_name || ''} ${d.last_name || ''}</td>
                    <td class="text-muted">${d.email}</td>
                    <td style="font-weight:700;color:var(--gold);">${amt}</td>
                    <td class="text-muted">${d.designation || 'General'}</td>
                    <td class="text-muted" style="text-transform:capitalize;">${d.frequency || 'one-time'}</td>
                    <td><span class="badge badge-${d.paystack_status}">${d.paystack_status}</span></td>
                    <td class="text-muted">${date}</td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    // ──────────────────────────────────────────────
    // PARTNERS
    // ──────────────────────────────────────────────
    async function loadPartners() {
        const el = document.getElementById('partnersTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/partners', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            allPartners = result.data || [];
            renderPartnersTable(allPartners);
            cache['partners'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    window.searchPartners = function (query) {
        const q = query.toLowerCase();
        renderPartnersTable(allPartners.filter(p =>
            p.email?.toLowerCase().includes(q) ||
            p.first_name?.toLowerCase().includes(q) ||
            p.last_name?.toLowerCase().includes(q)
        ));
    };

    function renderPartnersTable(partners) {
        const el = document.getElementById('partnersTable');
        if (!partners.length) { el.innerHTML = emptyState('🤝', 'No registered partners yet.'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Country</th><th>Joined</th></tr></thead>
            <tbody>
            ${partners.map(p => {
                const date = new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                const tierColors = { Silver: '#94a3b8', Gold: '#f59e0b', 'Kingdom Builder': '#6366f1' };
                return `<tr>
                    <td style="font-weight:600;">${p.first_name || ''} ${p.last_name || ''}</td>
                    <td class="text-muted">${p.email || '—'}</td>
                    <td><span style="color:${tierColors[p.tier]||'#94a3b8'};font-weight:600;font-size:0.85rem;">⭐ ${p.tier || 'Silver'}</span></td>
                    <td class="text-muted">${p.country || '—'}</td>
                    <td class="text-muted">${date}</td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    // ──────────────────────────────────────────────
    // NEWSLETTER
    // ──────────────────────────────────────────────
    async function loadNewsletter() {
        const el = document.getElementById('newsletterTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/newsletter', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            allNewsletter = result.data || [];
            renderNewsletterTable(allNewsletter);
            cache['newsletter'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    window.searchNewsletter = function (query) {
        const q = query.toLowerCase();
        renderNewsletterTable(allNewsletter.filter(n => n.email?.toLowerCase().includes(q) || n.first_name?.toLowerCase().includes(q)));
    };

    function renderNewsletterTable(subs) {
        const el = document.getElementById('newsletterTable');
        if (!subs.length) { el.innerHTML = emptyState('📧', 'No subscribers yet.'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Subscribed</th></tr></thead>
            <tbody>
            ${subs.map(s => {
                const date = new Date(s.subscribed_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                return `<tr>
                    <td style="font-weight:600;">${s.email}</td>
                    <td class="text-muted">${s.first_name || '—'}</td>
                    <td><span class="badge badge-${s.is_active ? 'active' : 'inactive'}">${s.is_active ? 'Active' : 'Unsubscribed'}</span></td>
                    <td class="text-muted">${date}</td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    // ──────────────────────────────────────────────
    // BLOGS & TEACHINGS
    // ──────────────────────────────────────────────
    let allBlogs = [];
    async function loadBlogs() {
        const el = document.getElementById('blogsTable');
        el.innerHTML = loadingHtml();
        try {
            const res = await fetch('/api/admin/blogs', { headers: adminHeaders() });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            allBlogs = result.data || [];
            renderBlogsTable(allBlogs);
            cache['blogs'] = true;
        } catch (err) {
            el.innerHTML = errorHtml(err.message);
        }
    }

    function renderBlogsTable(blogs) {
        const el = document.getElementById('blogsTable');
        if (!blogs.length) { el.innerHTML = emptyState('📖', 'No teachings found. Create one!'); return; }
        el.innerHTML = `<table>
            <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
            ${blogs.map(b => {
                const date = new Date(b.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                return `<tr>
                    <td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${b.title}">${b.title}</td>
                    <td class="text-muted">${b.author || 'Admin'}</td>
                    <td><span class="badge badge-${b.is_published ? 'active' : 'inactive'}">${b.is_published ? 'Published' : 'Draft'}</span></td>
                    <td class="text-muted">${date}</td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.8rem;" onclick="openBlogModal('${b.id}')">Edit</button>
                            <button class="btn btn-danger" style="padding:5px 10px;font-size:0.8rem;" onclick="deleteBlog('${b.id}', '${b.title.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table>`;
    }

    window.openBlogModal = function(id) {
        const modal = document.getElementById('blogModal');
        const form = document.getElementById('blogForm');
        form.reset();
        document.getElementById('blogFormStatus').style.display = 'none';
        document.getElementById('blogFormId').value = id || '';
        if (id) {
            document.getElementById('blogModalTitle').textContent = 'Edit Teaching';
            document.getElementById('blogFormBtn').textContent = 'Save Changes';
            const b = allBlogs.find(x => x.id === id);
            if (b) {
                document.getElementById('blTitle').value = b.title || '';
                document.getElementById('blContent').value = b.content || '';
                document.getElementById('blImage').value = b.image_url || '';
                document.getElementById('blIsPublished').checked = !!b.is_published;
            }
        } else {
            document.getElementById('blogModalTitle').textContent = 'Create Teaching';
            document.getElementById('blogFormBtn').textContent = 'Publish';
            document.getElementById('blIsPublished').checked = true;
        }
        modal.classList.add('open');
    };

    window.closeBlogModal = function() {
        document.getElementById('blogModal').classList.remove('open');
    };

    window.submitBlogForm = async function(e) {
        e.preventDefault();
        const btn = document.getElementById('blogFormBtn');
        const statusEl = document.getElementById('blogFormStatus');
        const blogId = document.getElementById('blogFormId').value;
        const payload = {
            title: document.getElementById('blTitle').value.trim(),
            content: document.getElementById('blContent').value.trim(),
            image_url: document.getElementById('blImage').value.trim() || null,
            is_published: document.getElementById('blIsPublished').checked
        };
        btn.textContent = 'Saving...';
        btn.disabled = true;
        statusEl.style.display = 'none';
        try {
            const method = blogId ? 'PUT' : 'POST';
            const url = blogId ? `/api/admin/blogs/${blogId}` : '/api/admin/blogs';
            const res = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.success) {
                toast(`Blog ${blogId ? 'updated' : 'created'} successfully! ✅`, 'success');
                closeBlogModal();
                delete cache['blogs'];
                loadBlogs();
            } else {
                statusEl.textContent = '❌ ' + result.error;
                statusEl.className = 'form-status error';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            statusEl.textContent = '❌ Network error.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
        } finally {
            btn.textContent = blogId ? 'Save Changes' : 'Publish';
            btn.disabled = false;
        }
    };

    window.deleteBlog = async function(id, title) {
        if (!confirm(`Delete "${title}" permanently?`)) return;
        try {
            const res = await fetch(`/api/admin/blogs/${id}`, { method: 'DELETE', headers: adminHeaders() });
            const result = await res.json();
            if (result.success) {
                toast('Blog deleted. ✅', 'success');
                delete cache['blogs'];
                loadBlogs();
            } else {
                toast('Error: ' + result.error, 'error');
            }
        } catch (err) {
            toast('Network error.', 'error');
        }
    };

    // ──────────────────────────────────────────────
    // SETTINGS
    // ──────────────────────────────────────────────
    async function loadSettings() {
        try {
            const res = await fetch('/api/admin/settings', { headers: adminHeaders() });
            const result = await res.json();
            if (result.success) {
                document.getElementById('setAdminEmail').value = result.data.adminEmail || '';
                document.getElementById('setAdminToken').value = result.data.adminToken || '';
                cache['settings'] = true;
            } else {
                toast('Error loading settings', 'error');
            }
        } catch (err) {
            toast('Network error loading settings', 'error');
        }
    }

    window.submitSettings = async function(e) {
        e.preventDefault();
        const btn = document.getElementById('settingsBtn');
        const statusEl = document.getElementById('settingsStatus');
        const payload = {
            adminEmail: document.getElementById('setAdminEmail').value.trim(),
            adminToken: document.getElementById('setAdminToken').value.trim()
        };

        btn.textContent = 'Saving...';
        btn.disabled = true;
        statusEl.style.display = 'none';

        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: adminHeaders(),
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                toast(result.message, 'success');
                // The token changed, so log out after a brief delay
                setTimeout(() => adminLogout(), 2500);
            } else {
                statusEl.textContent = '❌ ' + result.error;
                statusEl.className = 'form-status error';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            statusEl.textContent = '❌ Network error.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
        } finally {
            btn.textContent = 'Save Settings';
            btn.disabled = false;
        }
    };

    // ──────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────
    function loadingHtml() {
        return `<div class="loading"><div class="spinner"></div><p>Loading...</p></div>`;
    }

    function errorHtml(msg) {
        return `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p style="color:#ef4444;">${msg}</p><p style="margin-top:8px;">Check your admin token and server connection.</p></div>`;
    }

    function emptyState(icon, msg) {
        return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><p>${msg}</p></div>`;
    }

    function toast(msg, type = 'success') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = `show ${type}`;
        setTimeout(() => { el.className = ''; }, 3500);
    }

    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('open');
        }
    });

})();

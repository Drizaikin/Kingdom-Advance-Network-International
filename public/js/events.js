// js/events.js — Live events with filters and registration

(function () {
    'use strict';

    const EVENT_TYPES = ['All', 'Prayer', 'Conference', 'Training', 'Crusade', 'General'];
    const TYPE_COLORS = {
        Prayer: '#6366f1',
        Conference: '#f59e0b',
        Training: '#10b981',
        Crusade: '#ef4444',
        General: '#64748b',
    };

    let currentFilter = 'All';
    let allEvents = [];

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        buildFilterPills();
        fetchEvents();
    });

    // ──────────────────────────────────────────────
    // FILTER PILLS
    // ──────────────────────────────────────────────
    function buildFilterPills() {
        const container = document.getElementById('eventFilters');
        if (!container) return;

        container.innerHTML = EVENT_TYPES.map(type => `
            <button
                class="event-filter-pill ${type === 'All' ? 'active' : ''}"
                data-type="${type}"
                onclick="window.setEventFilter('${type}')"
            >${type}</button>
        `).join('');
    }

    window.setEventFilter = function (type) {
        currentFilter = type;
        document.querySelectorAll('.event-filter-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        renderEvents(currentFilter === 'All' ? allEvents : allEvents.filter(e => e.type === type));
    };

    // ──────────────────────────────────────────────
    // FETCH EVENTS
    // ──────────────────────────────────────────────
    async function fetchEvents() {
        const container = document.getElementById('eventsList');
        if (!container) return;

        container.innerHTML = `
            <div class="events-loading">
                <div class="loading-spinner"></div>
                <p>Loading upcoming events...</p>
            </div>`;

        try {
            const response = await fetch('/api/events');
            const result = await response.json();

            if (result.success && result.data) {
                allEvents = result.data;
                renderEvents(allEvents);
            } else {
                showEmpty(container);
            }
        } catch (err) {
            container.innerHTML = `
                <div class="events-empty">
                    <div class="events-empty-icon">📡</div>
                    <h3>Connection Error</h3>
                    <p>Could not load events. Please ensure the server is running.</p>
                    <button class="btn btn-outline" onclick="window.location.reload()">Try Again</button>
                </div>`;
        }
    }

    // ──────────────────────────────────────────────
    // RENDER EVENTS
    // ──────────────────────────────────────────────
    function renderEvents(events) {
        const container = document.getElementById('eventsList');
        if (!container) return;

        if (!events || events.length === 0) {
            showEmpty(container);
            return;
        }

        container.innerHTML = events.map((ev, i) => {
            const startDate = new Date(ev.event_date);
            const endDate = ev.end_date ? new Date(ev.end_date) : null;
            const day = startDate.getDate().toString().padStart(2, '0');
            const month = startDate.toLocaleString('default', { month: 'short' });
            const year = startDate.getFullYear();
            const color = TYPE_COLORS[ev.type] || '#64748b';

            const timeStr = startDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = endDate ? endDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '';
            const dayOfWeek = startDate.toLocaleDateString('en-KE', { weekday: 'long' });

            // Multi-day event
            let dateDisplay = `${dayOfWeek}, ${startDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            if (endDate && endDate.toDateString() !== startDate.toDateString()) {
                dateDisplay += ` – ${endDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            }

            const isOnline = ev.is_online;
            const isSoldOut = ev.capacity && ev.registrations_count >= ev.capacity;

            return `
            <div class="card event-card event-card-full" data-aos="fade-up" data-aos-delay="${(i % 3) * 80}">
                <div class="event-date">
                    <div class="event-date-day">${day}</div>
                    <div class="event-date-month">${month}</div>
                    <div class="event-date-year">${year}</div>
                </div>
                <div class="event-details">
                    <div class="event-badges">
                        <span class="card-badge" style="background:${color};color:white;">${ev.type}</span>
                        ${isOnline ? '<span class="card-badge" style="background:#0ea5e9;color:white;">🌐 Online</span>' : ''}
                        ${isSoldOut ? '<span class="card-badge" style="background:#6b7280;color:white;">Fully Booked</span>' : ''}
                    </div>
                    <h3 class="card-title">${ev.title}</h3>
                    <p class="card-text">${ev.description || ''}</p>
                    <div class="event-meta">
                        <span class="event-meta-item">📅 ${dateDisplay}</span>
                        <span class="event-meta-item">🕐 ${timeStr}${endTimeStr ? ' – ' + endTimeStr : ''}</span>
                        <span class="event-meta-item">📍 ${ev.location}</span>
                        ${ev.capacity ? `<span class="event-meta-item">👥 ${ev.capacity} capacity</span>` : ''}
                    </div>
                </div>
                <div class="event-action">
                    ${isSoldOut
                        ? '<button class="btn btn-outline" disabled style="opacity:0.5;cursor:not-allowed;">Fully Booked</button>'
                        : `<button onclick="openRegistrationModal('${ev.id}', \`${ev.title.replace(/`/g, '\\`')}\`)" class="btn btn-primary">Register Now</button>`
                    }
                </div>
            </div>`;
        }).join('');

        // Re-init AOS for newly rendered cards
        if (typeof AOS !== 'undefined') AOS.refresh();
    }

    function showEmpty(container) {
        container.innerHTML = `
            <div class="events-empty">
                <div class="events-empty-icon">🙏</div>
                <h3>No Upcoming Events</h3>
                <p>There are no events in this category right now. Stay connected — something powerful is coming!</p>
                <a href="contact.html" class="btn btn-primary">Get Notified</a>
            </div>`;
    }
})();

// js/main.js — Core KANI frontend logic
// Uses relative API paths so it works in any environment

document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 50 });
    }
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }
    
    // Auto-fill forms if user is logged in
    try {
        const userStr = localStorage.getItem('kani_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const fn = user.user_metadata?.first_name || '';
            const ln = user.user_metadata?.last_name || '';
            const em = user.email || '';
            
            // Contact form
            const cfFirst = document.getElementById('firstName');
            const cfLast = document.getElementById('lastName');
            const cfEmail = document.getElementById('email');
            if (cfFirst && !cfFirst.value) cfFirst.value = fn;
            if (cfLast && !cfLast.value) cfLast.value = ln;
            if (cfEmail && !cfEmail.value) cfEmail.value = em;
            
            // Newsletter form
            const nlEmail = document.getElementById('newsletterEmail');
            if (nlEmail && !nlEmail.value) nlEmail.value = em;
        }
    } catch(e) {}

    // Counter animation for stats
    const counters = document.querySelectorAll('.counter-value');
    if (counters.length > 0) {
        const animateCounter = (el) => {
            const target = parseInt(el.dataset.target);
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;
            const update = () => {
                current = Math.min(current + step, target);
                el.textContent = Math.floor(current).toLocaleString() + (el.dataset.suffix || '+');
                if (current < target) requestAnimationFrame(update);
            };
            requestAnimationFrame(update);
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        counters.forEach(c => observer.observe(c));
    }

    // ──────────────────────────────────────────────
    // CONTACT FORM
    // ──────────────────────────────────────────────
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const statusDiv = document.getElementById('formStatus');

            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
            };

            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                const result = await response.json();

                if (response.ok) {
                    statusDiv.textContent = '✅ Thank you! Your message has been received. We will get back to you soon.';
                    statusDiv.style.color = '#0d9488';
                    statusDiv.style.background = 'rgba(13,148,136,0.08)';
                    statusDiv.style.padding = '12px 16px';
                    statusDiv.style.borderRadius = '8px';
                    contactForm.reset();
                } else {
                    statusDiv.textContent = '❌ ' + (result.error || 'There was an error sending your message.');
                    statusDiv.style.color = '#ef4444';
                    statusDiv.style.background = 'rgba(239,68,68,0.08)';
                    statusDiv.style.padding = '12px 16px';
                    statusDiv.style.borderRadius = '8px';
                }
            } catch (error) {
                statusDiv.textContent = '❌ Network error. Please try again later.';
                statusDiv.style.color = '#ef4444';
            } finally {
                statusDiv.style.display = 'block';
                submitBtn.textContent = 'Send Message';
                submitBtn.disabled = false;
            }
        });
    }

    // ──────────────────────────────────────────────
    // HOMEPAGE UPCOMING EVENTS (Latest 2)
    // ──────────────────────────────────────────────
    const homeEventsList = document.getElementById('homeEventsList');
    if (homeEventsList) {
        fetch('/api/events')
            .then(r => r.json())
            .then(result => {
                if (result.success && result.data && result.data.length > 0) {
                    const events = result.data.slice(0, 2);
                    homeEventsList.innerHTML = events.map((ev, i) => {
                        const d = new Date(ev.event_date);
                        const day = d.getDate().toString().padStart(2, '0');
                        const month = d.toLocaleString('default', { month: 'short' });
                        const badges = { Prayer: '#6366f1', Conference: '#f59e0b', Training: '#10b981', Crusade: '#ef4444', General: '#64748b' };
                        const color = badges[ev.type] || '#64748b';
                        return `
                        <div class="card event-card" data-aos="fade-up" data-aos-delay="${i * 100}">
                            <div class="event-date">
                                <div class="event-date-day">${day}</div>
                                <div class="event-date-month">${month}</div>
                            </div>
                            <div class="event-details">
                                <div class="card-badge" style="margin-bottom:12px;display:inline-block;background:${color};color:white;">${ev.type}</div>
                                <h3 class="card-title">${ev.title}</h3>
                                <p class="card-text">${ev.description || ''}</p>
                                <p style="font-size:0.9rem;color:var(--gold);margin-top:8px;">📍 ${ev.location}</p>
                            </div>
                            <div class="event-action">
                                <a href="events.html" class="btn btn-primary">Register Now</a>
                            </div>
                        </div>`;
                    }).join('');
                }
            })
            .catch(() => { /* Silently fail on homepage */ });
    }

    // ──────────────────────────────────────────────
    // EVENT REGISTRATION MODAL (on events page)
    // ──────────────────────────────────────────────
    const regForm = document.getElementById('eventRegForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('regSubmitBtn');
            const statusDiv = document.getElementById('regStatus');

            const formData = {
                eventId: document.getElementById('regEventId').value,
                firstName: document.getElementById('regFirstName').value,
                lastName: document.getElementById('regLastName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone')?.value || '',
            };

            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';

            try {
                const response = await fetch('/api/events/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                const result = await response.json();

                if (response.ok) {
                    statusDiv.innerHTML = '✅ Registration confirmed! We\'ll see you there.';
                    statusDiv.style.color = '#0d9488';
                    regForm.reset();
                    setTimeout(closeRegistrationModal, 2500);
                } else {
                    statusDiv.textContent = '❌ ' + (result.error || 'Registration failed.');
                    statusDiv.style.color = '#ef4444';
                }
            } catch (error) {
                statusDiv.textContent = '❌ Network error. Please try again.';
                statusDiv.style.color = '#ef4444';
            } finally {
                statusDiv.style.display = 'block';
                submitBtn.textContent = 'Confirm Registration';
                submitBtn.disabled = false;
            }
        });
    }

    // ──────────────────────────────────────────────
    // NEWSLETTER FORM
    // ──────────────────────────────────────────────
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newsletterForm.querySelector('button[type="submit"]');
            const statusEl = document.getElementById('newsletterStatus');
            const email = document.getElementById('newsletterEmail').value;
            const firstName = document.getElementById('newsletterName')?.value || '';

            btn.textContent = 'Subscribing...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, firstName }),
                });
                const result = await response.json();
                if (response.ok) {
                    if (statusEl) { statusEl.textContent = '✅ You\'re subscribed!'; statusEl.style.color = '#0d9488'; statusEl.style.display = 'block'; }
                    newsletterForm.reset();
                } else {
                    if (statusEl) { statusEl.textContent = result.error || 'Subscription failed.'; statusEl.style.color = '#ef4444'; statusEl.style.display = 'block'; }
                }
            } catch {
                if (statusEl) { statusEl.textContent = 'Network error. Please try again.'; statusEl.style.display = 'block'; }
            } finally {
                btn.textContent = 'Subscribe';
                btn.disabled = false;
            }
        });
    }
});

// ──────────────────────────────────────────────
// MODAL CONTROLS (global)
// ──────────────────────────────────────────────
window.openRegistrationModal = function (eventId, eventTitle) {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        document.getElementById('regEventId').value = eventId;
        document.getElementById('regEventTitle').textContent = eventTitle;
        
        // Auto-fill if user is logged in
        try {
            const userStr = localStorage.getItem('kani_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                const emailInput = document.getElementById('regEmail');
                const firstNameInput = document.getElementById('regFirstName');
                const lastNameInput = document.getElementById('regLastName');
                
                if (emailInput && user.email) emailInput.value = user.email;
                if (firstNameInput && user.user_metadata?.first_name) firstNameInput.value = user.user_metadata.first_name;
                if (lastNameInput && user.user_metadata?.last_name) lastNameInput.value = user.user_metadata.last_name;
            }
        } catch(e) {}

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeRegistrationModal = function () {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        const form = document.getElementById('eventRegForm');
        if (form) form.reset();
        const status = document.getElementById('regStatus');
        if (status) status.style.display = 'none';
    }
};

// Close modal on backdrop click
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeRegistrationModal();
        });
    }
});

// ──────────────────────────────────────────────
// AUTH MODE TOGGLE (on partnership page)
// ──────────────────────────────────────────────
let isLoginMode = true;
window.toggleAuthMode = function (e) {
    if (e) e.preventDefault();
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleLink = document.getElementById('authToggleLink');
    const signupFields = document.getElementById('signupFields');
    const status = document.getElementById('authStatus');

    if (isLoginMode) {
        if (title) title.textContent = 'Log In to Your Account';
        if (submitBtn) submitBtn.textContent = 'Log In';
        if (toggleLink) toggleLink.textContent = 'New Partner? Create an account';
        if (signupFields) signupFields.style.display = 'none';
    } else {
        if (title) title.textContent = 'Create Partner Account';
        if (submitBtn) submitBtn.textContent = 'Create Account';
        if (toggleLink) toggleLink.textContent = 'Already have an account? Log In';
        if (signupFields) signupFields.style.display = 'block';
    }
    if (status) status.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    // If we're on the partnership page and already logged in, redirect to dashboard
    if (window.location.pathname.includes('partnership.html')) {
        const session = localStorage.getItem('kani_session');
        if (session) {
            window.location.href = 'dashboard.html';
            return;
        }
    }

    const authForm = document.getElementById('partnerAuthForm');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('authSubmitBtn');
            const statusDiv = document.getElementById('authStatus');
            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';

            const formData = {
                email: document.getElementById('authEmail').value,
                password: document.getElementById('authPassword').value,
            };
            if (!isLoginMode) {
                formData.firstName = document.getElementById('authFirstName').value;
                formData.lastName = document.getElementById('authLastName').value;
            }

            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            if (statusDiv) statusDiv.style.display = 'none';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });
                const result = await response.json();

                if (response.ok) {
                    if (isLoginMode) {
                        // Store session
                        localStorage.setItem('kani_session', JSON.stringify(result.session));
                        localStorage.setItem('kani_user', JSON.stringify(result.user));
                        if (statusDiv) {
                            statusDiv.textContent = '✅ Login successful! Redirecting...';
                            statusDiv.style.color = '#0d9488';
                            statusDiv.style.display = 'block';
                        }
                        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
                    } else {
                        if (statusDiv) {
                            statusDiv.textContent = '✅ Account created! Check your email to verify, then log in.';
                            statusDiv.style.color = '#0d9488';
                            statusDiv.style.display = 'block';
                        }
                        authForm.reset();
                        setTimeout(() => {
                            toggleAuthMode();
                        }, 2000);
                    }
                } else {
                    if (statusDiv) {
                        statusDiv.textContent = '❌ ' + (result.error || 'Authentication failed.');
                        statusDiv.style.color = '#ef4444';
                        statusDiv.style.display = 'block';
                    }
                }
            } catch {
                if (statusDiv) {
                    statusDiv.textContent = '❌ Network error. Please try again.';
                    statusDiv.style.color = '#ef4444';
                    statusDiv.style.display = 'block';
                }
            } finally {
                submitBtn.textContent = isLoginMode ? 'Log In' : 'Create Account';
                submitBtn.disabled = false;
            }
        });
    }
});

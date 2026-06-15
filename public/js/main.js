// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-out-cubic',
            once: true,
            offset: 50,
        });
    }

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }

    // Contact Form Handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const statusDiv = document.getElementById('formStatus');
            
            // Get form values
            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            // Loading state
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';

            try {
                // Determine API URL based on environment (development vs production)
                // Defaulting to the local Node.js server we are building
                const response = await fetch('http://localhost:3000/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    statusDiv.textContent = "Thank you! Your message has been received.";
                    statusDiv.style.color = "var(--teal)";
                    contactForm.reset();
                } else {
                    statusDiv.textContent = result.error || "There was an error sending your message.";
                    statusDiv.style.color = "red";
                }
            } catch (error) {
                console.error("Error:", error);
                statusDiv.textContent = "Network error. Please try again later or make sure the backend is running.";
                statusDiv.style.color = "red";
            } finally {
                statusDiv.style.display = 'block';
                submitBtn.textContent = 'Send Message';
                submitBtn.disabled = false;
            }
        });
    }

    // Dynamic Events Loading
    const eventsList = document.getElementById('eventsList');
    if (eventsList) {
        async function fetchEvents() {
            eventsList.innerHTML = '<div style="text-align: center; width: 100%;"><p>Loading upcoming events...</p></div>';
            try {
                const response = await fetch('http://localhost:3000/api/events');
                const result = await response.json();
                
                if (response.ok && result.data && result.data.length > 0) {
                    let html = '';
                    result.data.forEach(event => {
                        const eventDate = new Date(event.event_date);
                        const day = eventDate.getDate().toString().padStart(2, '0');
                        const month = eventDate.toLocaleString('default', { month: 'short' });
                        
                        html += `
                        <div class="card event-card" data-aos="fade-up">
                            <div class="event-date">
                                <div class="event-date-day">${day}</div>
                                <div class="event-date-month">${month}</div>
                            </div>
                            <div class="event-details">
                                <div class="card-badge" style="margin-bottom: 12px; display: inline-block; background: var(--gradient-teal); color: white;">${event.type || 'Event'}</div>
                                <h3 class="card-title">${event.title}</h3>
                                <p class="card-text">${event.description}</p>
                                <p style="font-size: 0.9rem; color: var(--gold); margin-top: 8px;">📍 ${event.location}</p>
                            </div>
                            <div class="event-action">
                                <button onclick="openRegistrationModal('${event.id}', '${event.title}')" class="btn btn-primary">Register Now</button>
                            </div>
                        </div>`;
                    });
                    eventsList.innerHTML = html;
                } else {
                    eventsList.innerHTML = '<div style="text-align: center; width: 100%;"><p>No upcoming events at the moment. Check back soon!</p></div>';
                }
            } catch (error) {
                console.error("Error fetching events:", error);
                eventsList.innerHTML = '<div style="text-align: center; width: 100%; color: red;"><p>Failed to load events. Please ensure backend is running.</p></div>';
            }
        }
        
        fetchEvents();
    }
});

// Event Registration Modal Logic
window.openRegistrationModal = function(eventId, eventTitle) {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        document.getElementById('regEventId').value = eventId;
        document.getElementById('regEventTitle').textContent = eventTitle;
        modal.style.display = 'flex';
    }
};

window.closeRegistrationModal = function() {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('eventRegForm').reset();
        document.getElementById('regStatus').style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
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
                email: document.getElementById('regEmail').value
            };

            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';

            try {
                const response = await fetch('http://localhost:3000/api/events/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    statusDiv.textContent = "Registration successful! See you there.";
                    statusDiv.style.color = "var(--teal)";
                    regForm.reset();
                    setTimeout(closeRegistrationModal, 2500);
                } else {
                    statusDiv.textContent = result.error || "Registration failed.";
                    statusDiv.style.color = "red";
                }
            } catch (error) {
                statusDiv.textContent = "Network error. Please try again later.";
                statusDiv.style.color = "red";
            } finally {
                statusDiv.style.display = 'block';
                submitBtn.textContent = 'Confirm Registration';
                submitBtn.disabled = false;
            }
        });
    }
});

// Auth Logic
let isLoginMode = true;
window.toggleAuthMode = function(e) {
    if(e) e.preventDefault();
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleLink = document.getElementById('authToggleLink');
    const signupFields = document.getElementById('signupFields');
    
    if (isLoginMode) {
        title.textContent = 'Log In to Your Account';
        submitBtn.textContent = 'Log In';
        toggleLink.textContent = 'New Partner? Create an account';
        signupFields.style.display = 'none';
        document.getElementById('authFirstName').required = false;
        document.getElementById('authLastName').required = false;
    } else {
        title.textContent = 'Create Partner Account';
        submitBtn.textContent = 'Sign Up';
        toggleLink.textContent = 'Already have an account? Log In';
        signupFields.style.display = 'block';
        document.getElementById('authFirstName').required = true;
        document.getElementById('authLastName').required = true;
    }
    document.getElementById('authStatus').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('partnerAuthForm');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('authSubmitBtn');
            const statusDiv = document.getElementById('authStatus');
            
            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
            const formData = {
                email: document.getElementById('authEmail').value,
                password: document.getElementById('authPassword').value
            };
            
            if (!isLoginMode) {
                formData.firstName = document.getElementById('authFirstName').value;
                formData.lastName = document.getElementById('authLastName').value;
            }

            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';

            try {
                const response = await fetch(`http://localhost:3000${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    statusDiv.textContent = isLoginMode ? "Login successful! Redirecting..." : "Account created successfully! Please log in.";
                    statusDiv.style.color = "var(--teal)";
                    
                    if (isLoginMode) {
                        localStorage.setItem('kani_session', JSON.stringify(result.session || {}));
                        setTimeout(() => {
                            window.location.href = 'dashboard.html';
                        }, 1000);
                    } else {
                        authForm.reset();
                        setTimeout(() => {
                            toggleAuthMode();
                            statusDiv.textContent = "Please log in with your new credentials.";
                            statusDiv.style.display = 'block';
                        }, 1500);
                    }
                } else {
                    statusDiv.textContent = result.error || "Authentication failed.";
                    statusDiv.style.color = "red";
                }
            } catch (error) {
                statusDiv.textContent = "Network error. Please try again later.";
                statusDiv.style.color = "red";
            } finally {
                if(!isLoginMode || statusDiv.style.color === "red") {
                    submitBtn.textContent = isLoginMode ? 'Log In' : 'Sign Up';
                    submitBtn.disabled = false;
                }
                statusDiv.style.display = 'block';
            }
        });
    }
});

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
});

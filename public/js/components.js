// js/components.js
document.addEventListener('DOMContentLoaded', () => {
    const initCarousel = (containerSelector, prevBtnSelector, nextBtnSelector) => {
        const container = document.querySelector(containerSelector);
        const prevBtn = document.querySelector(prevBtnSelector);
        const nextBtn = document.querySelector(nextBtnSelector);

        if (container && prevBtn && nextBtn) {
            const scrollAmount = container.clientWidth;

            nextBtn.addEventListener('click', () => {
                container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });

            prevBtn.addEventListener('click', () => {
                container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
        }
    };

    initCarousel('.testimonial-carousel', '.testimony-prev', '.testimony-next');

    const countdownElements = document.querySelectorAll('.countdown-timer');
    countdownElements.forEach(timerEl => {
        const targetDateStr = timerEl.getAttribute('data-date');
        if (!targetDateStr) return;
        
        const targetDate = new Date(targetDateStr).getTime();
        
        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                timerEl.innerHTML = "EVENT STARTED";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerEl.innerHTML = `
                <div class="time-block"><span>${days}</span><small>Days</small></div>
                <div class="time-block"><span>${hours}</span><small>Hours</small></div>
                <div class="time-block"><span>${minutes}</span><small>Mins</small></div>
                <div class="time-block"><span>${seconds}</span><small>Secs</small></div>
            `;
        };
        
        updateTimer();
        setInterval(updateTimer, 1000);
    });
});

// js/give.js — Interactive donation form with Paystack integration

(function () {
    'use strict';

    const CURRENCIES = {
        KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
        USD: { symbol: '$', name: 'US Dollar' },
        GBP: { symbol: '£', name: 'British Pound' },
        EUR: { symbol: '€', name: 'Euro' },
        ZAR: { symbol: 'R', name: 'South African Rand' },
    };

    const PRESET_AMOUNTS = {
        KES: [500, 1000, 5000, 10000],
        USD: [10, 25, 100, 500],
        GBP: [10, 25, 100, 500],
        EUR: [10, 25, 100, 500],
        ZAR: [100, 500, 1000, 5000],
    };

    let state = {
        frequency: 'one-time',
        amount: null,
        customAmount: '',
        currency: 'KES',
        designation: 'General Fund',
    };

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        initGiveForm();
        checkPaymentStatus();
        autoFillPartnerDetails();
    });

    function autoFillPartnerDetails() {
        const userStr = localStorage.getItem('kani_user');
        if (!userStr) return;
        try {
            const user = JSON.parse(userStr);
            const emailInput = document.getElementById('giverEmail');
            const firstNameInput = document.getElementById('giverFirstName');
            const lastNameInput = document.getElementById('giverLastName');
            
            if (emailInput && user.email) emailInput.value = user.email;
            if (firstNameInput && user.user_metadata && user.user_metadata.first_name) firstNameInput.value = user.user_metadata.first_name;
            if (lastNameInput && user.user_metadata && user.user_metadata.last_name) lastNameInput.value = user.user_metadata.last_name;
        } catch(e) {}
    }

    function initGiveForm() {
        // Frequency toggle
        document.querySelectorAll('.freq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.frequency = btn.dataset.freq;
            });
        });

        // Currency selector
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.addEventListener('change', () => {
                state.currency = currencySelect.value;
                state.amount = null;
                renderAmountPills();
            });
        }

        // Designation
        const designationSelect = document.getElementById('designationSelect');
        if (designationSelect) {
            designationSelect.addEventListener('change', () => {
                state.designation = designationSelect.value;
            });
        }

        // Amount pills
        renderAmountPills();

        // Custom amount input
        const customInput = document.getElementById('customAmount');
        if (customInput) {
            customInput.addEventListener('input', () => {
                state.customAmount = customInput.value;
                state.amount = null;
                document.querySelectorAll('.amount-pill').forEach(p => p.classList.remove('active'));
            });
        }

        // Form submit
        const giveForm = document.getElementById('giveForm');
        if (giveForm) {
            giveForm.addEventListener('submit', handleSubmit);
        }
    }

    function renderAmountPills() {
        const container = document.getElementById('amountPills');
        if (!container) return;
        const presets = PRESET_AMOUNTS[state.currency] || PRESET_AMOUNTS.KES;
        const sym = CURRENCIES[state.currency]?.symbol || '';

        container.innerHTML = presets.map(amount => `
            <button type="button" class="amount-pill btn btn-outline" data-amount="${amount}"
                onclick="window.selectAmount(${amount})">
                ${sym}${amount.toLocaleString()}
            </button>
        `).join('');
    }

    window.selectAmount = function (amount) {
        state.amount = amount;
        state.customAmount = '';
        const customInput = document.getElementById('customAmount');
        if (customInput) customInput.value = '';
        document.querySelectorAll('.amount-pill').forEach(p => {
            p.classList.toggle('active', parseInt(p.dataset.amount) === amount);
        });
    };

    // ──────────────────────────────────────────────
    // SUBMIT — Initialize Paystack payment
    // ──────────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault();
        const statusDiv = document.getElementById('giveStatus');
        const submitBtn = document.getElementById('giveSubmitBtn');

        const firstName = document.getElementById('giverFirstName').value.trim();
        const lastName = document.getElementById('giverLastName').value.trim();
        const email = document.getElementById('giverEmail').value.trim();
        const customAmount = parseFloat(document.getElementById('customAmount').value);
        const finalAmount = state.amount || customAmount;

        if (!firstName || !email) {
            showStatus(statusDiv, '❌ Please enter your name and email.', 'error');
            return;
        }
        if (!finalAmount || finalAmount < 1) {
            showStatus(statusDiv, '❌ Please select or enter a donation amount.', 'error');
            return;
        }

        submitBtn.textContent = 'Connecting to Paystack...';
        submitBtn.disabled = true;
        if (statusDiv) statusDiv.style.display = 'none';

        try {
            const response = await fetch('/api/pay/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    amount: finalAmount,
                    currency: state.currency,
                    frequency: state.frequency,
                    designation: state.designation,
                }),
            });

            const result = await response.json();

            if (result.success && result.authorization_url) {
                showStatus(statusDiv, '✅ Redirecting to secure payment...', 'success');
                setTimeout(() => {
                    window.location.href = result.authorization_url;
                }, 800);
            } else {
                showStatus(statusDiv, '❌ ' + (result.error || 'Payment initialization failed. Please check your Paystack configuration.'), 'error');
                submitBtn.textContent = 'Give Now';
                submitBtn.disabled = false;
            }
        } catch (err) {
            showStatus(statusDiv, '❌ Network error. Please try again.', 'error');
            submitBtn.textContent = 'Give Now';
            submitBtn.disabled = false;
        }
    }

    function showStatus(el, msg, type) {
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        el.style.color = type === 'success' ? '#0d9488' : '#ef4444';
        el.style.background = type === 'success' ? 'rgba(13,148,136,0.08)' : 'rgba(239,68,68,0.08)';
        el.style.padding = '12px 16px';
        el.style.borderRadius = '8px';
        el.style.marginTop = '16px';
    }

    // ──────────────────────────────────────────────
    // CHECK PAYMENT STATUS (after Paystack redirect)
    // ──────────────────────────────────────────────
    function checkPaymentStatus() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const statusDiv = document.getElementById('giveStatus');

        if (status === 'failed') {
            showStatus(statusDiv, '❌ Your payment was not completed. Please try again.', 'error');
        } else if (status === 'error') {
            showStatus(statusDiv, '❌ An error occurred during payment. Please contact us.', 'error');
        }
    }
})();

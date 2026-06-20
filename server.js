// server.js — KANI Backend (Kingdom Advance Network International)
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const nodemailer = require('nodemailer');
const https = require('https');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SUPABASE CLIENTS
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase, supabaseAdmin;
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase public client initialized');
}
if (supabaseUrl && supabaseServiceKey && supabaseServiceKey !== 'your_supabase_service_role_key_here') {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase admin client initialized');
} else {
    supabaseAdmin = supabase; // Fallback — some operations won't work without service key
    console.warn('⚠️  Supabase service key not set. Using anon client as fallback.');
}

// ============================================================
// EMAIL TRANSPORTER
// ============================================================
let emailTransporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS &&
    process.env.SMTP_USER !== 'your-gmail@gmail.com') {
    emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    console.log('✅ Email transporter initialized');
} else {
    console.warn('⚠️  SMTP credentials not configured. Email notifications disabled.');
}

async function sendAdminEmail(subject, htmlContent) {
    if (!emailTransporter || !process.env.ADMIN_EMAIL) return;
    try {
        await emailTransporter.sendMail({
            from: `"KANI Website" <${process.env.SMTP_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `[KANI] ${subject}`,
            html: htmlContent,
        });
        console.log(`📧 Admin email sent: ${subject}`);
    } catch (err) {
        console.error('Email send failed:', err.message);
    }
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiters
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many auth attempts. Please try again later.' },
});

// Auth middleware — validates Supabase JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) throw new Error('Invalid token');
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
};

// Input validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const sanitize = (str) => (str || '').toString().trim().slice(0, 1000);

// ============================================================
// STATIC FILES
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API ROUTES
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'KANI Backend',
        timestamp: new Date().toISOString(),
        supabase: !!supabase,
        email: !!emailTransporter,
        paystack: !!(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY !== 'your_paystack_secret_key_here'),
    });
});

// ──────────────────────────────────────────────
// Config for Frontend (Realtime)
// ──────────────────────────────────────────────
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
});

// ──────────────────────────────────────────────
// 1. CONTACT FORM
// ──────────────────────────────────────────────
app.post('/api/contact', formLimiter, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const firstName = sanitize(req.body.firstName);
    const lastName = sanitize(req.body.lastName);
    const email = sanitize(req.body.email);
    const subject = sanitize(req.body.subject);
    const message = sanitize(req.body.message);

    if (!firstName || !lastName || !email || !subject || !message) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    try {
        const { error } = await supabaseAdmin
            .from('contacts')
            .insert([{ first_name: firstName, last_name: lastName, email, subject, message }]);
        if (error) throw error;

        // Send admin notification email
        await sendAdminEmail(
            `New Contact Form — ${subject}`,
            `<h2>New message from KANI website</h2>
            <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
                <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${firstName} ${lastName}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Subject</td><td style="padding:8px">${subject}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Message</td><td style="padding:8px">${message.replace(/\n/g, '<br>')}</td></tr>
            </table>`
        );

        res.status(201).json({ success: true, message: 'Message received successfully.' });
    } catch (err) {
        console.error('Contact form error:', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 2. EVENTS
// ──────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const { type } = req.query;
    try {
        let query = supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .order('event_date', { ascending: true });
            
        if (req.query.all_dates !== 'true') {
            query = query.gte('event_date', new Date().toISOString());
        }

        if (type && type !== 'All') {
            query = query.eq('type', type);
        }
        const { data: events, error } = await query;
        if (error) throw error;
        res.status(200).json({ success: true, data: events });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 3. EVENT REGISTRATION
// ──────────────────────────────────────────────
app.post('/api/events/register', formLimiter, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const eventId = sanitize(req.body.eventId);
    const firstName = sanitize(req.body.firstName);
    const lastName = sanitize(req.body.lastName);
    const email = sanitize(req.body.email);
    const phone = sanitize(req.body.phone);

    if (!eventId || !firstName || !lastName || !email) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    try {
        // Get event details
        const { data: event } = await supabaseAdmin.from('events').select('*').eq('id', eventId).single();

        // Check capacity
        if (event && event.capacity) {
            const { count } = await supabaseAdmin.from('registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);
            if (count >= event.capacity) {
                return res.status(400).json({ success: false, error: 'This event is fully booked.' });
            }
        }

        const { error } = await supabaseAdmin
            .from('registrations')
            .insert([{ event_id: eventId, first_name: firstName, last_name: lastName, email, phone }]);

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ success: false, error: 'You are already registered for this event.' });
            }
            throw error;
        }

        // Notify admin
        if (event) {
            await sendAdminEmail(
                `New Event Registration — ${event.title}`,
                `<h2>New registration received</h2>
                <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
                    <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Event</td><td style="padding:8px">${event.title}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${firstName} ${lastName}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px">${email}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${phone || 'Not provided'}</td></tr>
                </table>`
            );
            // Confirmation email to registrant
            await sendConfirmationEmail(
                email,
                `✅ You're registered! — ${event.title}`,
                buildEventConfirmationEmail(firstName, event.title, event.event_date, event.location, event.is_online, event.online_link)
            );
        }

        res.status(201).json({ success: true, message: 'Registration successful! A confirmation has been sent to your email.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 4. AUTHENTICATION
// ──────────────────────────────────────────────
app.post('/api/auth/signup', authLimiter, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const firstName = sanitize(req.body.firstName);
    const lastName = sanitize(req.body.lastName);
    const email = sanitize(req.body.email);
    const password = req.body.password;

    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { first_name: firstName, last_name: lastName } }
        });
        if (error) throw error;

        await sendAdminEmail(
            `New Partner Signup — ${firstName} ${lastName}`,
            `<p>A new partner has signed up: <strong>${firstName} ${lastName}</strong> (${email})</p>`
        );

        res.status(201).json({ success: true, data, message: 'Account created! Please check your email to verify.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    const email = sanitize(req.body.email);
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        res.status(200).json({ success: true, session: data.session, user: data.user });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
});

// ──────────────────────────────────────────────
// 5. PARTNER DASHBOARD DATA
// ──────────────────────────────────────────────

// Get partner profile
app.get('/api/partner/profile', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('partners')
            .select('*')
            .eq('user_id', req.user.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json({ success: true, data: data || { email: req.user.email, first_name: 'Partner', last_name: '' } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get partner's registered events
app.get('/api/partner/events', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('registrations')
            .select('*, events(title, event_date, location, type)')
            .eq('email', req.user.email)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get partner's giving history
app.get('/api/partner/donations', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('donations')
            .select('*')
            .eq('email', req.user.email)
            .eq('paystack_status', 'success')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get partner's prayer requests
app.get('/api/partner/prayers', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('prayer_requests')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 6. PRAYER REQUESTS
// ──────────────────────────────────────────────
app.post('/api/prayer', authenticateToken, formLimiter, async (req, res) => {
    const subject = sanitize(req.body.subject);
    const message = sanitize(req.body.message);
    const isAnonymous = req.body.isAnonymous === true || req.body.isAnonymous === 'true';

    if (!subject || !message) {
        return res.status(400).json({ success: false, error: 'Subject and message are required.' });
    }

    try {
        const { error } = await supabaseAdmin
            .from('prayer_requests')
            .insert([{ user_id: req.user.id, subject, message, is_anonymous: isAnonymous }]);
        if (error) throw error;

        if (!isAnonymous) {
            const name = `${req.user.user_metadata?.first_name || ''} ${req.user.user_metadata?.last_name || ''}`.trim();
            await sendAdminEmail(
                `New Prayer Request — ${subject}`,
                `<h2>New prayer request from partner</h2>
                <p><strong>From:</strong> ${name || req.user.email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>`
            );
        }

        res.status(201).json({ success: true, message: 'Prayer request submitted. Our team will pray for you.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 7. NEWSLETTER
// ──────────────────────────────────────────────
app.post('/api/newsletter', formLimiter, async (req, res) => {
    const email = sanitize(req.body.email);
    const firstName = sanitize(req.body.firstName);

    if (!email || !validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Valid email is required.' });
    }

    try {
        const { error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .upsert([{ email, first_name: firstName, is_active: true }], { onConflict: 'email' });
        if (error) throw error;
        res.status(201).json({ success: true, message: 'You have been subscribed!' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// 8. PAYSTACK — DONATION FLOW
// ──────────────────────────────────────────────

// Helper: Paystack API call
function paystackRequest(method, path, data) {
    return new Promise((resolve, reject) => {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey || secretKey === 'your_paystack_secret_key_here') {
            return reject(new Error('Paystack secret key not configured.'));
        }
        const body = data ? JSON.stringify(data) : null;
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path,
            method,
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
                ...(body && { 'Content-Length': Buffer.byteLength(body) }),
            },
        };
        const req = https.request(options, (r) => {
            let d = '';
            r.on('data', (chunk) => (d += chunk));
            r.on('end', () => {
                try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Initialize payment
app.post('/api/pay/initialize', formLimiter, async (req, res) => {
    const email = sanitize(req.body.email);
    const firstName = sanitize(req.body.firstName);
    const lastName = sanitize(req.body.lastName);
    const amount = parseFloat(req.body.amount);
    const frequency = sanitize(req.body.frequency) || 'one-time';
    const designation = sanitize(req.body.designation) || 'General Fund';
    const currency = sanitize(req.body.currency) || 'KES';

    if (!email || !validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Valid email is required.' });
    }
    if (!amount || amount < 1) {
        return res.status(400).json({ success: false, error: 'Please enter a valid donation amount.' });
    }

    try {
        // Save pending donation record
        const { data: donation, error: dbErr } = await supabaseAdmin
            .from('donations')
            .insert([{
                email, first_name: firstName, last_name: lastName,
                amount, currency, frequency, designation,
                paystack_status: 'pending'
            }])
            .select()
            .single();

        if (dbErr) throw dbErr;

        // Initialize Paystack transaction
        const paystackData = await paystackRequest('POST', '/transaction/initialize', {
            email,
            amount: Math.round(amount * 100), // Paystack uses kobo/cents
            currency,
            callback_url: `${process.env.APP_URL}/api/pay/callback`,
            metadata: {
                donation_id: donation.id,
                first_name: firstName,
                last_name: lastName,
                designation,
                frequency,
                custom_fields: [
                    { display_name: 'Designation', variable_name: 'designation', value: designation },
                    { display_name: 'Frequency', variable_name: 'frequency', value: frequency },
                ],
            },
        });

        if (!paystackData.status) throw new Error(paystackData.message || 'Paystack initialization failed');

        // Save reference to donation
        await supabaseAdmin
            .from('donations')
            .update({ paystack_reference: paystackData.data.reference })
            .eq('id', donation.id);

        res.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference: paystackData.data.reference,
        });
    } catch (err) {
        console.error('Paystack init error:', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// Paystack callback (redirect after payment)
app.get('/api/pay/callback', async (req, res) => {
    const { reference } = req.query;
    if (!reference) return res.redirect('/give.html?status=error');

    try {
        const data = await paystackRequest('GET', `/transaction/verify/${reference}`);

        if (data.status && data.data.status === 'success') {
            const donationId = data.data.metadata?.donation_id;

            // Update donation record
            const updateData = { paystack_status: 'success', paystack_reference: reference };
            await supabaseAdmin.from('donations').update(updateData).eq('paystack_reference', reference);

            // Fetch donation details for email
            const { data: donation } = await supabaseAdmin
                .from('donations').select('*').eq('paystack_reference', reference).single();

            if (donation) {
                const amount = new Intl.NumberFormat('en-KE', { style: 'currency', currency: donation.currency || 'KES' }).format(donation.amount);
                await sendAdminEmail(
                    `Donation Received — ${amount} from ${donation.first_name} ${donation.last_name}`,
                    `<h2>✅ Donation Confirmed</h2>
                    <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Donor</td><td style="padding:8px">${donation.first_name} ${donation.last_name}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px">${donation.email}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Amount</td><td style="padding:8px">${amount}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Designation</td><td style="padding:8px">${donation.designation}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Frequency</td><td style="padding:8px">${donation.frequency}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Reference</td><td style="padding:8px">${reference}</td></tr>
                    </table>`
                );
            }

            // Send donation receipt to donor
            if (donation) {
                await sendConfirmationEmail(
                    donation.email,
                    `💛 Thank you for your gift to KANI — Receipt inside`,
                    buildDonationReceiptEmail(
                        donation.first_name,
                        donation.amount,
                        donation.currency,
                        donation.designation,
                        donation.frequency,
                        reference
                    )
                );
            }

            res.redirect(`/give-success.html?ref=${reference}&amount=${donation?.amount || ''}&currency=${donation?.currency || 'KES'}`);
        } else {
            await supabaseAdmin.from('donations').update({ paystack_status: 'failed' }).eq('paystack_reference', reference);
            res.redirect('/give.html?status=failed');
        }
    } catch (err) {
        console.error('Paystack callback error:', err.message);
        res.redirect('/give.html?status=error');
    }
});

// Verify payment (called from frontend)
app.get('/api/pay/verify/:reference', async (req, res) => {
    const { reference } = req.params;
    try {
        const data = await paystackRequest('GET', `/transaction/verify/${reference}`);
        res.json({ success: data.status, data: data.data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});


// ──────────────────────────────────────────────
// 9. ADMIN PANEL
// ──────────────────────────────────────────────

// Admin auth middleware
const authenticateAdmin = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || !token || token !== adminToken) {
        return res.status(401).json({ error: 'Admin access required. Check your admin token.' });
    }
    next();
};

// Admin login
app.post('/api/admin/login', authLimiter, (req, res) => {
    const { token } = req.body;
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured in .env' });
    if (token === adminToken) {
        res.json({ success: true, token, message: 'Admin access granted.' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid admin token.' });
    }
});

// Admin settings (Get)
app.get('/api/admin/settings', authenticateAdmin, (req, res) => {
    res.json({
        success: true,
        data: {
            adminEmail: process.env.ADMIN_EMAIL || '',
            adminToken: process.env.ADMIN_TOKEN || ''
        }
    });
});

// Admin settings (Update)
app.put('/api/admin/settings', authenticateAdmin, (req, res) => {
    const { adminEmail, adminToken } = req.body;
    if (!adminEmail || !adminToken) {
        return res.status(400).json({ success: false, error: 'Email and Token are required' });
    }
    
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            
            // Update values using regex
            if (/^ADMIN_TOKEN=/m.test(envContent)) {
                envContent = envContent.replace(/^ADMIN_TOKEN=.*$/m, `ADMIN_TOKEN=${adminToken}`);
            } else {
                envContent += `\nADMIN_TOKEN=${adminToken}`;
            }
            
            if (/^ADMIN_EMAIL=/m.test(envContent)) {
                envContent = envContent.replace(/^ADMIN_EMAIL=.*$/m, `ADMIN_EMAIL=${adminEmail}`);
            } else {
                envContent += `\nADMIN_EMAIL=${adminEmail}`;
            }
            
            fs.writeFileSync(envPath, envContent);
        }
        
        // Update in memory so server doesn't need to restart
        process.env.ADMIN_TOKEN = adminToken;
        process.env.ADMIN_EMAIL = adminEmail;
        
        res.json({ success: true, message: 'Settings updated successfully. Please log in again with your new token.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update settings file: ' + err.message });
    }
});

// Admin stats overview
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const [contacts, events, registrations, donations, newsletter, partners, prayers] = await Promise.all([
            supabaseAdmin.from('contacts').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('events').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('registrations').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('donations').select('amount, paystack_status').eq('paystack_status', 'success'),
            supabaseAdmin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('prayer_requests').select('*', { count: 'exact', head: true }),
        ]);

        const totalDonations = (donations.data || []).reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

        res.json({
            success: true,
            stats: {
                contacts: contacts.count || 0,
                events: events.count || 0,
                registrations: registrations.count || 0,
                donations: donations.data?.length || 0,
                totalDonations,
                newsletter: newsletter.count || 0,
                partners: partners.count || 0,
                prayers: prayers.count || 0,
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get all contacts
app.get('/api/admin/contacts', authenticateAdmin, async (req, res) => {
    const { status } = req.query;
    try {
        let query = supabaseAdmin.from('contacts').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: update contact status
app.patch('/api/admin/contacts/:id', authenticateAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const { error } = await supabaseAdmin.from('contacts').update({ status }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get all prayer requests
app.get('/api/admin/prayers', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('prayer_requests')
            .select('*, partners(first_name, last_name, email)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: update prayer status
app.patch('/api/admin/prayers/:id', authenticateAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const { error } = await supabaseAdmin.from('prayer_requests').update({ status }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get all events (including inactive)
app.get('/api/admin/events', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('events')
            .select('*')
            .order('event_date', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: create event
app.post('/api/admin/events', authenticateAdmin, async (req, res) => {
    const { title, description, event_date, end_date, location, type, capacity, is_online, online_link, latitude, longitude, social_platforms } = req.body;
    if (!title || !event_date || !location || !type) {
        return res.status(400).json({ success: false, error: 'Title, date, location, and type are required.' });
    }
    try {
        const { data, error } = await supabaseAdmin
            .from('events')
            .insert([{ 
                title: sanitize(title), 
                description: sanitize(description), 
                event_date, 
                end_date: end_date || null, 
                location: sanitize(location), 
                type: sanitize(type), 
                capacity: capacity ? parseInt(capacity) : null, 
                is_online: !!is_online, 
                online_link: sanitize(online_link), 
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                social_platforms: Array.isArray(social_platforms) ? social_platforms : [],
                is_active: true 
            }])
            .select().single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: update event
app.put('/api/admin/events/:id', authenticateAdmin, async (req, res) => {
    const { title, description, event_date, end_date, location, type, capacity, is_online, online_link, is_active, latitude, longitude, social_platforms } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from('events')
            .update({ 
                title: sanitize(title), 
                description: sanitize(description), 
                event_date, 
                end_date: end_date || null, 
                location: sanitize(location), 
                type: sanitize(type), 
                capacity: capacity ? parseInt(capacity) : null, 
                is_online: !!is_online, 
                online_link: sanitize(online_link), 
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                social_platforms: Array.isArray(social_platforms) ? social_platforms : [],
                is_active: is_active !== undefined ? is_active : true 
            })
            .eq('id', req.params.id)
            .select().single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// TEACHINGS & BLOGS
// ──────────────────────────────────────────────

// Public: Get published blogs
app.get('/api/blogs', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });
    try {
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: Get all blogs
app.get('/api/admin/blogs', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: Create blog
app.post('/api/admin/blogs', authenticateAdmin, async (req, res) => {
    const { title, content, author, image_url, is_published } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required.' });
    }
    try {
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .insert([{ 
                title: sanitize(title), 
                content, 
                author: sanitize(author) || 'Admin', 
                image_url: sanitize(image_url), 
                is_published: is_published !== undefined ? !!is_published : true 
            }])
            .select().single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: Update blog
app.put('/api/admin/blogs/:id', authenticateAdmin, async (req, res) => {
    const { title, content, author, image_url, is_published } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from('blogs')
            .update({ 
                title: sanitize(title), 
                content, 
                author: sanitize(author), 
                image_url: sanitize(image_url), 
                is_published: !!is_published,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select().single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: Delete blog
app.delete('/api/admin/blogs/:id', authenticateAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin.from('blogs').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Blog deleted.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: delete (deactivate) event
app.delete('/api/admin/events/:id', authenticateAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin.from('events').update({ is_active: false }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Event deactivated.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get registrations for an event
app.get('/api/admin/registrations', authenticateAdmin, async (req, res) => {
    const { event_id } = req.query;
    try {
        let query = supabaseAdmin
            .from('registrations')
            .select('*, events(title, event_date)')
            .order('created_at', { ascending: false });
        if (event_id) query = query.eq('event_id', event_id);
        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get all donations
app.get('/api/admin/donations', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('donations')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get newsletter subscribers
app.get('/api/admin/newsletter', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('*')
            .order('subscribed_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin: get all partners
app.get('/api/admin/partners', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('partners')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ──────────────────────────────────────────────
// EMAIL HELPERS
// ──────────────────────────────────────────────
async function sendConfirmationEmail(to, subject, htmlContent) {
    if (!emailTransporter) return;
    try {
        await emailTransporter.sendMail({
            from: `"KANI — Kingdom Advance Network" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html: htmlContent,
        });
        console.log(`📧 Confirmation email sent to: ${to}`);
    } catch (err) {
        console.error('Confirmation email failed:', err.message);
    }
}

function buildEventConfirmationEmail(firstName, eventTitle, eventDate, location, isOnline, onlineLink) {
    const formattedDate = new Date(eventDate).toLocaleDateString('en-KE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const formattedTime = new Date(eventDate).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0d1a2f;border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d1a2f 0%,#1a2a4a 100%);padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(245,158,11,0.2);">
      <div style="font-size:2rem;font-weight:900;color:#f59e0b;letter-spacing:2px;font-family:Georgia,serif;">KANI</div>
      <div style="color:rgba(255,255,255,0.5);font-size:0.8rem;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Kingdom Advance Network International</div>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      <div style="background:linear-gradient(135deg,#10b981,#059669);width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;text-align:center;font-size:1.8rem;line-height:56px;">✅</div>
      <h1 style="color:#fff;font-family:Georgia,serif;font-size:1.6rem;text-align:center;margin:0 0 8px;">You're Registered!</h1>
      <p style="color:rgba(255,255,255,0.7);text-align:center;margin:0 0 32px;">Hi ${firstName}, your spot is confirmed.</p>

      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
        <h2 style="color:#f59e0b;font-family:Georgia,serif;font-size:1.2rem;margin:0 0 16px;">📌 Event Details</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:6px 0;width:35%;">Event</td><td style="color:#fff;font-weight:600;padding:6px 0;">${eventTitle}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:6px 0;">Date</td><td style="color:#fff;padding:6px 0;">${formattedDate}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:6px 0;">Time</td><td style="color:#fff;padding:6px 0;">${formattedTime}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:6px 0;">Location</td><td style="color:#fff;padding:6px 0;">${location}</td></tr>
          ${isOnline && onlineLink ? `<tr><td style="color:rgba(255,255,255,0.5);font-size:0.85rem;padding:6px 0;">Online Link</td><td style="padding:6px 0;"><a href="${onlineLink}" style="color:#38bdf8;">${onlineLink}</a></td></tr>` : ''}
        </table>
      </div>

      <p style="color:rgba(255,255,255,0.6);font-size:0.9rem;line-height:1.7;margin-bottom:28px;">
        We look forward to seeing you! Our prayer team will be covering this event. Please share this with others who may want to attend.
      </p>

      <div style="text-align:center;">
        <a href="https://kaniglobal.org/events.html" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:0.95rem;">View All Events</a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:rgba(0,0,0,0.3);padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.3);font-size:0.8rem;margin:0;">Kingdom Advance Network International · Nairobi, Kenya</p>
      <p style="color:rgba(255,255,255,0.2);font-size:0.75rem;margin:4px 0 0;">This confirmation was sent to you because you registered for a KANI event.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildDonationReceiptEmail(firstName, amount, currency, designation, frequency, reference) {
    const formatted = new Intl.NumberFormat('en-KE', { style: 'currency', currency: currency || 'KES' }).format(amount);
    const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0d1a2f;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0d1a2f 0%,#1a2a4a 100%);padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(245,158,11,0.2);">
      <div style="font-size:2rem;font-weight:900;color:#f59e0b;letter-spacing:2px;font-family:Georgia,serif;">KANI</div>
      <div style="color:rgba(255,255,255,0.5);font-size:0.8rem;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Kingdom Advance Network International</div>
    </div>
    <div style="padding:40px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:3rem;margin-bottom:12px;">🙏</div>
        <h1 style="color:#fff;font-family:Georgia,serif;font-size:1.6rem;margin:0 0 8px;">Thank You, ${firstName}!</h1>
        <p style="color:rgba(255,255,255,0.6);margin:0;font-size:0.95rem;">Your generous gift has been received.</p>
      </div>

      <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:28px;margin-bottom:28px;text-align:center;">
        <div style="color:rgba(255,255,255,0.5);font-size:0.85rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Donation Amount</div>
        <div style="color:#f59e0b;font-family:Georgia,serif;font-size:2.5rem;font-weight:900;">${formatted}</div>
        <div style="color:rgba(255,255,255,0.4);font-size:0.85rem;margin-top:6px;text-transform:capitalize;">${frequency}</div>
      </div>

      <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:20px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Designation</td><td style="color:#fff;text-align:right;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${designation}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Date</td><td style="color:#fff;text-align:right;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${dateStr}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:7px 0;">Reference</td><td style="color:#fff;text-align:right;padding:7px 0;font-family:monospace;font-size:0.8rem;">${reference}</td></tr>
        </table>
      </div>

      <blockquote style="border-left:3px solid #f59e0b;margin:0 0 28px;padding:12px 20px;background:rgba(245,158,11,0.05);border-radius:0 8px 8px 0;">
        <p style="color:rgba(255,255,255,0.7);font-style:italic;margin:0;line-height:1.7;">"He who sows bountifully will also reap bountifully." — 2 Corinthians 9:6</p>
      </blockquote>

      <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;line-height:1.7;margin-bottom:24px;">
        Your gift goes directly toward advancing the Kingdom of God — funding prayer networks, equipping leaders, and reaching the nations with the Gospel. Please keep this email as your giving receipt.
      </p>

      <div style="text-align:center;">
        <a href="https://kaniglobal.org/give.html" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:0.95rem;">Give Again</a>
      </div>
    </div>
    <div style="background:rgba(0,0,0,0.3);padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.3);font-size:0.8rem;margin:0;">Kingdom Advance Network International · Nairobi, Kenya</p>
      <p style="color:rgba(255,255,255,0.2);font-size:0.75rem;margin:4px 0 0;">This is your official donation receipt. Reference: ${reference}</p>
    </div>
  </div>
</body>
</html>`;
}

// ──────────────────────────────────────────────
// FALLBACK — Serve HTML pages
// ──────────────────────────────────────────────
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    const pageName = req.path === '/' ? 'index' : req.path.replace(/^\//, '').replace(/\.html$/, '');
    const filePath = path.join(__dirname, 'public', `${pageName}.html`);
    res.sendFile(filePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🚀 KANI Server running at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Admin panel:  http://localhost:${PORT}/admin.html\n`);
});


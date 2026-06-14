const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️ Supabase credentials missing. API routes requiring DB will fail.');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API ROUTES
// ==========================================

// 1. Contact / Prayer Request Submission
app.post('/api/contact', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { firstName, lastName, email, subject, message } = req.body;

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([
        { first_name: firstName, last_name: lastName, email, subject, message }
      ]);

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Message received successfully.' });
  } catch (error) {
    console.error('Error saving contact:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Fetch Events
app.get('/api/events', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. Event Registration
app.post('/api/events/register', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { eventId, firstName, lastName, email } = req.body;

  try {
    const { data, error } = await supabase
      .from('registrations')
      .insert([
        { event_id: eventId, first_name: firstName, last_name: lastName, email }
      ]);

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Registration successful!' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Partner Authentication (Sign Up)
app.post('/api/auth/signup', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { email, password, firstName, lastName } = req.body;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName }
      }
    });
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5. Partner Authentication (Login)
app.post('/api/auth/login', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.status(200).json({ success: true, session: data.session });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// Fallback to index.html for unknown routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 KANI Server running on http://localhost:${PORT}`);
});

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper to read JSON files safely
const readJSON = (filename) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, filename), 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

// Helper to write to JSON files safely
const writeJSON = (filename, data) => {
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
};

// POST: Authenticate Officer Email
app.post('/api/auth', (req, res) => {
  const { email } = req.body;
  const authorizedEmails = readJSON('officers.json');
  
  const isAuthorized = authorizedEmails.some(
    (officerEmail) => officerEmail.toLowerCase() === email.toLowerCase()
  );

  if (isAuthorized) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Email not recognized as an officer.' });
  }
});

// GET: Fetch all HOSA events
app.get('/api/events', (req, res) => {
  const events = readJSON('custom_events.json');
  res.json(events);
});

// POST: Add a new custom event (Officer Portal)
app.post('/api/events', (req, res) => {
  const newEvent = req.body;
  const events = readJSON('custom_events.json');
  events.push(newEvent);
  writeJSON('custom_events.json', events);
  res.json({ success: true, event: newEvent });
});

// POST: Handle standard signups
app.post('/api/signups', (req, res) => {
  const entry = req.body;
  const db = readJSON('signups.json');
  db.push(entry);
  writeJSON('signups.json', db);
  res.json({ success: true });
});

// POST: Handle presubmissions
app.post('/api/presubmissions', (req, res) => {
  const entry = req.body;
  const db = readJSON('presubmissions.json');
  db.push(entry);
  writeJSON('presubmissions.json', db);
  res.json({ success: true });
});

// POST: Handle runoffs
app.post('/api/runoffs', (req, res) => {
  const entry = req.body;
  const db = readJSON('runoffs.json');
  db.push(entry);
  writeJSON('runoffs.json', db);
  res.json({ success: true });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

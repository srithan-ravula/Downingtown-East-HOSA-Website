const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const initDB = (filename, defaultData = []) => {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2));
  return filepath;
};

const DB_SIGNUPS = initDB('signups.json', []);
const DB_ANNOUNCEMENTS = initDB('announcements.json', [
  { id: 1, title: "Welcome to D-East HOSA", date: "2026-09-12", message: "Ensure your Google account is linked to submit your event registration.", type: "system" }
]);
const DB_DATES = initDB('dates.json', [
  { id: 1, title: "Chapter Registration Deadline", date: "October 15, 2026", description: "All members must have their primary competitive event selected in the portal." },
  { id: 2, title: "State Qualification Testing", date: "December 1 - 15, 2026", description: "Online testing window for selected health science events." },
  { id: 3, title: "State Leadership Conference (SLC)", date: "March 24 - 26, 2027", description: "In-person state competition and leadership seminars." }
]);
const DB_MEETINGS = initDB('meetings.json', [
  { id: 1, topic: "Intro to Competitive Events", date: "Sept 18, 2026 - 3:30 PM", location: "Room 402 / Main Lecture Hall", status: "Upcoming" },
  { id: 2, topic: "Guest Speaker: ER Physician", date: "Oct 2, 2026 - 3:30 PM", location: "Auditorium", status: "Upcoming" },
  { id: 3, topic: "Competition Study & Prep Session", date: "Oct 16, 2026 - 3:30 PM", location: "Library Media Center", status: "Upcoming" }
]);
const DB_CUSTOM_EVENTS = initDB('custom_events.json', []);

const UNIVERSAL_GUIDELINE_URL = "https://hosa.org/guidelines/";

function getNormalizedEvents() {
  try {
    let list = [];
    const eventsFilePath = path.join(__dirname, 'hosa-events.json');
    if (fs.existsSync(eventsFilePath)) {
      const rawData = JSON.parse(fs.readFileSync(eventsFilePath));
      const eventsObj = rawData.hosa_events || {};
      const categoryConfig = {
        health_science_events: { name: "Health Science", prefix: "HS", team: "Individual" },
        health_professions_events: { name: "Health Professions", prefix: "HP", team: "Individual" },
        emergency_preparedness_events: { name: "Emergency Preparedness", prefix: "EP", team: "Indiv/Team" },
        leadership_events: { name: "Leadership", prefix: "LE", team: "Individual" },
        teamwork_events: { name: "Teamwork", prefix: "TW", team: "Team" },
        recognition_events: { name: "Recognition", prefix: "RE", team: "Individual" },
        academic_testing_center_ATC: { name: "National ATC", prefix: "ATC", team: "Individual" }
      };

      Object.keys(eventsObj).forEach((catKey) => {
        const config = categoryConfig[catKey] || { name: catKey, prefix: "GEN", team: "Individual" };
        eventsObj[catKey].forEach((eventName, idx) => {
          list.push({
            id: `${config.prefix}-${String(idx + 1).padStart(2, '0')}`,
            name: eventName,
            category: config.name,
            team: config.team,
            url: UNIVERSAL_GUIDELINE_URL,
            isCustom: false
          });
        });
      });
    }

    const customEvents = JSON.parse(fs.readFileSync(DB_CUSTOM_EVENTS));
    return [...list, ...customEvents];
  } catch (e) {
    return [];
  }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/events', (req, res) => res.json(getNormalizedEvents()));
app.get('/api/announcements', (req, res) => res.json(JSON.parse(fs.readFileSync(DB_ANNOUNCEMENTS))));
app.get('/api/dates', (req, res) => res.json(JSON.parse(fs.readFileSync(DB_DATES))));
app.get('/api/meetings', (req, res) => res.json(JSON.parse(fs.readFileSync(DB_MEETINGS))));
app.get('/api/signups', (req, res) => res.json(JSON.parse(fs.readFileSync(DB_SIGNUPS))));

app.post('/api/register', (req, res) => {
  const { userEmail, userName, eventId, eventName } = req.body;
  if (!userEmail || !eventId) return res.status(400).json({ error: "Missing required fields." });

  const signups = JSON.parse(fs.readFileSync(DB_SIGNUPS));
  const existing = signups.findIndex(s => s.userEmail === userEmail);
  const record = { 
    id: Date.now(), 
    userEmail, 
    userName, 
    eventId, 
    eventName, 
    duesPaid: existing !== -1 ? signups[existing].duesPaid : false,
    preSubmitted: existing !== -1 ? signups[existing].preSubmitted : false,
    timestamp: new Date().toISOString() 
  };

  if (existing !== -1) signups[existing] = { ...signups[existing], ...record, id: signups[existing].id };
  else signups.push(record);

  fs.writeFileSync(DB_SIGNUPS, JSON.stringify(signups, null, 2));
  res.json({ success: true, data: record });
});

app.post('/api/events', (req, res) => {
  const { name, category, team, url } = req.body;
  if (!name || !category) return res.status(400).json({ error: "Name and category required." });
  const customEvents = JSON.parse(fs.readFileSync(DB_CUSTOM_EVENTS));
  const newEvent = {
    id: `CUST-${Date.now()}`,
    name,
    category,
    team: team || "Individual",
    url: url || UNIVERSAL_GUIDELINE_URL,
    isCustom: true
  };
  customEvents.push(newEvent);
  fs.writeFileSync(DB_CUSTOM_EVENTS, JSON.stringify(customEvents, null, 2));
  res.json({ success: true, data: getNormalizedEvents() });
});

app.delete('/api/events/:id', (req, res) => {
  const eventId = req.params.id;
  let customEvents = JSON.parse(fs.readFileSync(DB_CUSTOM_EVENTS));
  customEvents = customEvents.filter(e => e.id !== eventId);
  fs.writeFileSync(DB_CUSTOM_EVENTS, JSON.stringify(customEvents, null, 2));
  res.json({ success: true, data: getNormalizedEvents() });
});

app.put('/api/signups/:id', (req, res) => {
  const signupId = Number(req.params.id);
  const { duesPaid, preSubmitted, eventId, eventName } = req.body;
  const signups = JSON.parse(fs.readFileSync(DB_SIGNUPS));
  const idx = signups.findIndex(s => s.id === signupId);
  if (idx === -1) return res.status(404).json({ error: "Signup not found." });

  if (duesPaid !== undefined) signups[idx].duesPaid = Boolean(duesPaid);
  if (preSubmitted !== undefined) signups[idx].preSubmitted = Boolean(preSubmitted);
  if (eventId) {
    signups[idx].eventId = eventId;
    signups[idx].eventName = eventName;
  }

  fs.writeFileSync(DB_SIGNUPS, JSON.stringify(signups, null, 2));
  res.json({ success: true, data: signups[idx] });
});

app.delete('/api/signups/:id', (req, res) => {
  const signupId = Number(req.params.id);
  let signups = JSON.parse(fs.readFileSync(DB_SIGNUPS));
  signups = signups.filter(s => s.id !== signupId);
  fs.writeFileSync(DB_SIGNUPS, JSON.stringify(signups, null, 2));
  res.json({ success: true, data: signups });
});

app.post('/api/announcements', (req, res) => {
  const { title, message, date } = req.body;
  const announcements = JSON.parse(fs.readFileSync(DB_ANNOUNCEMENTS));
  announcements.unshift({ id: Date.now(), title, message, date: date || new Date().toISOString().split('T')[0] });
  fs.writeFileSync(DB_ANNOUNCEMENTS, JSON.stringify(announcements, null, 2));
  res.json({ success: true, data: announcements });
});
app.delete('/api/announcements/:id', (req, res) => {
  let announcements = JSON.parse(fs.readFileSync(DB_ANNOUNCEMENTS));
  announcements = announcements.filter(a => a.id !== Number(req.params.id));
  fs.writeFileSync(DB_ANNOUNCEMENTS, JSON.stringify(announcements, null, 2));
  res.json({ success: true, data: announcements });
});

app.post('/api/dates', (req, res) => {
  const { title, date, description } = req.body;
  const dates = JSON.parse(fs.readFileSync(DB_DATES));
  dates.push({ id: Date.now(), title, date, description });
  fs.writeFileSync(DB_DATES, JSON.stringify(dates, null, 2));
  res.json({ success: true, data: dates });
});
app.delete('/api/dates/:id', (req, res) => {
  let dates = JSON.parse(fs.readFileSync(DB_DATES));
  dates = dates.filter(d => d.id !== Number(req.params.id));
  fs.writeFileSync(DB_DATES, JSON.stringify(dates, null, 2));
  res.json({ success: true, data: dates });
});

app.post('/api/meetings', (req, res) => {
  const { topic, date, location, status } = req.body;
  const meetings = JSON.parse(fs.readFileSync(DB_MEETINGS));
  meetings.push({ id: Date.now(), topic, date, location, status: status || "Upcoming" });
  fs.writeFileSync(DB_MEETINGS, JSON.stringify(meetings, null, 2));
  res.json({ success: true, data: meetings });
});
app.delete('/api/meetings/:id', (req, res) => {
  let meetings = JSON.parse(fs.readFileSync(DB_MEETINGS));
  meetings = meetings.filter(m => m.id !== Number(req.params.id));
  fs.writeFileSync(DB_MEETINGS, JSON.stringify(meetings, null, 2));
  res.json({ success: true, data: meetings });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] D-East Portal active on http://localhost:${PORT}`));
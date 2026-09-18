let globalEvents = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const res = await fetch('/api/events');
    const events = await res.json();
    globalEvents = events;

    renderEventTable();
    renderEventDropdown();
  } catch (error) {
    console.error("Failed to load events:", error);
    document.getElementById('eventSelect').innerHTML = `<option value="">Error loading events. Check server.</option>`;
  }
}

function renderEventTable() {
  const tbody = document.getElementById('event-table-body');
  tbody.innerHTML = ''; 

  globalEvents.forEach(evt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${evt.name}</td>
      <td>${evt.category || 'N/A'}</td>
      <td>${evt.team || 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEventDropdown() {
  const select = document.getElementById('eventSelect');
  select.innerHTML = '<option value="">-- Choose an Event --</option>';

  globalEvents.forEach(evt => {
    const option = document.createElement('option');
    option.value = evt.name;
    option.textContent = evt.name;
    select.appendChild(option);
  });
}

function showSection(sectionId) {
  document.querySelectorAll('main section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`${sectionId}-section`).classList.add('active');
}

// Officer Login Authentication
document.getElementById('officer-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const emailInput = document.getElementById('officer-email').value;
  const loginMessage = document.getElementById('login-message');

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput })
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('officer-login-view').style.display = 'none';
      document.getElementById('officer-dashboard-view').style.display = 'block';
    } else {
      loginMessage.style.color = 'red';
      loginMessage.textContent = '❌ ' + data.message;
    }
  } catch (error) {
    loginMessage.style.color = 'red';
    loginMessage.textContent = '❌ Server error. Try again.';
  }
});

// Student Registration Form
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const studentName = document.getElementById('studentName').value;
  const grade = document.getElementById('studentGrade').value;
  const eventName = document.getElementById('eventSelect').value;
  const submissionType = document.getElementById('submissionType').value;

  const payload = {
    name: studentName,
    grade: grade,
    event: eventName,
    date: new Date().toISOString()
  };

  try {
    const res = await fetch(`/api/${submissionType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (data.success) {
      document.getElementById('form-message').style.color = 'green';
      document.getElementById('form-message').textContent = '✅ Registration successful!';
      document.getElementById('signup-form').reset();
    }
  } catch (error) {
    document.getElementById('form-message').style.color = 'red';
    document.getElementById('form-message').textContent = '❌ Failed to connect to server.';
  }
});

// Officer Add Event Form
document.getElementById('officer-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    id: `evt_custom_${Date.now()}`,
    name: document.getElementById('new-evt-name').value,
    category: document.getElementById('new-evt-category').value,
    team: document.getElementById('new-evt-team').value,
  };

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('officer-message').style.color = 'green';
      document.getElementById('officer-message').textContent = '✅ Event added! Refreshing list...';
      document.getElementById('officer-form').reset();
      init(); 
    }
  } catch (error) {
    document.getElementById('officer-message').style.color = 'red';
    document.getElementById('officer-message').textContent = '❌ Failed to add event.';
  }
});

// ---------- storage ----------
const STORAGE_KEY = 'taskTracker.tasks';
const SETTINGS_KEY = 'taskTracker.settings';

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

let tasks = loadTasks();
let settings = loadSettings();
let filters = { category: 'all', status: 'all', search: '' };

// ---------- tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'agenda') renderAgenda();
  });
});

// ---------- task CRUD ----------
function addTask(data) {
  const isMeeting = data.category === 'Meeting';
  const task = {
    id: crypto.randomUUID(),
    title: data.title,
    category: data.category,
    priority: data.priority,
    dueDate: data.dueDate || null,
    projectPath: data.projectPath || '',
    notes: data.notes || '',
    status: 'todo',
    meetingTime: isMeeting ? (data.meetingTime || null) : null,
    durationMinutes: isMeeting && data.durationMinutes ? Number(data.durationMinutes) : null,
    participants: isMeeting ? (data.participants || '') : '',
    calendarEventId: null,
    createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks();
  renderTasks();
  if (task.dueDate) syncTaskToCalendar(task);
  buddySay(pick(['New quest logged!', 'Task caught!', "Let's go, trainer!"]));
}

function updateTask(id, patch) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const dueDateChanged = 'dueDate' in patch && patch.dueDate !== task.dueDate;
  const justCompleted = patch.status === 'done' && task.status !== 'done';
  Object.assign(task, patch);
  saveTasks();
  renderTasks();
  if (dueDateChanged) syncTaskToCalendar(task);
  if (justCompleted) buddyCelebrate();
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm('Delete "' + task.title + '"?')) return;
  if (task.calendarEventId) deleteCalendarEvent(task.calendarEventId);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

// ---------- rendering ----------
function projectLink(path) {
  if (!path) return '';
  let href = path;
  if (/^https?:\/\//i.test(path)) {
    // already a url
  } else {
    href = 'file:///' + path.replace(/\\/g, '/').replace(/^\/+/, '');
  }
  return `<div class="task-project"><a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtml(path)}</a></div>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

const PRIORITY_EMOJI = { low: '🟢', medium: '🟡', high: '🔴' };
const CATEGORY_CLASS = { Personal: 'personal', Learning: 'learning', Company: 'company', Meeting: 'meeting' };
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function renderTasks() {
  const list = document.getElementById('task-list');
  const q = filters.search.trim().toLowerCase();
  const filtered = tasks.filter(t => {
    if (filters.category !== 'all' && t.category !== filters.category) return false;
    if (filters.status !== 'all' && t.status !== filters.status) return false;
    if (q && !(t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : b.status === 'done' ? -1 : 0;
    if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return b.createdAt - a.createdAt;
  });

  list.innerHTML = filtered.map(t => `
    <div class="task-item ${t.status === 'done' ? 'done' : ''}" data-category="${t.category}">
      <div class="task-top">
        <div class="task-title-group">
          <svg class="icon-category ${CATEGORY_CLASS[t.category]}" width="22" height="22"><use href="#icon-blob"/></svg>
          <span class="task-title">${escapeHtml(t.title)}</span>
        </div>
        <div class="task-actions">
          <select data-action="status" data-id="${t.id}">
            <option value="todo" ${t.status==='todo'?'selected':''}>To do</option>
            <option value="doing" ${t.status==='doing'?'selected':''}>Doing</option>
            <option value="done" ${t.status==='done'?'selected':''}>Done</option>
          </select>
          <button data-action="delete" data-id="${t.id}">Release</button>
        </div>
      </div>
      <div class="task-meta">
        <span class="badge">${t.category}</span>
        <span class="badge">${PRIORITY_EMOJI[t.priority]} ${t.priority}</span>
        ${t.dueDate ? `<span class="badge">Due ${t.dueDate}</span>` : ''}
        ${t.meetingTime ? `<span class="badge">🕒 ${t.meetingTime}${t.durationMinutes ? ' (' + t.durationMinutes + 'm)' : ''}</span>` : ''}
        ${t.calendarEventId ? `<span class="badge">📅 synced</span>` : ''}
      </div>
      ${t.participants ? `<div class="task-notes">👥 ${escapeHtml(t.participants)}</div>` : ''}
      ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
      ${projectLink(t.projectPath)}
    </div>
  `).join('') || '<p class="hint">No tasks match the current filters. Go explore!</p>';

  list.querySelectorAll('[data-action="status"]').forEach(el => {
    el.addEventListener('change', () => updateTask(el.dataset.id, { status: el.value }));
  });
  list.querySelectorAll('[data-action="delete"]').forEach(el => {
    el.addEventListener('click', () => deleteTask(el.dataset.id));
  });
}

// ---------- form ----------
function toggleMeetingFields() {
  const isMeeting = document.getElementById('f-category').value === 'Meeting';
  document.getElementById('meeting-fields').classList.toggle('hidden', !isMeeting);
}
document.getElementById('f-category').addEventListener('change', toggleMeetingFields);

document.getElementById('task-form').addEventListener('submit', e => {
  e.preventDefault();
  addTask({
    title: document.getElementById('f-title').value.trim(),
    category: document.getElementById('f-category').value,
    priority: document.getElementById('f-priority').value,
    dueDate: document.getElementById('f-due').value,
    projectPath: document.getElementById('f-project').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    meetingTime: document.getElementById('f-time').value,
    durationMinutes: document.getElementById('f-duration').value,
    participants: document.getElementById('f-participants').value.trim()
  });
  e.target.reset();
  document.getElementById('f-priority').value = 'medium';
  toggleMeetingFields();
});

// ---------- filters ----------
function wireChipGroup(containerId, key) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filters[key] = chip.dataset.value;
      renderTasks();
    });
  });
}
wireChipGroup('filter-category', 'category');
wireChipGroup('filter-status', 'status');
document.getElementById('search').addEventListener('input', e => {
  filters.search = e.target.value;
  renderTasks();
});

// ---------- settings ----------
document.getElementById('s-client-id').value = settings.clientId || '';
document.getElementById('btn-save-client-id').addEventListener('click', () => {
  settings.clientId = document.getElementById('s-client-id').value.trim();
  saveSettings();
  alert('Saved. Go to the Agenda tab and click "Connect Google Calendar".');
});

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('not an array');
      tasks = imported;
      saveTasks();
      renderTasks();
      alert('Imported ' + imported.length + ' tasks.');
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Delete ALL tasks? This cannot be undone.')) return;
  tasks = [];
  saveTasks();
  renderTasks();
});

// ---------- Google Calendar ----------
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
let tokenClient = null;
let accessToken = null;

function initGoogleClient() {
  if (!settings.clientId || !window.google) return false;
  if (tokenClient) return true;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: settings.clientId,
    scope: CAL_SCOPE,
    callback: (resp) => {
      if (resp.error) { setCalStatus('Auth failed: ' + resp.error); return; }
      accessToken = resp.access_token;
      setCalStatus('Connected');
      document.getElementById('btn-connect-cal').classList.add('hidden');
      document.getElementById('btn-disconnect-cal').classList.remove('hidden');
      renderAgenda();
    }
  });
  return true;
}

function setCalStatus(msg) { document.getElementById('cal-status').textContent = msg; }

document.getElementById('btn-connect-cal').addEventListener('click', () => {
  if (!settings.clientId) {
    alert('Add your Google OAuth Client ID in Settings first.');
    return;
  }
  if (!initGoogleClient()) { alert('Google library not loaded yet, try again in a moment.'); return; }
  tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
});

document.getElementById('btn-disconnect-cal').addEventListener('click', () => {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  setCalStatus('Disconnected');
  document.getElementById('btn-connect-cal').classList.remove('hidden');
  document.getElementById('btn-disconnect-cal').classList.add('hidden');
  renderAgenda();
});

document.getElementById('btn-refresh-agenda').addEventListener('click', renderAgenda);

async function gcalFetch(path, options = {}) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/' + path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Calendar API error ' + res.status);
  if (res.status === 204) return null;
  return res.json();
}

function toAllDayEnd(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`;
}

function buildEventBody(task) {
  const isMeeting = task.category === 'Meeting' && task.meetingTime;
  if (!isMeeting) {
    return {
      summary: '[' + task.category + '] ' + task.title,
      description: task.notes || '',
      start: { date: task.dueDate },
      end: { date: toAllDayEnd(task.dueDate) }
    };
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(`${task.dueDate}T${task.meetingTime}:00`);
  const end = new Date(start.getTime() + (task.durationMinutes || 30) * 60000);
  const attendees = (task.participants || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(email => ({ email }));
  return {
    summary: '[Meeting] ' + task.title,
    description: task.notes || '',
    start: { dateTime: formatLocalDateTime(start), timeZone: tz },
    end: { dateTime: formatLocalDateTime(end), timeZone: tz },
    ...(attendees.length ? { attendees } : {})
  };
}

async function syncTaskToCalendar(task) {
  if (!accessToken) return;
  const body = buildEventBody(task);
  const qs = body.attendees ? '?sendUpdates=all' : '';
  try {
    if (task.calendarEventId) {
      await gcalFetch('events/' + task.calendarEventId + qs, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      const created = await gcalFetch('events' + qs, { method: 'POST', body: JSON.stringify(body) });
      task.calendarEventId = created.id;
      saveTasks();
      renderTasks();
    }
  } catch (err) {
    console.error(err);
  }
}

function importGcalEventAsTask(event) {
  const startStr = event.start.dateTime || event.start.date;
  const isTimed = !!event.start.dateTime;
  const dueDate = startStr.slice(0, 10);
  let meetingTime = null;
  let durationMinutes = null;
  if (isTimed) {
    meetingTime = startStr.slice(11, 16);
    const endStr = event.end.dateTime || event.end.date;
    durationMinutes = Math.round((new Date(endStr) - new Date(startStr)) / 60000);
  }
  const participants = (event.attendees || []).map(a => a.email).filter(Boolean).join(', ');
  const task = {
    id: crypto.randomUUID(),
    title: event.summary || '(untitled event)',
    category: 'Meeting',
    priority: 'medium',
    dueDate,
    projectPath: '',
    notes: event.description || '',
    status: 'todo',
    meetingTime,
    durationMinutes,
    participants,
    calendarEventId: event.id,
    createdAt: Date.now()
  };
  tasks.push(task);
  saveTasks();
  renderTasks();
  renderAgenda();
  buddySay('Meeting added!');
}

async function deleteCalendarEvent(eventId) {
  if (!accessToken) return;
  try { await gcalFetch('events/' + eventId, { method: 'DELETE' }); }
  catch (err) { console.error(err); }
}

async function fetchUpcomingEvents() {
  if (!accessToken) return [];
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  try {
    const data = await gcalFetch(`events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`);
    return data.items || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

let lastGcalEvents = [];

async function renderAgenda() {
  const list = document.getElementById('agenda-list');
  const taskItems = tasks
    .filter(t => t.dueDate && t.status !== 'done')
    .map(t => ({ date: t.dueDate, label: t.title, type: 'task' }));

  let gcalItems = [];
  if (accessToken) {
    const events = await fetchUpcomingEvents();
    lastGcalEvents = events;
    gcalItems = events
      .filter(e => !tasks.some(t => t.calendarEventId === e.id))
      .map(e => ({
        date: (e.start.date || e.start.dateTime || '').slice(0, 10),
        label: e.summary || '(no title)',
        type: 'gcal',
        eventId: e.id
      }));
  }

  const all = [...taskItems, ...gcalItems].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = {};
  all.forEach(item => { (byDate[item.date] = byDate[item.date] || []).push(item); });

  list.innerHTML = Object.keys(byDate).sort().map(date => `
    <div class="agenda-day">${date}</div>
    ${byDate[date].map(item => `
      <div class="agenda-item ${item.type}">
        <span>${escapeHtml(item.label)}</span>
        <span class="agenda-item-right">
          ${item.type === 'gcal' ? `<button class="mini-btn" data-action="import-gcal" data-event-id="${item.eventId}">+ Add as task</button>` : ''}
          <span>${item.type === 'gcal' ? 'Google Calendar' : 'Task'}</span>
        </span>
      </div>
    `).join('')}
  `).join('') || '<p class="hint">Nothing scheduled in the next 30 days.</p>';

  list.querySelectorAll('[data-action="import-gcal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = lastGcalEvents.find(e => e.id === btn.dataset.eventId);
      if (ev) importGcalEventAsTask(ev);
    });
  });
}

// ---------- buddy creature ----------
const buddyEl = document.getElementById('buddy');
const buddySpeechEl = document.getElementById('buddy-speech');
let buddyTimer = null;

function buddySay(text) {
  buddySpeechEl.textContent = text;
  buddySpeechEl.classList.add('show');
  clearTimeout(buddyTimer);
  buddyTimer = setTimeout(() => buddySpeechEl.classList.remove('show'), 2200);
}

function buddyCelebrate() {
  buddySay(pick(['Nice job!', '+10 XP!', 'You rock!', 'Quest complete!']));
  buddyEl.classList.remove('celebrate');
  void buddyEl.offsetWidth;
  buddyEl.classList.add('celebrate');
  setTimeout(() => buddyEl.classList.remove('celebrate'), 700);
}

buddyEl.addEventListener('click', () => {
  buddySay(pick(['Keep going!', "I'm rooting for you!", 'Need a hand?', 'Beep boop!']));
});

// ---------- init ----------
renderTasks();
if (settings.clientId) initGoogleClient();

const overlay = document.getElementById('breakOverlay');
const openButton = document.getElementById('openBreak');
const closeButton = document.getElementById('closeBreak');
const endButton = document.getElementById('endBreak');
const form = document.getElementById('timerForm');
const minutes = document.getElementById('minutes');
const display = document.getElementById('timerDisplay');
const message = document.getElementById('timerMessage');
let interval;
let deadline;
function stopTimer() { clearInterval(interval); interval = undefined; }
function closeBreak() { stopTimer(); overlay.hidden = true; document.body.style.overflow = ''; display.textContent = '00:00'; message.textContent = ''; minutes.value = ''; openButton.focus(); }
function alarm() { try { const context = new (window.AudioContext || window.webkitAudioContext)(); [0, .35, .7].forEach(offset => { const osc = context.createOscillator(); const gain = context.createGain(); osc.type = 'sine'; osc.frequency.value = 660; gain.gain.setValueAtTime(.0001, context.currentTime + offset); gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + offset + .03); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + offset + .25); osc.connect(gain); gain.connect(context.destination); osc.start(context.currentTime + offset); osc.stop(context.currentTime + offset + .26); }); setTimeout(() => context.close(), 1500); } catch (_) {} }
function updateTimer() { const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); display.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`; if (!remaining) { stopTimer(); message.textContent = 'Your break is over. Ready when you are!'; document.title = 'Break time is over — Education Campus'; alarm(); } }
openButton.addEventListener('click', () => { overlay.hidden = false; document.body.style.overflow = 'hidden'; document.title = 'Education Campus — A space to grow'; closeButton.focus(); });
closeButton.addEventListener('click', closeBreak); endButton.addEventListener('click', closeBreak);
form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity()) return; const value = Number(minutes.value); if (!value) { minutes.focus(); return; } stopTimer(); message.textContent = 'Your break timer is running.'; deadline = Date.now() + value * 60000; updateTimer(); interval = setInterval(updateTimer, 250); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden) closeBreak(); });

const themeButtons = document.querySelectorAll('.color-swatch');
themeButtons.forEach(button => button.addEventListener('click', () => {
  document.body.dataset.theme = button.dataset.theme;
  themeButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));

const subjectList = document.getElementById('subjects');
const notesArea = document.getElementById('subjectNotes');
let selection = 0;
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; return node; }
// Course material and model output are inserted as text, never as HTML.
function renderTable(data) {
  if (!data || !Array.isArray(data.headers) || !data.headers.length || !Array.isArray(data.rows)) return null;
  const wrap = element('div', 'note-table-scroll', '');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', data.caption || 'Study table');
  const table = element('table', 'note-table', '');
  if (data.caption) table.append(element('caption', '', data.caption));
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  data.headers.forEach(value => { const cell = element('th', '', value); cell.scope = 'col'; headerRow.append(cell); });
  head.append(headerRow); table.append(head);
  const body = document.createElement('tbody');
  data.rows.forEach(values => {
    if (!Array.isArray(values)) return;
    const row = document.createElement('tr');
    data.headers.forEach((_, index) => row.append(element('td', '', values[index] ?? '')));
    body.append(row);
  });
  table.append(body); wrap.append(table); return wrap;
}
function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}
function appendBody(card, text) {
  const lines = String(text || '').split(/\r?\n/);
  let paragraph = [];
  const flush = () => { if (paragraph.length) { card.append(element('p', '', paragraph.join('\n'))); paragraph = []; } };
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*```([^`]*)\s*$/);
    if (fence) {
      flush();
      const language = fence[1].trim();
      const codeLines = [];
      while (++i < lines.length && !/^\s*```\s*$/.test(lines[i])) codeLines.push(lines[i]);
      const block = element('div', 'note-code-block', '');
      if (language) block.append(element('span', 'note-code-language', language));
      const pre = element('pre', 'tex2jax_ignore', '');
      pre.append(element('code', '', codeLines.join('\n')));
      block.append(pre); card.append(block);
      continue;
    }
    if (lines[i].trim() === '$$') {
      flush();
      const formula = [];
      while (++i < lines.length && lines[i].trim() !== '$$') formula.push(lines[i]);
      card.append(element('div', 'note-formula', `$$\n${formula.join('\n')}\n$$`));
      continue;
    }
    const header = splitTableRow(lines[i]);
    const separator = i + 1 < lines.length ? splitTableRow(lines[i + 1]) : [];
    if (lines[i].includes('|') && header.length > 1 && separator.length === header.length && separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
      flush(); i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitTableRow(lines[i++]));
      i--;
      const table = renderTable({headers: header, rows}); if (table) card.append(table);
    } else if (!lines[i].trim()) flush();
    else paragraph.push(lines[i]);
  }
  flush();
}
async function selectSubject(subject, button) {
  const requestId = ++selection;
  subjectList.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  notesArea.classList.remove('notes-enter');
  notesArea.replaceChildren(element('p', 'notes-placeholder', 'Preparing your notes…'));
  try {
    const response = await fetch(`/api/subjects/${encodeURIComponent(subject.id)}`);
    if (!response.ok) throw new Error('Unable to load notes.');
    const notes = await response.json();
    if (requestId !== selection) return;
    const heading = element('div', 'notes-heading', '');
    heading.append(element('span', 'eyebrow', subject.name.toUpperCase()), element('h2', '', notes.title));
    const grid = element('div', 'notes-grid', '');
    notes.sections.forEach(section => {
      const card = element('article', 'note-card', '');
      card.append(element('h3', '', section.heading));
      appendBody(card, section.body);
      if (Array.isArray(section.tables)) section.tables.forEach(data => { const table = renderTable(data); if (table) card.append(table); });
      if (section.tip) card.append(element('p', 'note-tip', `✳  ${section.tip}`));
      if (section.example) card.append(element('p', 'note-example', `EXAMPLE  ·  ${section.example}`));
      grid.append(card);
    });
    notesArea.replaceChildren(heading, grid);
    if (notes.mode === 'sample') notesArea.append(element('p', 'notes-disclaimer', 'Sample notes · Connect an AI API key to organize your own course material.'));
    if (window.MathJax?.startup?.promise) window.MathJax.startup.promise.then(() => window.MathJax.typesetPromise([notesArea])).catch(() => {});
    requestAnimationFrame(() => notesArea.classList.add('notes-enter'));
  } catch (_) { if (requestId === selection) notesArea.replaceChildren(element('p', 'notes-placeholder', 'Notes could not be loaded. Please check that the local server is running.')); }
}
async function loadSubjects() {
  try {
    const response = await fetch('/api/subjects'); if (!response.ok) throw new Error();
    const subjects = await response.json();
    subjectList.replaceChildren();
    subjects.forEach(subject => { const button = element('button','subject',subject.name); button.type='button'; button.setAttribute('aria-pressed','false'); button.append(element('i','','↗')); button.addEventListener('click',()=>selectSubject(subject,button)); subjectList.append(button); });
    if (!subjects.length) notesArea.replaceChildren(element('p','notes-placeholder','No subjects have been added yet.'));
  } catch (_) { notesArea.replaceChildren(element('p','notes-placeholder','Start the local server to load your subjects.')); }
}
loadSubjects();

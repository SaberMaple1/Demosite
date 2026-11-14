/* Admin portal: open/close the website and ordering, set the cut-off time, create accounts.
   Everything is saved on the server. */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'accounts', label: 'Accounts', icon: 'users' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
const V = { page: 'dashboard', tab: 'student', q: '', users: { student: null, staff: null }, counts: null };
let lastCreds = null, lastActivity = Date.now();
const me = () => Auth.current('admin');
const ROLE_LABEL = { student: 'Student', staff: 'Canteen Staff' };

/* ---------- loading from the server ---------- */
async function loadUsers(role) { V.users[role] = await Auth.call('admin_list_users', { p_role: role }); }
async function loadCounts() { V.counts = await Auth.call('admin_counts'); }
async function reloadAll() { await Promise.all([Auth.sync(true), loadCounts(), loadUsers('student'), loadUsers('staff')]); }
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { toast(e.message, 'error'); return false; }
}
async function saveSettings(p) { await Auth.call('admin_set_settings', { p }); await Auth.sync(true); }

/* ---------- pages ---------- */
function controls() {
  const s = Auth.settings();
  const sw = (key, on, title, hint) => `<label class="switch-row"><span><b>${title}</b><small>${hint}</small></span><input type="checkbox" class="sw" data-change="${key}" ${on ? 'checked' : ''}></label>`;
  return `<section class="panel">
    <div class="panel-head"><h2>Website &amp; ordering</h2></div>
    ${sw('site', s.websiteOpen, 'Website open', 'Turn off to close the whole student website. Students will see a “closed” page.')}
    ${sw('orders', s.ordersOpen, 'Taking orders', 'Turn off to close ordering right away. Students can still see the menu.')}
    ${sw('cutoff', s.cutoffOn, 'Daily cut-off time', 'Ordering opens and closes by itself every day (Philippine time).')}
    <form data-form="schedule" style="margin-top:1rem">
      <div class="row">
        <label class="field"><span>Ordering opens at</span><input type="time" name="opensAt" value="${esc(s.opensAt)}" required></label>
        <label class="field"><span>Cut-off (orders close at)</span><input type="time" name="cutoffAt" value="${esc(s.cutoffAt)}" required></label>
      </div>
      <label class="field"><span>Message for students (optional)</span><input name="notice" maxlength="120" value="${esc(s.notice)}" placeholder="e.g. Canteen closed for the school event."></label>
      <p class="error-text" id="sched-err" role="alert"></p>
      <button class="btn btn-primary">Save schedule</button>
    </form>
  </section>`;
}

function dashboardPage() {
  const s = Auth.settings(), st = Auth.orderStatus(), c = V.counts || { students: '–', staff: '–' };
  return `
  <div class="stats">
    <div class="stat ${s.websiteOpen ? '' : 'warn'}"><small>Website</small><strong>${s.websiteOpen ? 'Open' : 'Closed'}</strong><span class="mute">Student site</span></div>
    <div class="stat ${st.open ? '' : 'warn'}"><small>Ordering right now</small><strong>${st.open ? 'Open' : 'Closed'}</strong><span class="mute">${esc(st.msg)}</span></div>
    <div class="stat"><small>Cut-off time</small><strong>${s.cutoffOn ? Auth.fmt(s.cutoffAt) : 'Off'}</strong><span class="mute">${s.cutoffOn ? 'Opens ' + Auth.fmt(s.opensAt) : 'No daily schedule'}</span></div>
    <div class="stat"><small>Accounts</small><strong>${c.students}</strong><span class="mute">students · ${c.staff} canteen staff</span></div>
  </div>
  ${controls()}`;
}

function accountsPage() {
  const q = V.q.toLowerCase(), all = V.users[V.tab];
  const list = (all || []).filter((u) => !q || (u.name + u.id + (u.section || '')).toLowerCase().includes(q));
  const stu = V.tab === 'student';
  return `
  <div class="subtabs">${Object.keys(ROLE_LABEL).map((k) => `<button data-act="tab" data-v="${k}" aria-selected="${V.tab === k}">${k === 'student' ? 'Students' : 'Canteen Staff'}</button>`).join('')}</div>
  <section class="panel">
    <div class="panel-head"><h2>Create ${stu ? 'student' : 'canteen staff'} accounts</h2></div>
    <form data-form="create">
      <label class="field"><span>${stu ? 'Names, one per line (add a comma and the grade &amp; section if you like)' : 'Names, one per line'}</span>
        <textarea class="names" name="names" required placeholder="${stu ? 'Juan Dela Cruz, Grade 10 - Rizal&#10;Maria Santos, Grade 9 - Bonifacio' : 'Ana Reyes&#10;Pedro Cruz'}"></textarea></label>
      <p class="mute" style="margin-bottom:1rem">${stu ? 'A Student No. (like 2026-0001) and a password are generated for each one.' : 'A username (like staff01) and a password are generated for each one.'}</p>
      <button class="btn btn-primary">${icon('plus')} Generate accounts</button>
    </form>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>${ROLE_LABEL[V.tab]} accounts${all ? ` (${list.length})` : ''}</h2>
      <input type="search" data-input="acc-q" placeholder="Search…" value="${esc(V.q)}" style="padding:.5rem .8rem;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit"></div>
    ${!all ? '<p class="mute">Loading…</p>' : list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${stu ? 'Student No.' : 'Username'}</th><th>Name</th>${stu ? '<th>Grade &amp; section</th>' : ''}<th>Status</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><code>${esc(u.id)}</code></td><td>${esc(u.name)}</td>${stu ? `<td>${esc(u.section || '—')}</td>` : ''}
        <td><span class="chip ${u.active === false ? 'chip-pending' : 'chip-ready'}">${u.active === false ? 'Off' : 'Active'}</span></td>
        <td class="acts"><button class="btn btn-sm" data-act="reset" data-id="${esc(u.id)}">New password</button>
        <button class="btn btn-sm" data-act="toggle" data-id="${esc(u.id)}">${u.active === false ? 'Turn on' : 'Turn off'}</button>
        <button class="btn btn-sm btn-danger" data-act="del" data-id="${esc(u.id)}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="mute">No accounts yet.</p>'}
  </section>`;
}

function profilePage() {
  const a = me();
  return `<section class="panel form-box">
    <h2 style="margin-bottom:.4rem">${esc(a.name)}</h2>
    <p class="mute" style="margin-bottom:1.2rem">Admin username: <b>${esc(a.id)}</b> · Last sign-in: ${a.lastLogin ? esc(new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.lastLogin))) : 'first sign-in'}</p>
    <form data-form="password">
      <h3 style="margin-bottom:.8rem">Change password</h3>
      <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
      <label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="field"><span>Confirm new password</span><input name="confirm" type="password" autocomplete="new-password" required></label>
      <p class="error-text" id="pw-err" role="alert"></p>
      <button class="btn btn-primary">Update password</button>
    </form>
    <hr style="margin:1.4rem 0">
    <button class="btn btn-danger" data-act="logout">${icon('logout')} Sign out</button>
  </section>`;
}
const PAGES = { dashboard: dashboardPage, accounts: accountsPage, profile: profilePage };

function render() {
  if (!me()) { location.replace('../index.html'); return; }
  const a = me(), y = scrollY, typing = document.activeElement?.dataset?.input === 'acc-q';
  const nav = NAV.map((n) => `<button class="nav-btn" data-act="nav" data-page="${n.id}" ${V.page === n.id ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></button>`).join('');
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="rail"><div class="brand"><img class="logo" src="pickago_Logo.png" alt="">Pickago</div><nav aria-label="Main">${nav}</nav><p class="rail-foot">Admin</p></aside>
    <div class="main">
      <header class="top"><h1>${NAV.find((n) => n.id === V.page).label}</h1>
        <button class="me" data-act="nav" data-page="profile" aria-label="Open profile"><span class="avatar">${esc((a.name || 'A')[0].toUpperCase())}</span><span>${esc(a.name)}</span></button></header>
      <main class="content">${PAGES[V.page]()}</main>
    </div>
    <nav class="tabbar" aria-label="Main">${nav}</nav>
  </div>`;
  scrollTo(0, y);
  if (typing) { const i = $('[data-input=acc-q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

/* ---------- generated credentials ---------- */
function showCreds(rows, role) {
  lastCreds = { rows, role };
  const stu = role === 'student';
  Modal.open(`<h2>${rows.length} account${rows.length === 1 ? '' : 's'} created</h2>
    <p class="mute">Save or print these now. Passwords are stored scrambled, so they can’t be shown again (you can make a new one any time).</p>
    <div class="tbl-wrap" style="max-height:50vh;overflow:auto;margin:.8rem 0"><table class="tbl"><thead><tr><th>Name</th><th>${stu ? 'Student No.' : 'Username'}</th><th>Password</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td><code>${esc(r.id)}</code></td><td><code>${esc(r.password)}</code></td></tr>`).join('')}</tbody></table></div>
    <div class="sheet-actions"><button class="btn" data-act="copy-creds">Copy</button><button class="btn" data-act="print-creds">Print</button><button class="btn btn-primary" data-act="modal-close">Done</button></div>`);
}
function printCreds() {
  const { rows, role } = lastCreds, w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print.', 'error');
  w.document.write(`<title>Pickago accounts</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:8px;text-align:left}</style>
    <h2>Pickago ${ROLE_LABEL[role]} accounts</h2><table><tr><th>Name</th><th>${role === 'student' ? 'Student No.' : 'Username'}</th><th>Password</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.id)}</td><td>${esc(r.password)}</td></tr>`).join('')}</table>`);
  w.document.close(); w.print();
}

/* ---------- actions ---------- */
const findUser = (id) => [...(V.users.student || []), ...(V.users.staff || [])].find((u) => u.id === id);
const Actions = {
  nav: (d) => { V.page = d.page; render(); scrollTo(0, 0); if (d.page === 'accounts' && !V.users[V.tab]) loadUsers(V.tab).then(render); },
  tab: async (d) => { V.tab = d.v; V.q = ''; render(); if (!V.users[d.v]) { await run(() => loadUsers(d.v)); render(); } },
  'modal-close': () => Modal.close(),
  'copy-creds': () => {
    const t = lastCreds.rows.map((r) => [r.name, r.id, r.password].join('\t')).join('\n');
    navigator.clipboard?.writeText(t).then(() => toast('Copied'), () => toast('Could not copy', 'error'));
  },
  'print-creds': printCreds,
  reset: async (d) => {
    const u = findUser(d.id); if (!u || !(await Modal.confirm(`New password for ${u.name}?`, 'The old password will stop working and they will be signed out.', 'Make new password'))) return;
    try { const r = await Auth.call('admin_reset_password', { p_id: u.id }); showCreds([{ name: u.name, id: u.id, password: r.password }], u.role); }
    catch (e) { toast(e.message, 'error'); }
  },
  toggle: async (d) => {
    const u = findUser(d.id); if (!u) return;
    if (await run(() => Auth.call('admin_set_active', { p_id: u.id, p_active: u.active === false }))) { await run(() => loadUsers(u.role)); render(); }
  },
  del: async (d) => {
    const u = findUser(d.id);
    if (!u || !(await Modal.confirm(`Delete ${u.name}?`, `${u.id} won’t be able to sign in any more. Past orders stay in the records.`, 'Delete account', true))) return;
    if (await run(() => Auth.call('admin_delete_user', { p_id: u.id }), 'Account deleted')) { await run(() => Promise.all([loadUsers(u.role), loadCounts()])); render(); }
  },
  logout: async () => { if (await Modal.confirm('Sign out?', 'You will need to sign in again.', 'Sign out')) { Auth.logout(); location.replace('../index.html'); } },
};
document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el) Actions[el.dataset.act]?.(el.dataset, el); });
document.addEventListener('input', (e) => { if (e.target.dataset.input === 'acc-q') { V.q = e.target.value; render(); } });
document.addEventListener('change', async (e) => {
  const t = e.target, map = { site: 'websiteOpen', orders: 'ordersOpen', cutoff: 'cutoffOn' }, k = map[t.dataset.change];
  if (!k) return;
  const ok = await run(() => saveSettings({ [k]: t.checked }), t.checked ? 'Turned on' : 'Turned off');
  render();
  if (!ok) await run(() => Auth.sync(true)).then(render);
});

const Forms = {
  async schedule(f) {
    const fd = new FormData(f), err = $('#sched-err'), a = fd.get('opensAt'), b = fd.get('cutoffAt');
    if (b <= a) { err.textContent = 'The cut-off must be later than the opening time.'; return; }
    try { await saveSettings({ opensAt: a, cutoffAt: b, notice: fd.get('notice').trim() }); }
    catch (e) { err.textContent = e.message; return; }
    toast('Schedule saved'); render();
  },
  async create(f) {
    const role = V.tab, btn = f.querySelector('button');
    const rows = String(new FormData(f).get('names')).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 200).map((l) => {
      const [name, ...rest] = l.split(',');
      return { name: name.trim(), section: role === 'student' ? rest.join(',').trim() : '' };
    }).filter((r) => r.name.length >= 2);
    if (!rows.length) return toast('Type at least one name.', 'error');
    btn.disabled = true;
    try {
      const out = await Auth.call('admin_create_users', { p_role: role, p_rows: rows });
      await Promise.all([loadUsers(role), loadCounts()]);
      render(); showCreds(out, role);
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  },
  async password(f) {
    const fd = new FormData(f), err = $('#pw-err'), next = fd.get('next');
    if (next.length < 8) { err.textContent = 'New password needs at least 8 characters.'; return; }
    if (next === fd.get('current')) { err.textContent = 'Choose a different password.'; return; }
    if (next !== fd.get('confirm')) { err.textContent = 'New passwords don’t match.'; return; }
    try { await Auth.changePassword(fd.get('current'), next); } catch (e) { err.textContent = e.message; return; }
    toast('Password updated'); f.reset(); err.textContent = '';
  },
};
document.addEventListener('submit', (e) => { const h = Forms[e.target.dataset.form]; if (h) { e.preventDefault(); h(e.target); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Modal.close(); });

['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => { if (me() && Date.now() - lastActivity > 30 * 60000) { Auth.logout(); location.replace('../index.html'); } }, 30000);
/* keep the status cards fresh (e.g. when the cut-off time passes) */
setInterval(async () => {
  if (!me() || V.page !== 'dashboard' || $('.scrim') || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  try { const r = await Auth.sync(); if (r.changed) render(); } catch {}
}, 15000);

(async () => {
  if (!me()) { location.replace('../index.html'); return; }
  $('#app').innerHTML = '<p class="mute" style="padding:2rem">Loading…</p>';
  try { await Promise.all([Auth.sync(true), loadCounts()]); }
  catch (e) { $('#app').innerHTML = `<div class="empty" style="margin:2rem"><strong>Can’t load the admin page</strong>${esc(e.message)}<br><br><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`; return; }
  render();
})();

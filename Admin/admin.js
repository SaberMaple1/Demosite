/* Admin portal: Student IDs (and who uses them), staff/admin accounts, open/close, cut-off, email setup.
   Everything is saved on the server. */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'ids', label: 'Student IDs', icon: 'users' },
  { id: 'accounts', label: 'Staff & Admins', icon: 'tag' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
const V = { page: 'dashboard', tab: 'staff', q: '', idq: '', idf: 'all', users: { staff: null, admin: null }, ids: null, counts: null, mail: null };
let lastCreds = null, lastActivity = Date.now();
const me = () => Auth.current('admin');
const ROLE_LABEL = { student: 'Student', staff: 'Canteen Staff', admin: 'Admin' };
const TAB_LABEL = { staff: 'Canteen Staff', admin: 'Admins' };
const fmtDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const fmtTime = (iso) => (iso ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');

/* ---------- loading from the server ---------- */
const loadUsers = async (role) => { V.users[role] = await Auth.call('admin_list_users', { p_role: role }); };
const loadCounts = async () => { V.counts = await Auth.call('admin_counts'); };
const loadIds = async () => { V.ids = await Auth.call('admin_student_ids'); };
const loadMail = async () => { V.mail = await Auth.call('admin_mail_get'); };
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { toast(e.message, 'error'); return false; }
}
async function saveSettings(p) { await Auth.call('admin_set_settings', { p }); await Auth.sync(true); }

/* ---------- Dashboard ---------- */
function controls() {
  const s = Auth.settings();
  const sw = (key, on, title, hint) => `<label class="switch-row"><span><b>${title}</b><small>${hint}</small></span><input type="checkbox" class="sw" data-change="${key}" ${on ? 'checked' : ''}></label>`;
  return `<section class="panel">
    <div class="panel-head"><h2>Website &amp; ordering</h2></div>
    ${sw('site', s.websiteOpen, 'Website open', 'Turn off to close the whole student website. Students will see a “closed” page.')}
    ${sw('orders', s.ordersOpen, 'Taking orders', 'Turn off to close ordering right away. Students can still see the menu.')}
    ${sw('preorder', s.preorderOn, 'Pre-orders for tomorrow', 'Students can order for tomorrow, even after today’s cut-off. Turns off with “Taking orders”.')}
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

function mailPanel() {
  const m = V.mail;
  const chip = (st) => `<span class="chip ${st === 'sent' ? 'chip-ready' : st === 'waiting' ? 'chip-pending' : 'chip-done'}">${esc(st)}</span>`;
  return `<section class="panel">
    <div class="panel-head"><h2>Email for sign-up</h2>${m ? `<span class="chip ${m.configured ? 'chip-ready' : 'chip-pending'}">${m.configured ? 'Set up' : 'Not set up'}</span>` : ''}</div>
    <p class="mute" style="margin-bottom:1rem">When a student signs up, their Student ID is emailed to them through a free Google Apps Script on a Gmail account. Follow the steps in <b>pickago_email_setup.txt</b>, then paste the two things here. The secret word is never shown again.</p>
    <form data-form="mail">
      <label class="field"><span>Web app address (ends with /exec)</span><input name="url" placeholder="https://script.google.com/macros/s/…/exec" required></label>
      <label class="field"><span>Secret word (the same one in your script)</span><input name="secret" type="password" autocomplete="off" required></label>
      <p class="error-text" id="mail-err" role="alert"></p>
      <button class="btn btn-primary">Save email settings</button>
    </form>
    <form data-form="mailtest" style="margin-top:1.2rem">
      <label class="field"><span>Send a test email to</span><input name="to" type="email" placeholder="your-own-email@gmail.com" required></label>
      <p class="error-text" id="test-err" role="alert"></p>
      <button class="btn">Send test email</button>
    </form>
    ${m ? `<div style="margin-top:1.2rem"><b>Recent emails</b> <span class="mute">· ${m.sentToday} sent in the last 24 hours (limit 90)</span>
      ${m.log.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${m.log.map((l) => `<tr><td>${esc(fmtTime(l.at))}</td><td>${esc(l.kind)}</td><td>${esc(l.to)}</td><td>${chip(l.status)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mute" style="margin-top:.5rem">“sent” means Google accepted the request. If a test email doesn’t arrive, check the Spam folder and the secret word. <button class="btn btn-sm" data-act="mail-refresh">Refresh</button></p>` : '<p class="mute">Nothing sent yet.</p>'}</div>` : ''}
  </section>`;
}

function dashboardPage() {
  const s = Auth.settings(), st = Auth.orderStatus(), c = V.counts || {};
  return `
  <div class="stats">
    <div class="stat ${s.websiteOpen ? '' : 'warn'}"><small>Website</small><strong>${s.websiteOpen ? 'Open' : 'Closed'}</strong><span class="mute">Student site</span></div>
    <div class="stat ${st.open ? '' : 'warn'}"><small>Ordering right now</small><strong>${st.open ? 'Open' : 'Closed'}</strong><span class="mute">${esc(st.msg)}</span></div>
    <div class="stat"><small>Student IDs</small><strong>${c.students ?? '–'} in use</strong><span class="mute">${c.idsAvailable ?? '–'} free of ${c.idsTotal ?? '–'}</span></div>
    <div class="stat"><small>Staff &amp; admins</small><strong>${c.staff ?? '–'} staff</strong><span class="mute">${c.admins ?? '–'} admin${c.admins === 1 ? '' : 's'}</span></div>
  </div>
  ${controls()}
  ${mailPanel()}`;
}

/* ---------- Student IDs: generate, and see who uses each one ---------- */
const STATUS = { in_use: ['In use', 'chip-ready'], waiting: ['Waiting for email check', 'chip-pending'], available: ['Available', ''], retired: ['Retired', 'chip-done'] };
function shownIds() {
  const q = V.idq.toLowerCase();
  return (V.ids || []).filter((x) => (V.idf === 'all' || x.status === V.idf) && (!q || (x.id + (x.name || '') + (x.section || '')).toLowerCase().includes(q)));
}
function idsPage() {
  if (!V.ids) return '<p class="mute">Loading…</p>';
  const year = (Auth.settings().today || '').slice(0, 4), n = (st) => V.ids.filter((x) => x.status === st).length;
  const nums = V.ids.filter((x) => x.id.startsWith(year + '-')).map((x) => +x.id.slice(5));
  const next = `${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  const list = shownIds();
  const chips = [['all', 'All', V.ids.length], ['in_use', 'In use', n('in_use')], ['waiting', 'Waiting', n('waiting')], ['available', 'Available', n('available')], ['retired', 'Retired', n('retired')]];
  return `
  <section class="panel">
    <div class="panel-head"><h2>Generate Student IDs for ${esc(year)}</h2></div>
    <form data-form="genids">
      <label class="field"><span>How many Student IDs?</span><input type="number" name="count" min="1" max="2000" required placeholder="e.g. 300"></label>
      <p class="mute" style="margin-bottom:1rem">They are numbered in order. The next one will be <b>${esc(next)}</b>. A student gets the lowest free ID when they sign up, and it is emailed to them.</p>
      <button class="btn btn-primary">${icon('plus')} Generate</button>
    </form>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Who is using the IDs</h2>
      <input type="search" data-input="id-q" placeholder="Search ID, name or section…" value="${esc(V.idq)}" style="padding:.5rem .8rem;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit"></div>
    <div class="subtabs" style="flex-wrap:wrap">${chips.map(([k, l, c]) => `<button data-act="idf" data-v="${k}" aria-selected="${V.idf === k}">${l} (${c})</button>`).join('')}</div>
    ${list.length ? `<div class="toolbar"><button class="btn btn-sm" data-act="print-ids">Print list</button>
      ${list.some((x) => x.status === 'in_use') ? '<button class="btn btn-sm" data-act="expiry-bulk">Set auto-delete date for those in use</button>' : ''}</div>` : ''}
    ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Student ID</th><th>Status</th><th>Name</th><th>Grade &amp; section</th><th>Last sign-in</th><th>Auto-delete</th><th></th></tr></thead><tbody>
      ${list.map((x) => { const [label, cls] = STATUS[x.status];
        return `<tr><td><code>${esc(x.id)}</code></td>
        <td><span class="chip ${cls}">${label}</span>${x.status === 'in_use' && x.active === false ? ' <span class="chip chip-pending">Off</span>' : ''}</td>
        <td>${esc(x.name || '—')}</td><td>${esc(x.section || '—')}</td><td>${x.status === 'in_use' ? esc(fmtTime(x.loginAt)) : '—'}</td>
        <td>${x.status === 'in_use' ? esc(fmtDate(x.expiresOn)) : '—'}</td>
        <td class="acts">${x.status === 'in_use' ? `<button class="btn btn-sm" data-act="expiry" data-id="${esc(x.id)}">Auto-delete…</button>
          <button class="btn btn-sm" data-act="toggle" data-id="${esc(x.id)}">${x.active === false ? 'Turn on' : 'Turn off'}</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${esc(x.id)}">Delete</button>`
          : x.status === 'available' ? `<button class="btn btn-sm" data-act="rm-id" data-id="${esc(x.id)}">Remove</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<p class="mute">${V.ids.length ? 'Nothing matches.' : 'No Student IDs yet. Generate some above.'}</p>`}
  </section>`;
}

/* ---------- Staff & admin accounts (the admin creates these) ---------- */
function accountsPage() {
  const q = V.q.toLowerCase(), t = V.tab, all = V.users[t], self = me().id;
  const list = (all || []).filter((u) => !q || (u.name + u.id).toLowerCase().includes(q));
  const staff = t === 'staff';
  return `
  <div class="subtabs">${Object.keys(TAB_LABEL).map((k) => `<button data-act="tab" data-v="${k}" aria-selected="${t === k}">${TAB_LABEL[k]}</button>`).join('')}</div>
  <section class="panel">
    <div class="panel-head"><h2>Create ${staff ? 'canteen staff' : 'admin'} accounts</h2></div>
    <form data-form="create">
      <label class="field"><span>Names, one per line</span><textarea class="names" name="names" required placeholder="${staff ? 'Ana Reyes&#10;Pedro Cruz' : 'Ms. Garcia&#10;Mr. Lopez'}"></textarea></label>
      ${staff ? `<label class="field"><span>Auto-delete on (optional)</span><input type="date" name="expires" min="${esc(Auth.settings().tomorrow || '')}"><small class="mute">The account stops working at the start of this date and is then removed.</small></label>` : ''}
      <p class="mute" style="margin-bottom:1rem">${staff ? 'A username (like staff01) and a password are generated for each one.' : 'An admin username (like admin02) and a password are generated. Admins can do everything you can, so only add people you trust.'}</p>
      <button class="btn btn-primary">${icon('plus')} Generate accounts</button>
    </form>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>${TAB_LABEL[t]}${all ? ` (${list.length})` : ''}</h2>
      <input type="search" data-input="acc-q" placeholder="Search…" value="${esc(V.q)}" style="padding:.5rem .8rem;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit"></div>
    ${all && list.length ? `<div class="toolbar"><button class="btn btn-sm" data-act="print-list">Print list</button><button class="btn btn-sm" data-act="bulk-reset">New passwords &amp; print</button></div>` : ''}
    ${!all ? '<p class="mute">Loading…</p>' : list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Username</th><th>Name</th><th>Status</th>${staff ? '<th>Auto-delete</th>' : ''}<th></th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><code>${esc(u.id)}</code></td><td>${esc(u.name)}</td>
        <td><span class="chip ${u.active === false ? 'chip-pending' : 'chip-ready'}">${u.active === false ? 'Off' : 'Active'}</span></td>
        ${staff ? `<td>${esc(fmtDate(u.expiresOn))}</td>` : ''}
        <td class="acts">${u.id === self ? '<span class="mute">You</span>' : `<button class="btn btn-sm" data-act="reset" data-id="${esc(u.id)}">New password</button>
        ${staff ? `<button class="btn btn-sm" data-act="expiry" data-id="${esc(u.id)}">Auto-delete…</button>` : ''}
        <button class="btn btn-sm" data-act="toggle" data-id="${esc(u.id)}">${u.active === false ? 'Turn on' : 'Turn off'}</button>
        <button class="btn btn-sm btn-danger" data-act="del" data-id="${esc(u.id)}">Delete</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="mute">No accounts yet.</p>'}
  </section>`;
}

function profilePage() {
  const a = me();
  return `<section class="panel form-box">
    <h2 style="margin-bottom:.4rem">${esc(a.name)}</h2>
    <p class="mute" style="margin-bottom:1.2rem">Admin username: <b>${esc(a.id)}</b> · Last sign-in: ${a.lastLogin ? esc(fmtTime(a.lastLogin)) : 'first sign-in'}</p>
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
const PAGES = { dashboard: dashboardPage, ids: idsPage, accounts: accountsPage, profile: profilePage };

function render() {
  if (!me()) { location.replace('../index.html'); return; }
  const a = me(), y = scrollY, typing = document.activeElement?.dataset?.input;
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
  if (typing) { const i = $(`[data-input=${typing}]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}

/* ---------- generated credentials (staff/admin) + printing ---------- */
function showCreds(rows, role) {
  lastCreds = { rows, role };
  Modal.open(`<h2>${rows.length} account${rows.length === 1 ? '' : 's'} ready</h2>
    <p class="mute">Save or print these now. Passwords are stored scrambled, so they can’t be shown again (you can make a new one any time).</p>
    <div class="tbl-wrap" style="max-height:50vh;overflow:auto;margin:.8rem 0"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Password</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td><code>${esc(r.id)}</code></td><td><code>${esc(r.password)}</code></td></tr>`).join('')}</tbody></table></div>
    <div class="sheet-actions"><button class="btn" data-act="copy-creds">Copy</button><button class="btn" data-act="print-creds">Print</button><button class="btn btn-primary" data-act="modal-close">Done</button></div>`);
}
function printTable(title, head, rows, note = '') {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print.', 'error');
  const e = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<title>${e(title)}</title><style>body{font-family:sans-serif;padding:24px;color:#111}h2{margin:0 0 4px}p{margin:0 0 14px;color:#555;font-size:13px}
    table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #999;padding:7px 9px;text-align:left}th{background:#eee}tr{page-break-inside:avoid}</style>
    <h2>${e(title)}</h2><p>${e(note)}Printed ${e(new Date().toLocaleString('en-PH'))}</p>
    <table><tr>${head.map((h) => `<th>${e(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</table>`);
  w.document.close(); w.print();
}

/* ---------- actions ---------- */
/* the person a button refers to: a staff/admin account, or a student row from the ID list */
const findUser = (id) => {
  const u = [...(V.users.staff || []), ...(V.users.admin || [])].find((x) => x.id === id);
  if (u) return u;
  const s = (V.ids || []).find((x) => x.id === id && x.status === 'in_use');
  return s ? { id: s.id, name: s.name, role: 'student', active: s.active, expiresOn: s.expiresOn } : null;
};
const reloadFor = async (role) => { await run(() => Promise.all([role === 'student' ? loadIds() : loadUsers(role), loadCounts()])); };
function openExpiry(ids, title, current) {
  Modal.open(`<form data-form="expiry" data-ids="${esc(ids.join('|'))}">
    <h2>${esc(title)}</h2>
    <p class="mute">The account stops working at the start of this date and is then deleted. Past orders stay in the records.</p>
    <label class="field"><span>Delete on</span><input type="date" name="date" value="${esc(current)}" min="${esc(Auth.settings().tomorrow || '')}"></label>
    <p class="mute" style="margin-bottom:1rem">Leave it empty to keep the account forever.</p>
    <p class="error-text" id="exp-err" role="alert"></p>
    <div class="sheet-actions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary">Save</button></div>
  </form>`);
}
const Actions = {
  nav: async (d) => {
    V.page = d.page; render(); scrollTo(0, 0);
    if (d.page === 'ids') { await run(loadIds); render(); }
    if (d.page === 'accounts') { await run(() => loadUsers(V.tab)); render(); }
    if (d.page === 'dashboard') { await run(() => Promise.all([loadCounts(), loadMail()])); render(); }
  },
  tab: async (d) => { V.tab = d.v; V.q = ''; render(); await run(() => loadUsers(d.v)); render(); },
  idf: (d) => { V.idf = d.v; render(); },
  'modal-close': () => Modal.close(),
  'mail-refresh': async () => { await run(loadMail); render(); },
  'copy-creds': () => {
    const t = lastCreds.rows.map((r) => [r.name, r.id, r.password].join('\t')).join('\n');
    navigator.clipboard?.writeText(t).then(() => toast('Copied'), () => toast('Could not copy', 'error'));
  },
  'print-creds': () => { const { rows, role } = lastCreds; printTable(`Pickago ${ROLE_LABEL[role]} logins`, ['Name', 'Username', 'Password'], rows.map((r) => [r.name, r.id, r.password]), 'Keep this sheet private. '); },
  'print-ids': () => {
    const list = shownIds();
    printTable('Pickago Student IDs', ['Student ID', 'Status', 'Name', 'Grade & section', 'Last sign-in'],
      list.map((x) => [x.id, STATUS[x.status][0], x.name || '', x.section || '', x.status === 'in_use' && x.loginAt ? fmtTime(x.loginAt) : '']),
      'Passwords are not shown because they are stored scrambled. ');
  },
  'print-list': () => {
    const t = V.tab, q = V.q.toLowerCase(), list = (V.users[t] || []).filter((u) => !q || (u.name + u.id).toLowerCase().includes(q));
    printTable(`Pickago ${TAB_LABEL[t]} list`, ['Username', 'Name', 'Status', ...(t === 'staff' ? ['Auto-delete'] : [])],
      list.map((u) => [u.id, u.name, u.active === false ? 'Off' : 'Active', ...(t === 'staff' ? [u.expiresOn ? fmtDate(u.expiresOn) : ''] : [])]));
  },
  'bulk-reset': async () => {
    const t = V.tab, q = V.q.toLowerCase(), list = (V.users[t] || []).filter((u) => u.id !== me().id && (!q || (u.name + u.id).toLowerCase().includes(q)));
    if (!list.length || !(await Modal.confirm(`Make new passwords for ${list.length} account${list.length === 1 ? '' : 's'}?`, 'Their old passwords stop working and they are signed out. You will get a list to print.', 'Make new passwords'))) return;
    try { showCreds(await Auth.call('admin_reset_passwords', { p_ids: list.map((u) => u.id) }), t); } catch (e) { toast(e.message, 'error'); }
  },
  expiry: (d) => { const u = findUser(d.id); if (u) openExpiry([u.id], `Auto-delete ${u.name}`, u.expiresOn || ''); },
  'expiry-bulk': () => { const l = shownIds().filter((x) => x.status === 'in_use'); if (l.length) openExpiry(l.map((x) => x.id), `Auto-delete date for ${l.length} student${l.length === 1 ? '' : 's'}`, ''); },
  reset: async (d) => {
    const u = findUser(d.id); if (!u || !(await Modal.confirm(`New password for ${u.name}?`, 'The old password will stop working and they will be signed out.', 'Make new password'))) return;
    try { const r = await Auth.call('admin_reset_password', { p_id: u.id }); showCreds([{ name: u.name, id: u.id, password: r.password }], u.role); } catch (e) { toast(e.message, 'error'); }
  },
  toggle: async (d) => {
    const u = findUser(d.id); if (!u) return;
    if (await run(() => Auth.call('admin_set_active', { p_id: u.id, p_active: u.active === false }))) { await reloadFor(u.role); render(); }
  },
  del: async (d) => {
    const u = findUser(d.id);
    const msg = u && u.role === 'student' ? `${u.id} won’t be able to sign in, and this Student ID will never be given to anyone else. Past orders stay in the records.` : `${u && u.id} won’t be able to sign in any more. Past orders stay in the records.`;
    if (!u || !(await Modal.confirm(`Delete ${u.name}?`, msg, 'Delete account', true))) return;
    if (await run(() => Auth.call('admin_delete_user', { p_id: u.id }), 'Account deleted')) { await reloadFor(u.role); render(); }
  },
  'rm-id': async (d) => { if (await run(() => Auth.call('admin_remove_ids', { p_ids: [d.id] }), 'ID removed')) { await reloadFor('student'); render(); } },
  logout: async () => { if (await Modal.confirm('Sign out?', 'You will need to sign in again.', 'Sign out')) { Auth.logout(); location.replace('../index.html'); } },
};
document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el) Actions[el.dataset.act]?.(el.dataset, el); });
document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'acc-q') { V.q = e.target.value; render(); }
  if (e.target.dataset.input === 'id-q') { V.idq = e.target.value; render(); }
});
document.addEventListener('change', async (e) => {
  const t = e.target, map = { site: 'websiteOpen', orders: 'ordersOpen', preorder: 'preorderOn', cutoff: 'cutoffOn' }, k = map[t.dataset.change];
  if (!k) return;
  const ok = await run(() => saveSettings({ [k]: t.checked }), t.checked ? 'Turned on' : 'Turned off');
  render();
  if (!ok) await run(() => Auth.sync(true)).then(render);
});

const Forms = {
  async schedule(f) {
    const fd = new FormData(f), err = $('#sched-err'), a = fd.get('opensAt'), b = fd.get('cutoffAt');
    if (b <= a) { err.textContent = 'The cut-off must be later than the opening time.'; return; }
    try { await saveSettings({ opensAt: a, cutoffAt: b, notice: fd.get('notice').trim() }); } catch (e) { err.textContent = e.message; return; }
    toast('Schedule saved'); render();
  },
  async mail(f) {
    const fd = new FormData(f), err = $('#mail-err');
    try { await Auth.call('admin_mail_set', { p_url: fd.get('url').trim(), p_secret: fd.get('secret') }); } catch (e) { err.textContent = e.message; return; }
    await run(loadMail); toast('Email settings saved. Now send a test email.'); render();
  },
  async mailtest(f) {
    const fd = new FormData(f), err = $('#test-err'), btn = f.querySelector('button'); btn.disabled = true;
    try { await Auth.call('admin_mail_test', { p_to: fd.get('to').trim() }); } catch (e) { err.textContent = e.message; btn.disabled = false; return; }
    await run(loadMail); toast('Test email sent. Check the inbox (and Spam).'); render();
  },
  async genids(f) {
    const n = +new FormData(f).get('count'), btn = f.querySelector('button'); btn.disabled = true;
    try {
      const r = await Auth.call('admin_generate_ids', { p_count: n });
      await Promise.all([loadIds(), loadCounts()]); toast(`Created ${r.from}${r.count > 1 ? ' to ' + r.to : ''}`); render();
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  },
  async create(f) {
    const role = V.tab, btn = f.querySelector('button'), fd = new FormData(f);
    const rows = String(fd.get('names')).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 200).map((l) => ({ name: l.split(',')[0].trim() })).filter((r) => r.name.length >= 2);
    if (!rows.length) return toast('Type at least one name.', 'error');
    btn.disabled = true;
    try {
      const out = await Auth.call('admin_create_users', { p_role: role, p_rows: rows, p_expires: role === 'staff' ? fd.get('expires') || null : null });
      await Promise.all([loadUsers(role), loadCounts()]); render(); showCreds(out, role);
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  },
  async expiry(f) {
    const ids = f.dataset.ids.split('|'), date = new FormData(f).get('date') || null, err = $('#exp-err');
    try { await Auth.call('admin_set_expiry', { p_ids: ids, p_date: date }); } catch (e) { err.textContent = e.message; return; }
    Modal.close(); await run(() => Promise.all([loadIds(), loadUsers(V.tab)])); toast(date ? 'Auto-delete date saved' : 'Auto-delete date cleared'); render();
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
/* keep things fresh: settings on the dashboard, and who is using the IDs */
setInterval(async () => {
  if (!me() || $('.scrim') || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  try {
    if (V.page === 'dashboard') { const r = await Auth.sync(); if (r.changed) render(); }
    if (V.page === 'ids') { await loadIds(); render(); }
  } catch {}
}, 15000);

(async () => {
  if (!me()) { location.replace('../index.html'); return; }
  $('#app').innerHTML = '<p class="mute" style="padding:2rem">Loading…</p>';
  try { await Promise.all([Auth.sync(true), loadCounts(), loadMail()]); }
  catch (e) { $('#app').innerHTML = `<div class="empty" style="margin:2rem"><strong>Can’t load the admin page</strong>${esc(e.message)}<br><br><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>`; return; }
  render();
})();

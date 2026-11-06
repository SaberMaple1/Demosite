/* =========================================================
   pages.js — turns data into HTML. No event wiring here;
   buttons carry data-act="..." and app.js handles them.
   ========================================================= */

/* Screen state that survives re-renders */
const View = {
  page: 'dashboard',
  orderFilter: 'active',   // active | done | all
  q: '',                   // menu search
  cat: '',                 // menu category filter
  salesDate: todayKey(),
  profileTab: 'info',      // info | security | design
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'menu', label: 'Menu', icon: 'grid' },
  { id: 'categories', label: 'Categories', icon: 'tag' },
  { id: 'sales', label: 'Sales', icon: 'chart' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

/*   Shared bits   */
function stockBadge(n) {
  if (n <= 0) return '<span class="stock stock-out">Sold out</span>';
  if (n <= LOW_STOCK) return `<span class="stock stock-low">Low, ${n} left</span>`;
  return `<span class="stock stock-ok">${n} in stock</span>`;
}
const stockTone = (n) => (n <= 0 ? 'out' : n <= LOW_STOCK ? 'low' : 'ok');

function statusChip(status) {
  const cls = status === STATUS.PENDING ? 'pending' : status === STATUS.DONE ? 'done' : 'ready';
  return `<span class="chip chip-${cls}">${esc(status)}</span>`;
}

function initials(name) { return (name || 'A').trim().charAt(0).toUpperCase(); }
function avatarHtml(admin, extra = '') {
  return `<span class="avatar ${extra}">${admin.photo ? `<img src="${admin.photo}" alt="">` : esc(initials(admin.name))}</span>`;
}

/*   Login   */
function loginPage() {
  return `
  <section class="login">
    <div class="login-art">
      <div class="light-rays" data-light-rays='{"raysOrigin":"top-center","raysColor":"#ffffff","raysSpeed":1,"lightSpread":0.5,"rayLength":3,"glow":0.6,"haze":0.25,"followMouse":true,"mouseInfluence":0.1}'></div>
      <img class="logo logo-lg" src="pickago_Logo.png" alt="Pickago">
      <h2>Fresh orders, ready when students are.</h2>
    </div>
    <div class="login-form">
      <form data-form="login" autocomplete="on">
        <h1>Canteen portal</h1>
        <p class="mute" style="margin-bottom:1.5rem">Sign in to manage the menu, stock and orders.</p>
        <label class="field"><span>Username</span><input name="u" autocomplete="username" required></label>
        <label class="field"><span>Password</span>
          <div class="pw-wrap"><input name="p" type="password" autocomplete="current-password" required>
          <button type="button" data-act="toggle-pw">Show</button></div>
        </label>
        <p class="error-text" id="login-err" role="alert"></p>
        <button class="btn btn-primary btn-block">Sign in</button>
      </form>
    </div>
  </section>`;
}

/*   Orders   */
const NEXT_STEP = {
  [STATUS.PENDING]: [STATUS.READY, 'Mark ready'],
  [STATUS.READY]: [STATUS.DONE, 'Mark picked up'],
};

function orderCard(o) {
  const next = NEXT_STEP[o.status];
  return `
  <article class="order">
    <div class="order-top"><span><strong>${esc(o.id)}</strong> <span class="mute">${esc(o.date || '')}</span></span>${statusChip(o.status)}</div>
    <p class="order-student">${esc(o.student || 'Student')}</p>
    <ul>${o.items.map((i) => `<li>${esc(i.qty)}× ${esc(i.name)}</li>`).join('')}</ul>
    ${o.note ? `<p class="note"><strong>Note:</strong> ${esc(o.note)}</p>` : ''}
    <div class="order-foot">
      <strong>${peso(o.total)}</strong>
      ${next ? `<button class="btn btn-primary btn-sm" data-act="order-next" data-id="${esc(o.id)}">${next[1]}</button>` : ''}
    </div>
  </article>`;
}

function ordersList() {
  const today = Store.orders.filter((o) => dayKey(orderDate(o)) === todayKey());
  const f = View.orderFilter;
  const list = today.filter((o) => f === 'all' || (f === 'done' ? o.status === STATUS.DONE : o.status !== STATUS.DONE));
  if (!list.length) {
    return `<div class="empty"><strong>${f === 'done' ? 'Nothing completed yet' : 'No orders waiting'}</strong>New student orders show up here automatically.</div>`;
  }
  return `<div class="orders">${list.map(orderCard).join('')}</div>`;
}

/*   Dashboard   */
function dashboardPage() {
  const today = Store.orders.filter((o) => dayKey(orderDate(o)) === todayKey());
  const count = (s) => today.filter((o) => o.status === s).length;
  const sales = today.filter((o) => o.status === STATUS.DONE).reduce((s, o) => s + Number(o.total || 0), 0);
  const needs = Store.food.filter((f) => f.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock);
  const seg = (id, label) => `<button data-act="order-filter" data-v="${id}" aria-pressed="${View.orderFilter === id}">${label}</button>`;

  return `
  <section class="stats">
    <div class="stat"><small>Today’s sales</small><strong>${peso(sales)}</strong><span class="mute">Completed orders only</span></div>
    <div class="stat"><small>Orders today</small><strong>${today.length}</strong><span class="mute">${count(STATUS.PENDING)} to prepare</span></div>
    <div class="stat"><small>Ready for pickup</small><strong>${count(STATUS.READY)}</strong><span class="mute">Waiting for students</span></div>
    <div class="stat ${needs.length ? 'warn' : ''}"><small>Low or sold out</small><strong>${needs.length}</strong><span class="mute">Items to restock</span></div>
  </section>
  <section class="split">
    <div>
      <div class="section-title"><h2>Today’s orders</h2>
        <div class="segmented" role="group" aria-label="Filter orders">${seg('active', 'Active')}${seg('done', 'Completed')}${seg('all', 'All')}</div>
      </div>
      <div id="orders-list">${ordersList()}</div>
    </div>
    <aside class="panel">
      <div class="panel-head"><h2>Needs restock</h2></div>
      ${needs.length ? `<div class="restock">${needs.map((f) => `
        <div class="restock-item">
          <div class="grow"><strong>${esc(f.name)}</strong>${stockBadge(f.stock)}</div>
          <button class="btn btn-sm" data-act="restock" data-id="${f.id}">Restock</button>
        </div>`).join('')}</div>` : '<p class="mute">Everything is well stocked.</p>'}
    </aside>
  </section>`;
}

/*   Menu management   */
function foodCard(f) {
  const tone = stockTone(f.stock);
  return `
  <article class="food ${tone}">
    <div class="food-media">${f.image ? `<img src="${f.image}" alt="${esc(f.name)}" loading="lazy">` : `<span aria-hidden="true">${esc(f.emoji)}</span>`}${stockBadge(f.stock)}</div>
    <div class="food-body">
      <h3>${esc(f.name)}</h3>
      <div class="food-meta"><span class="food-cat">${esc(f.cat)}</span><span class="food-price">${peso(f.price)}</span></div>
      <div class="stepper">
        <button class="btn" data-act="stock" data-id="${f.id}" data-d="-1" aria-label="Decrease stock of ${esc(f.name)}">−</button>
        <input type="number" min="0" inputmode="numeric" value="${f.stock}" data-change="stock-set" data-id="${f.id}" aria-label="Stock of ${esc(f.name)}">
        <button class="btn" data-act="stock" data-id="${f.id}" data-d="1" aria-label="Increase stock of ${esc(f.name)}">+</button>
      </div>
      <div class="food-actions">
        <button class="btn btn-sm" data-act="food-edit" data-id="${f.id}">${icon('edit')} Edit</button>
        <button class="btn btn-sm btn-danger btn-icon" data-act="food-delete" data-id="${f.id}" aria-label="Delete ${esc(f.name)}">${icon('trash')}</button>
      </div>
    </div>
  </article>`;
}

function foodGrid() {
  const q = View.q.trim().toLowerCase();
  const list = Store.food.filter((f) =>
    (!View.cat || f.cat === View.cat) && (!q || `${f.name} ${f.cat} ${f.desc}`.toLowerCase().includes(q)));
  if (!Store.food.length) return '<div class="empty"><strong>No food yet</strong>Use “Add food” to build the menu. Students will see it right away.</div>';
  if (!list.length) return '<div class="empty"><strong>No matches</strong>Try another name or category.</div>';
  return `<div class="food-grid">${list.map(foodCard).join('')}</div>`;
}

function menuPage() {
  return `
  <div class="toolbar">
    <label class="search">${icon('search')}<span class="sr">Search food</span><input type="search" placeholder="Search food" value="${esc(View.q)}" data-input="menu-q"></label>
    <select class="select" data-change="menu-cat" aria-label="Filter by category">
      <option value="">All categories</option>
      ${Store.categories().map((c) => `<option ${View.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>
    <button class="btn btn-primary" data-act="food-add">${icon('plus')} Add food</button>
  </div>
  <div id="food-grid">${foodGrid()}</div>`;
}

/* Add / edit form. `pendingImage`: undefined = keep, '' = removed, text = new. */
function foodFormHtml(f) {
  const isEdit = !!f.id;
  return `
  <form data-form="food" data-id="${f.id || ''}">
    <h2>${isEdit ? 'Edit food' : 'Add food'}</h2>
    <p class="mute" style="margin-bottom:1rem">Changes appear on the student menu right away.</p>
    <div class="photo-box">
      <div class="photo-prev" id="photo-prev">${f.image ? `<img src="${f.image}" alt="">` : esc(f.emoji)}</div>
      <div class="btns">
        <label class="btn btn-sm" style="cursor:pointer">${icon('camera')} ${f.image ? 'Change picture' : 'Upload picture'}
          <input type="file" accept="image/*" data-change="food-photo" class="sr"></label>
        <button type="button" class="btn btn-sm btn-danger" data-act="photo-remove" id="photo-remove" ${f.image ? '' : 'hidden'}>Remove picture</button>
      </div>
    </div>
    <label class="field"><span>Food name</span><input name="name" value="${esc(f.name)}" maxlength="60" required></label>
    <div class="row">
      <label class="field"><span>Price (PHP)</span><input name="price" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(f.price)}" required></label>
      <label class="field"><span>Stock</span><input name="stock" type="number" min="0" step="1" inputmode="numeric" value="${esc(f.stock)}" required></label>
    </div>
    <div class="row">
      <label class="field"><span>Category</span>
        <input name="cat" list="cat-options" value="${esc(f.cat)}" placeholder="Pick or type new" required>
        <datalist id="cat-options">${Store.categories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      </label>
      <label class="field"><span>Emoji</span><input name="emoji" value="${esc(f.emoji)}" maxlength="4"><small>Shown when there is no picture.</small></label>
    </div>
    <label class="field"><span>Description</span><textarea name="desc" rows="2" maxlength="140">${esc(f.desc)}</textarea></label>
    <p class="error-text" id="food-err" role="alert"></p>
    <div class="sheet-actions">
      <button type="button" class="btn" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary">${isEdit ? 'Save changes' : 'Add food'}</button>
    </div>
  </form>`;
}

/*   Categories   */
function categoriesPage() {
  const cats = Store.categories();
  return `
  <div class="toolbar"><p class="mute" style="flex:1">Categories organise the student menu.</p>
    <button class="btn btn-primary" data-act="cat-add">${icon('plus')} Add category</button></div>
  ${cats.length ? `<div class="cat-list">${cats.map((c) => {
    const n = Store.food.filter((f) => f.cat === c).length;
    return `<div class="cat-row"><div class="grow"><strong>${esc(c)}</strong><br><span class="mute">${n} item${n === 1 ? '' : 's'}</span></div>
      <button class="btn btn-sm" data-act="cat-rename" data-c="${esc(c)}">Rename</button>
      <button class="btn btn-sm btn-danger" data-act="cat-delete" data-c="${esc(c)}">Delete</button></div>`;
  }).join('')}</div>` : '<div class="empty"><strong>No categories yet</strong>Add one, then assign food to it.</div>'}`;
}

/*   Sales   */
function itemSales(orders) {
  const totals = {};
  orders.forEach((o) => o.items.forEach((i) => {
    const t = (totals[i.name] ??= { name: i.name, qty: 0, revenue: 0 });
    t.qty += Number(i.qty) || 0;
    t.revenue += (Number(i.qty) || 0) * (Number(i.price) || 0);
  }));
  return Object.values(totals).sort((a, b) => b.qty - a.qty);
}

function salesPage() {
  const forDay = (d) => Store.orders.filter((o) => dayKey(orderDate(o)) === d);
  const doneOf = (d) => forDay(d).filter((o) => o.status === STATUS.DONE);
  const revenue = (d) => doneOf(d).reduce((s, o) => s + Number(o.total || 0), 0);
  const day = View.salesDate;
  const allDone = Store.orders.filter((o) => o.status === STATUS.DONE);
  const top = itemSales(allDone);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 6 + i); return dayKey(d);
  });
  const values = days.map(revenue);
  const max = Math.max(1, ...values);
  const short = (d) => new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));
  const dayOrders = forDay(day);

  return `
  <div class="date-bar">
    <button class="btn btn-icon" data-act="sales-day" data-d="-1" aria-label="Previous day">${icon('left')}</button>
    <input type="date" value="${day}" data-change="sales-date" aria-label="Choose date">
    <button class="btn btn-icon" data-act="sales-day" data-d="1" aria-label="Next day">${icon('right')}</button>
    <span class="mute">${longDate(day)}</span>
  </div>
  <section class="stats">
    <div class="stat"><small>Revenue that day</small><strong>${peso(revenue(day))}</strong></div>
    <div class="stat"><small>Orders that day</small><strong>${dayOrders.length}</strong><span class="mute">${doneOf(day).length} completed</span></div>
    <div class="stat"><small>All-time revenue</small><strong>${peso(allDone.reduce((s, o) => s + Number(o.total || 0), 0))}</strong></div>
    <div class="stat"><small>Best seller</small><strong style="font-size:1.1rem">${top[0] ? esc(top[0].name) : 'None yet'}</strong><span class="mute">${top[0] ? top[0].qty + ' sold' : 'Complete an order first'}</span></div>
  </section>
  <section class="split" style="margin-bottom:1.25rem">
    <div class="panel"><h2>Last 7 days</h2>
      <div class="chart" role="img" aria-label="Revenue for the 7 days ending ${longDate(day)}">
        ${days.map((d, i) => `<div class="chart-col"><span>${peso(values[i])}</span><i class="${i === 6 ? 'today' : ''}" style="height:${Math.max(3, values[i] / max * 150)}px"></i></div>`).join('')}
      </div>
      <div class="chart-days">${days.map((d) => `<small>${short(d)}</small>`).join('')}</div>
    </div>
    <div class="panel"><h2 style="margin-bottom:1rem">Top sellers</h2>
      ${top.length ? `<ol class="rank">${top.slice(0, 5).map((t) => `<li><span>${esc(t.name)}</span><strong>${t.qty} sold</strong></li>`).join('')}</ol>` : '<p class="mute">No completed sales yet.</p>'}
    </div>
  </section>
  <section><div class="section-title"><h2>Orders on ${longDate(day)}</h2></div>
    ${dayOrders.length ? `<div class="orders">${dayOrders.map(orderCard).join('')}</div>` : '<div class="empty"><strong>No orders</strong>Nothing was ordered on this date.</div>'}
  </section>`;
}

/*   Profile: Information / Security / Design   */
function profilePage() {
  const a = Store.admin;
  const tabs = [['info', 'Information', 'info'], ['security', 'Security', 'lock'], ['design', 'Design', 'palette']];
  return `
  <div class="profile-grid">
    <div class="side-tabs" role="tablist">
      ${tabs.map(([id, label, ic]) => `<button role="tab" data-act="profile-tab" data-v="${id}" aria-selected="${View.profileTab === id}">${icon(ic)} ${label}</button>`).join('')}
    </div>
    <section class="panel">${profileTab(a)}</section>
  </div>`;
}

function profileTab(a) {
  if (View.profileTab === 'security') {
    return `
    <form data-form="password" class="form-box">
      <h2 style="margin-bottom:1rem">Change password</h2>
      <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
      <label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" minlength="8" data-input="pw-strength" required>
        <div class="strength" aria-hidden="true"><i id="pw-bar"></i></div><small id="pw-hint">At least 8 characters. Mix letters, numbers and symbols.</small></label>
      <label class="field"><span>Confirm new password</span><input name="confirm" type="password" autocomplete="new-password" required></label>
      <p class="error-text" id="pw-err" role="alert"></p>
      <button class="btn btn-primary">Update password</button>
      <hr>
      <h2 style="margin-bottom:.8rem">Sessions</h2>
      <label class="field"><span>Sign out automatically after</span>
        <select data-change="idle">${[[0, 'Never'], [15, '15 minutes of inactivity'], [30, '30 minutes of inactivity'], [60, '1 hour of inactivity']].map(([v, l]) => `<option value="${v}" ${a.idleMinutes === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="mute" style="margin-bottom:1rem">Last sign-in: ${a.lastLogin ? esc(new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.lastLogin))) : 'This is your first sign-in'}</p>
      <button type="button" class="btn btn-danger" data-act="logout">${icon('logout')} Sign out</button>
    </form>`;
  }

  if (View.profileTab === 'design') {
    const opt = (key, val, label, extra = '') => `<button class="option" data-act="pref" data-k="${key}" data-v="${val}" aria-pressed="${String(a[key]) === String(val)}">${extra}${label}</button>`;
    const sw = (c) => `<span class="swatch" style="background:${c}"></span>`;
    return `
    <div class="form-box">
      <h2 style="margin-bottom:1rem">Appearance</h2>
      <p style="font-weight:700;margin-bottom:.5rem">Theme</p>
      <div class="options">${opt('theme', 'light', 'Light')}${opt('theme', 'dark', 'Dark')}</div>
      <p style="font-weight:700;margin-bottom:.5rem">Accent colour</p>
      <div class="options">${opt('accent', 'ube', 'Ube', sw('#4b2e83'))}${opt('accent', 'teal', 'Teal', sw('#0f6b66'))}${opt('accent', 'tomato', 'Tomato', sw('#b8341f'))}${opt('accent', 'forest', 'Forest', sw('#1f6b3a'))}</div>
      <p style="font-weight:700;margin-bottom:.5rem">Text size</p>
      <div class="options">${opt('size', 'normal', 'Normal')}${opt('size', 'large', 'Large')}</div>
      <p class="mute">Saved on this device and applied instantly.</p>
    </div>`;
  }

  return `
  <form data-form="info" class="form-box">
    <div class="profile-head">${avatarHtml(a, 'xl')}
      <div style="display:grid;gap:.4rem">
        <label class="btn btn-sm" style="cursor:pointer">${icon('camera')} Change photo<input type="file" accept="image/*" data-change="avatar" class="sr"></label>
        ${a.photo ? '<button type="button" class="btn btn-sm btn-danger" data-act="avatar-remove">Remove photo</button>' : ''}
      </div>
    </div>
    <div class="row">
      <label class="field"><span>Full name</span><input name="name" value="${esc(a.name)}" required></label>
      <label class="field"><span>Role</span><input name="role" value="${esc(a.role)}" required></label>
    </div>
    <label class="field"><span>Username</span><input value="${esc(a.username)}" readonly><small>Username can’t be changed.</small></label>
    <div class="row">
      <label class="field"><span>Email</span><input name="email" type="email" value="${esc(a.email)}" placeholder="name@school.edu"></label>
      <label class="field"><span>Phone</span><input name="phone" type="tel" value="${esc(a.phone)}" placeholder="09xx xxx xxxx"></label>
    </div>
    <button class="btn btn-primary">Save information</button>
  </form>`;
}

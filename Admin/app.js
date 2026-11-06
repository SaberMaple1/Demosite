
let pendingImage;       // food photo in the open form (undefined = unchanged)
let lastActivity = Date.now();

/*  Rendering  */
const PAGES = { dashboard: dashboardPage, menu: menuPage, categories: categoriesPage, sales: salesPage, profile: profilePage };

function applyPrefs() {
  const root = document.documentElement;
  root.dataset.theme = Store.admin.theme;
  root.dataset.accent = Store.admin.accent;
  root.dataset.size = Store.admin.size;
}

function navButtons() {
  return NAV.map((n) => `<button class="nav-btn" data-act="nav" data-page="${n.id}" ${View.page === n.id ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></button>`).join('');
}

function render() {
  const y = window.scrollY;
  const app = $('#app');
  if (!Store.isSignedIn()) { app.innerHTML = loginPage(); return; }

  const title = NAV.find((n) => n.id === View.page).label;
  app.innerHTML = `
  <div class="shell">
    <aside class="rail">
      <div class="brand"><img class="logo" src="pickago_Logo.png" alt="">Pickago</div>
      <nav aria-label="Main">${navButtons()}</nav>
      <p class="rail-foot">Canteen portal</p>
    </aside>
    <div class="main">
      <header class="top">
        <h1>${title}</h1>
        <button class="me" data-act="nav" data-page="profile" aria-label="Open profile">${avatarHtml(Store.admin)}<span>${esc(Store.admin.name)}</span></button>
      </header>
      <main class="content" id="view">${PAGES[View.page]()}</main>
    </div>
    <nav class="tabbar" aria-label="Main">${navButtons()}</nav>
  </div>`;
  window.scrollTo(0, y);
}

/*  Data changes (all go through Store.change*)  */
function saveFailed() { toast('Could not save. Browser storage is full, try a smaller photo.', 'error'); }

function setStock(id, value) {
  const n = Math.max(0, Math.floor(Number(value)) || 0);
  const ok = Store.changeFood((list) => { const f = list.find((x) => x.id === id); if (f) f.stock = n; });
  ok ? render() : saveFailed();
}

function openFoodForm(id) {
  const blank = { id: 0, name: '', desc: '', cat: View.cat || Store.categories()[0] || '', price: '', stock: '', emoji: '🍽️', image: '' };
  const food = id ? Store.food.find((f) => f.id === id) : blank;
  if (!food) return;
  pendingImage = undefined;
  Modal.open(foodFormHtml(food));
}

async function saveFood(form) {
  const fd = new FormData(form);
  const id = Number(form.dataset.id) || 0;
  const err = $('#food-err');
  const name = fd.get('name').trim();
  const cat = fd.get('cat').trim();
  const price = Number(fd.get('price'));
  const stock = Math.floor(Number(fd.get('stock')));
  if (!name) { err.textContent = 'Enter a food name.'; return; }
  if (!cat) { err.textContent = 'Pick or type a category.'; return; }
  if (!(price >= 0)) { err.textContent = 'Price must be 0 or more.'; return; }
  if (!(stock >= 0)) { err.textContent = 'Stock must be 0 or more.'; return; }

  const ok = Store.changeFood((list) => {
    let f = id ? list.find((x) => x.id === id) : null;
    if (!f) { f = { id: Date.now(), image: '' }; list.push(f); }
    Object.assign(f, { name, cat, price, stock, desc: fd.get('desc').trim(), emoji: fd.get('emoji').trim() || '🍽️' });
    if (pendingImage !== undefined) f.image = pendingImage;
  });
  if (!ok) { err.textContent = 'Storage is full. Remove the picture or use a smaller one.'; return; }

  Modal.close();
  if (!id) { View.q = ''; View.cat = ''; }
  toast(id ? 'Food updated' : 'Food added');
  render();
}

/*  Click actions  */
const Actions = {
  nav: (d) => { View.page = d.page; render(); window.scrollTo(0, 0); },
  'toggle-pw': (d, el) => { const i = $('[name=p]'); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? 'Show' : 'Hide'; },
  'modal-close': () => Modal.close(),

  /* orders */
  'order-filter': (d) => { View.orderFilter = d.v; render(); },
  'order-next': (d) => {
    const ok = Store.changeOrders((list) => {
      const o = list.find((x) => x.id === d.id);
      if (o && NEXT_STEP[o.status]) o.status = NEXT_STEP[o.status][0];
    });
    ok ? (toast('Order updated'), render()) : saveFailed();
  },

  /* food */
  'food-add': () => openFoodForm(0),
  'food-edit': (d) => openFoodForm(Number(d.id)),
  'food-delete': async (d) => {
    const f = Store.food.find((x) => x.id === Number(d.id));
    if (!f || !(await Modal.confirm(`Delete ${f.name}?`, 'It will be removed from the student menu too.', 'Delete food', true))) return;
    Store.changeFood((list) => { list.splice(list.findIndex((x) => x.id === f.id), 1); });
    toast('Food deleted'); render();
  },
  stock: (d) => { const f = Store.food.find((x) => x.id === Number(d.id)); if (f) setStock(f.id, f.stock + Number(d.d)); },
  restock: async (d) => {
    const f = Store.food.find((x) => x.id === Number(d.id));
    const v = f && await Modal.prompt(`Restock ${f.name}`, 'New stock count', f.stock, { type: 'number', min: 0, okLabel: 'Update stock' });
    if (v !== null && v !== undefined && v !== false) setStock(f.id, v);
  },
  'photo-remove': () => {
    pendingImage = '';
    $('#photo-prev').textContent = $('[name=emoji]').value || '🍽️';
    $('#photo-remove').hidden = true;
  },

  /* categories */
  'cat-add': async () => {
    const name = await Modal.prompt('Add category', 'Category name', '', { okLabel: 'Add category' });
    if (!name) return;
    if (Store.categories().some((c) => c.toLowerCase() === name.toLowerCase())) return toast('That category already exists', 'error');
    Store.admin.extraCats.push(name); Store.saveAdmin();
    toast('Category added'); render();
  },
  'cat-rename': async (d) => {
    const name = await Modal.prompt('Rename category', 'New name', d.c, { okLabel: 'Rename' });
    if (!name || name === d.c) return;
    Store.changeFood((list) => list.forEach((f) => { if (f.cat === d.c) f.cat = name; }));
    Store.admin.extraCats = Store.admin.extraCats.map((c) => (c === d.c ? name : c)); Store.saveAdmin();
    toast('Category renamed'); render();
  },
  'cat-delete': async (d) => {
    const n = Store.food.filter((f) => f.cat === d.c).length;
    const text = n ? `${n} food item${n === 1 ? '' : 's'} in this category will be deleted from the menu.` : 'This category is empty.';
    if (!(await Modal.confirm(`Delete ${d.c}?`, text, 'Delete category', true))) return;
    Store.changeFood((list) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].cat === d.c) list.splice(i, 1); });
    Store.admin.extraCats = Store.admin.extraCats.filter((c) => c !== d.c); Store.saveAdmin();
    toast('Category deleted'); render();
  },

  /* sales */
  'sales-day': (d) => {
    const date = new Date(View.salesDate + 'T12:00:00'); date.setDate(date.getDate() + Number(d.d));
    View.salesDate = dayKey(date); render();
  },

  /* profile */
  'profile-tab': (d) => { View.profileTab = d.v; render(); },
  pref: (d) => {
    Store.admin[d.k] = d.k === 'idleMinutes' ? Number(d.v) : d.v;
    Store.saveAdmin(); applyPrefs(); render();
  },
  'avatar-remove': () => { Store.admin.photo = ''; Store.saveAdmin(); render(); toast('Photo removed'); },
  logout: async () => {
    if (!(await Modal.confirm('Sign out?', 'You will need to sign in again to manage the canteen.', 'Sign out'))) return;
    Store.signOut(); render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) Actions[el.dataset.act]?.(el.dataset, el);
});

/*  Input + change handlers  */
function passwordScore(v) {
  return [v.length >= 8, v.length >= 12, /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'menu-q') { View.q = t.value; $('#food-grid').innerHTML = foodGrid(); }
  if (t.dataset.input === 'pw-strength') {
    const s = passwordScore(t.value);
    const bar = $('#pw-bar');
    bar.style.width = `${s * 20}%`;
    bar.style.background = s <= 2 ? 'var(--out-bg)' : s === 3 ? 'var(--low-bg)' : 'var(--ok-ink)';
    $('#pw-hint').textContent = ['Too short', 'Weak', 'Weak', 'Okay', 'Strong', 'Very strong'][s];
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  switch (t.dataset.change) {
    case 'stock-set': setStock(Number(t.dataset.id), t.value); break;
    case 'menu-cat': View.cat = t.value; $('#food-grid').innerHTML = foodGrid(); break;
    case 'sales-date': if (t.value) { View.salesDate = t.value; render(); } break;
    case 'idle': Actions.pref({ k: 'idleMinutes', v: t.value }); break;
    case 'food-photo':
      try {
        pendingImage = await compressImage(t.files[0]);
        $('#photo-prev').innerHTML = `<img src="${pendingImage}" alt="">`;
        $('#photo-remove').hidden = false;
      } catch (err) { toast(err.message, 'error'); }
      break;
    case 'avatar':
      try {
        Store.admin.photo = await compressImage(t.files[0], 240);
        Store.saveAdmin() ? (toast('Photo updated'), render()) : saveFailed();
      } catch (err) { toast(err.message, 'error'); }
      break;
  }
});

/*  Form submits  */
const Forms = {
  login(form) {
    const fd = new FormData(form);
    const a = Store.admin;
    if (fd.get('u').trim() !== a.username || fd.get('p') !== a.password) {
      $('#login-err').textContent = 'Wrong username or password. Check them and try again.';
      return;
    }
    a.lastLogin = a.currentLogin || null;      // show the previous sign-in on the Security tab
    a.currentLogin = new Date().toISOString();
    Store.saveAdmin(); Store.signIn(); lastActivity = Date.now();
    View.page = 'dashboard'; render();
  },
  food: saveFood,
  info(form) {
    const fd = new FormData(form);
    Object.assign(Store.admin, { name: fd.get('name').trim(), role: fd.get('role').trim(), email: fd.get('email').trim(), phone: fd.get('phone').trim() });
    Store.saveAdmin(); toast('Information saved'); render();
  },
  password(form) {
    const fd = new FormData(form), err = $('#pw-err'), next = fd.get('next');
    if (fd.get('current') !== Store.admin.password) { err.textContent = 'Current password is incorrect.'; return; }
    if (next.length < 8) { err.textContent = 'New password needs at least 8 characters.'; return; }
    if (next === fd.get('current')) { err.textContent = 'Choose a password you haven’t used here before.'; return; }
    if (next !== fd.get('confirm')) { err.textContent = 'New passwords don’t match.'; return; }
    Store.admin.password = next; Store.saveAdmin();
    toast('Password updated'); form.reset(); err.textContent = '';
    $('#pw-bar').style.width = '0';
  },
};

document.addEventListener('submit', (e) => {
  const handler = Forms[e.target.dataset.form];
  if (handler) { e.preventDefault(); handler(e.target); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Modal.close(); });

/* ---------- Live sync with the student page (other tab)  */
window.addEventListener('storage', (e) => {
  if (e.key !== KEYS.food && e.key !== KEYS.orders) return;
  Store.loadShared();
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (Store.isSignedIn() && !typing && !$('.scrim')) render();
});

/* ---------- Auto sign-out when idle ---------- */
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  const mins = Store.admin.idleMinutes;
  if (Store.isSignedIn() && mins && Date.now() - lastActivity > mins * 60000) {
    Store.signOut(); Modal.close(); render(); toast('Signed out after inactivity');
  }
}, 20000);

/* ---------- Start ---------- */
Store.load();
applyPrefs();
render();

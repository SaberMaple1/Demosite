const LOW_STOCK = 5;
const STATUS = { PENDING: 'Pending', READY: 'Ready to Pick Up', DONE: 'Completed' };


function dayKey(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/* "Today" comes from the server (Philippine time). An order belongs to the day it is picked up, so
   pre-orders for tomorrow don't count as today's orders or sales. */
const todayKey = () => (Auth.data.settings && Auth.data.settings.today) || dayKey(new Date());
const orderDate = (o) => (o.pickupDate ? new Date(o.pickupDate + 'T12:00:00') : o.createdAt || new Date());

const DEFAULT_ADMIN = {
  name: 'Admin',
  role: 'Canteen Manager',
  username: 'admin',
  email: '',
  phone: '',
  photo: '',
  theme: 'light',
  accent: 'ube',
  size: 'normal',
  idleMinutes: 0,
  lastLogin: null,
};


/* Menu, orders and categories live on the server. Auth.sync() keeps a copy;
   Store.loadShared() hands that copy to the pages. Each staff member keeps
   their own look (theme, colour, text size) on their device. */
const Store = {
  food: [],
  orders: [],
  admin: { ...DEFAULT_ADMIN },

  read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },

  loadShared() { this.food = Auth.data.foods; this.orders = Auth.data.orders; },

  loadAdmin() {
    const u = Auth.current('staff') || {};
    const prefs = this.read('pickagoStaffPrefs:' + u.id, {});
    this.admin = { ...DEFAULT_ADMIN, ...prefs, name: u.name || 'Canteen Staff', role: 'Canteen Staff', username: u.id || '',
      phone: u.phone || '', photo: u.photo || '', lastLogin: u.lastLogin || null };
  },
  async load() {
    if (!Auth.current('staff')) { location.replace('../index.html'); return false; }
    await Auth.sync(true); this.loadShared(); this.loadAdmin(); return true;
  },

  /* only the personal look is stored on this device */
  saveAdmin() {
    const u = Auth.current('staff'); if (!u) return true;
    const { name, role, username, phone, photo, lastLogin, ...prefs } = this.admin;
    return this.write('pickagoStaffPrefs:' + u.id, prefs);
  },

  categories() {
    const used = this.food.map((f) => f.cat);
    return [...new Set([...used, ...Auth.data.cats])].filter(Boolean).sort();
  },

  isSignedIn() { return !!Auth.current('staff'); },
  signOut() { Auth.logout(); location.replace('../index.html'); },
};

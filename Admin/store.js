const LOW_STOCK = 5;
const STATUS = { PENDING: 'Pending', READY: 'Ready to Pick Up', DONE: 'Completed' };


function dayKey(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const todayKey = () => dayKey(new Date());
const orderDate = (o) => o.createdAt || new Date();

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
  extraCats: [],
  lastLogin: null,
};

function seedFood() {
  return [
    { id: 1, name: 'Chicken Adobo Rice Bowl', desc: 'Soy-vinegar braised chicken over rice.', cat: 'Meals', price: 75, stock: 12, emoji: '🍗', image: '' },
    { id: 2, name: 'Veggie Lumpia', desc: 'Crispy rolls with sweet chili dip.', cat: 'Snacks', price: 35, stock: 8, emoji: '🥬', image: '' },
    { id: 3, name: 'Spaghetti with Hotdog', desc: 'Sweet-style spaghetti, sliced hotdog.', cat: 'Meals', price: 60, stock: 4, emoji: '🍝', image: '' },
    { id: 4, name: 'Iced Calamansi Tea', desc: 'Cold tea with fresh calamansi.', cat: 'Drinks', price: 25, stock: 15, emoji: '🧋', image: '' },
    { id: 5, name: 'Ube Cheese Pandesal', desc: 'Soft ube bread with melted cheese.', cat: 'Desserts', price: 30, stock: 3, emoji: '🍞', image: '' },
    { id: 6, name: 'Banana Cue', desc: 'Caramelized fried saba banana.', cat: 'Snacks', price: 20, stock: 0, emoji: '🍌', image: '' },
  ];
}

const Store = {
  food: [],
  orders: [],
  admin: { ...DEFAULT_ADMIN },
  signedIn: false,
  ready: false,
  _unsubs: [],

  /* Data is live from Firebase, so these are kept only so older code still works. */
  loadShared() {}, loadAdmin() {}, load() {},
  saveFood() { return true; },
  saveOrders() { return true; },

  saveAdmin() {
    const { password, ...rest } = this.admin;
    db.collection('app').doc('adminProfile').set(rest, { merge: true }).catch(() => toast('Could not save. Check your internet.', 'error'));
    return true;
  },

  /* Run fn on the list, then send only what changed to Firebase. */
  _push(col, list, fn, idOf) {
    const before = new Map(list.map((x) => [idOf(x), JSON.stringify(x)]));
    fn(list);
    const batch = db.batch();
    const now = new Set();
    list.forEach((x) => {
      const id = idOf(x); now.add(id);
      if (before.get(id) !== JSON.stringify(x)) batch.set(db.collection(col).doc(id), JSON.parse(JSON.stringify(x)));
    });
    before.forEach((_, id) => { if (!now.has(id)) batch.delete(db.collection(col).doc(id)); });
    batch.commit().catch(() => toast('Could not save. Check your internet (or photo size).', 'error'));
    return true;
  },
  changeFood(fn) { return this._push('food', this.food, fn, (f) => String(f.id)); },
  changeOrders(fn) { return this._push('orders', this.orders, fn, (o) => String(o.id).replace('#', '')); },

  categories() {
    const used = this.food.map((f) => f.cat);
    return [...new Set([...used, ...(this.admin.extraCats || [])])].filter(Boolean).sort();
  },

  isSignedIn() { return this.signedIn; },
  signOut() { auth.signOut(); },

  _start() {
    this._stop();
    const bad = (e) => console.error(e);
    const changed = () => { if (typeof onRemoteChange === 'function') onRemoteChange(); };
    this._unsubs.push(db.collection('food').onSnapshot((s) => {
      this.food = s.docs.map((d) => d.data()).map((f) => ({
        desc: '', image: '', emoji: '🍽️', ...f,
        price: Number(f.price) || 0, stock: Math.max(0, Number(f.stock) || 0),
      })).sort((a, b) => a.id - b.id);
      changed();
    }, bad));
    this._unsubs.push(db.collection('orders').onSnapshot((s) => {
      this.orders = s.docs.map((d) => d.data()).map((o) => ({
        ...o,
        items: Array.isArray(o.items) ? o.items : [{ name: String(o.items || 'Item'), qty: 1, price: Number(o.total) || 0 }],
      })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      changed();
    }, bad));
    this._unsubs.push(db.collection('app').doc('adminProfile').onSnapshot((s) => {
      if (!s.exists) {
        if (s.metadata.fromCache) return;
        /* very first admin sign-in: create the profile and the starter menu */
        const b = db.batch();
        b.set(s.ref, { ...DEFAULT_ADMIN, email: auth.currentUser.email });
        seedFood().forEach((f) => b.set(db.collection('food').doc(String(f.id)), f));
        b.commit().catch(bad);
        return;
      }
      this.admin = { ...DEFAULT_ADMIN, ...s.data() };
      if (typeof applyPrefs === 'function') applyPrefs();
      changed();
    }, bad));
  },
  _stop() { this._unsubs.forEach((u) => u()); this._unsubs = []; },
};

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
auth.onAuthStateChanged((u) => {
  Store.ready = true;
  if (u && isAdminEmail(u.email)) {
    Store.signedIn = true;
    Store._start();
  } else {
    Store.signedIn = false;
    Store._stop();
    Store.food = []; Store.orders = [];
    if (u) auth.signOut();
  }
  if (typeof render === 'function') render();
});

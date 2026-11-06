const KEYS = {
  food: 'pickagoLiveFood',
  orders: 'pickagoLiveOrders',
  admin: 'pickagoAdminProfile',
  session: 'pickagoStaffSession',
};

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
  password: 'admin123',
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

function seedOrders() {
  const ago = (min) => new Date(Date.now() - min * 60000);
  const time = (d) => new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(d);
  const make = (id, student, items, status, min, note) => {
    const d = ago(min);
    return {
      id, student, items, status, note,
      total: items.reduce((s, i) => s + i.qty * i.price, 0),
      createdAt: d.toISOString(),
      date: `Today, ${time(d)}`,
    };
  };
  return [
    make('#001', 'Alex Santos', [{ name: 'Chicken Adobo Rice Bowl', qty: 1, price: 75 }, { name: 'Iced Calamansi Tea', qty: 1, price: 25 }], STATUS.READY, 40, 'No onions, please.'),
    make('#002', 'Maria Cruz', [{ name: 'Veggie Lumpia', qty: 2, price: 35 }], STATUS.PENDING, 25, 'Extra sweet chili sauce.'),
    make('#003', 'Jon Reyes', [{ name: 'Spaghetti with Hotdog', qty: 1, price: 60 }], STATUS.DONE, 70, ''),
  ];
}

const Store = {
  food: [],
  orders: [],
  admin: { ...DEFAULT_ADMIN },

  read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch { return fallback; }
  },

  /* Returns false when the browser refuses (usually: storage full). */
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },

  /* Re-read food + orders so we never overwrite changes made by the
     student page (e.g. a brand new order). Call before every change. */
  loadShared() {
    let food = this.read(KEYS.food, null);
    let orders = this.read(KEYS.orders, null);
    if (!Array.isArray(food)) { food = seedFood(); this.write(KEYS.food, food); }
    if (!Array.isArray(orders)) { orders = seedOrders(); this.write(KEYS.orders, orders); }

    this.food = food.map((f) => ({
      desc: '', image: '', emoji: '🍽️',
      ...f,
      price: Number(f.price) || 0,
      stock: Math.max(0, Number(f.stock) || 0),
    }));
    this.orders = orders.map((o) => ({
      ...o,
      
      items: Array.isArray(o.items) ? o.items : [{ name: String(o.items || 'Item'), qty: 1, price: Number(o.total) || 0 }],
    }));
  },

  loadAdmin() {
    this.admin = { ...DEFAULT_ADMIN, ...this.read(KEYS.admin, {}) };
  },
  load() { this.loadShared(); this.loadAdmin(); },

  saveFood() { return this.write(KEYS.food, this.food); },
  saveOrders() { return this.write(KEYS.orders, this.orders); },
  saveAdmin() { return this.write(KEYS.admin, this.admin); },


  changeFood(fn) { this.loadShared(); fn(this.food); return this.saveFood(); },
  changeOrders(fn) { this.loadShared(); fn(this.orders); return this.saveOrders(); },

  categories() {
    const used = this.food.map((f) => f.cat);
    return [...new Set([...used, ...this.admin.extraCats])].filter(Boolean).sort();
  },

  
  isSignedIn() { return sessionStorage.getItem(KEYS.session) === '1'; },
  signIn() { sessionStorage.setItem(KEYS.session, '1'); },
  signOut() { sessionStorage.removeItem(KEYS.session); },
};

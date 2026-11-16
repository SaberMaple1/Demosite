/* auth.js — the link between every page and the Supabase database.
   Login, the menu, orders and the open/closed rules all come from the server. */
const Auth = (() => {
  const API = 'https://hdcehdwjumsexmueijjn.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_XYYoTcILfDGJBGMvwlERxA_aYR-Adic';   // public "publishable" key: safe to put in a website
  const LOGIN = (document.currentScript && document.currentScript.dataset.login) || 'index.html';
  const SK = 'pickagoSession';
  const data = { foods: [], cats: [], orders: [], settings: null, etag: '' };

  /* ---- session (students stay signed in on their device; staff/admin end when the tab closes) ---- */
  const session = () => { try { return JSON.parse(sessionStorage.getItem(SK) || localStorage.getItem(SK)); } catch { return null; } };
  const saveSession = (s) => { try { (s.role === 'student' ? localStorage : sessionStorage).setItem(SK, JSON.stringify(s)); } catch {} };
  const clearSession = () => { sessionStorage.removeItem(SK); localStorage.removeItem(SK); };
  const token = () => (session() || {}).token || '';
  const current = (role) => { const s = session(); return s && s.token && s.role === role ? { ...s.user } : null; };
  function expired() { clearSession(); location.replace(new URL(LOGIN, location.href).href); }

  /* ---- talking to the server ---- */
  async function rpc(fn, args = {}, opt = {}) {
    let res;
    try {
      res = await fetch(API + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args), keepalive: !!opt.keepalive });
    } catch { throw new Error('Can’t reach the server. Check your internet and try again.'); }
    let body = null; try { body = await res.json(); } catch {}
    if (!res.ok) {
      const msg = (body && body.message) || 'Something went wrong. Please try again.';
      if (msg === 'AUTH') { expired(); throw new Error('Your session ended. Please log in again.'); }
      throw new Error(msg);
    }
    return body;
  }
  const call = (fn, args = {}) => rpc(fn, { p_token: token(), ...args });

  async function login(id, pw) {
    const r = await rpc('app_login', { p_id: id, p_pw: pw });
    if (!r.ok) return r;
    clearSession(); saveSession({ token: r.token, role: r.user.role, user: r.user });
    return { ok: true, role: r.user.role };
  }
  function logout() {
    const t = token(); clearSession();
    if (t) rpc('app_logout', { p_token: t }, { keepalive: true }).catch(() => {});
  }

  /* ---- shared data: menu, orders, settings (one request, nothing re-sent if unchanged) ---- */
  const dateFmt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  const normFood = (f) => ({ emoji: '🍽️', desc: '', image: '', ...f, price: +f.price || 0, stock: +f.stock || 0 });
  const normOrder = (o) => ({ ...o, total: +o.total || 0, items: Array.isArray(o.items) ? o.items : [], date: dateFmt.format(new Date(o.createdAt)) });
  async function sync(force) {
    const r = await rpc('sync_all', { p_token: token(), p_etag: force ? '' : data.etag });
    const s = session(); if (s) { s.user = r.me; saveSession(s); }
    let changed = JSON.stringify(r.settings) !== JSON.stringify(data.settings);
    data.settings = r.settings;
    if (!r.same) {
      data.foods = r.foods.map(normFood); data.cats = r.cats; data.orders = r.orders.map(normOrder); data.etag = r.etag; changed = true;
    }
    return { changed };
  }

  /* ---- profile + password ---- */
  async function updateProfile(patch) {
    const u = await call('update_profile', { p: patch });
    const s = session(); if (s) { s.user = u; saveSession(s); }
    return u;
  }
  const changePassword = (oldPw, newPw) => call('change_password', { p_old: oldPw, p_new: newPw });

  /* ---- ordering rules (decided by the server; shown here) ---- */
  const DEFAULTS = { websiteOpen: true, ordersOpen: true, preorderOn: true, cutoffOn: false, opensAt: '07:00', cutoffAt: '11:00', notice: '' };
  const settings = () => ({ ...DEFAULTS, ...(data.settings || {}) });
  const orderStatus = () => (data.settings && data.settings.status) || { open: false, pre: false, site: true, key: 'loading', msg: 'Checking if ordering is open…', preMsg: 'Checking if pre-orders are open…' };
  const fmt = (t) => { const [h, m] = String(t).split(':').map(Number); return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

  const dayLabel = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

  return { dayLabel, data, rpc, call, login, logout, expired, session, current, sync, updateProfile, changePassword, settings, orderStatus, fmt };
})();

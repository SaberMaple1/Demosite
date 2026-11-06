const A = {
  view: (d) => {
    S.view = d.v;
    render();
  },
  pw: (d, el) => {
    const i = el.parentElement.querySelector('input');
    i.type = i.type === 'password' ? 'text' : 'password';
    el.textContent = i.type === 'password' ? 'Show' : 'Hide';
  },
  nav: (d) => {
    S.page = d.p;
    render();
    scrollTo(0, 0);
  },
  cat: (d) => {
    S.cat = d.c;
    render();
  },
  add: (d) => addCart(+d.id, 1),
  qty: (d) => addCart(+d.id, +d.d),
  place: placeOrder,
  receipt: (d) => {
    S.receipt = d.id;
    S.page = 'receipt';
    render();
  },
  reorder: (d) => reorder(d.id),
  tab: (d) => {
    S.tab = d.t;
    render();
  },
  lrn: () => {
    S.showLrn = !S.showLrn;
    render();
  },
  mclose: () => {
    $('#modal').innerHTML = '';
  },
  rmphoto: () => {
    updateMe({ photo: '' });
    render();
  },
  logout: () =>
    ask('Log out?', 'You can log back in any time.', 'Log out', () => {
      localStorage.removeItem(K.ses);
      S.view = 'login';
      S.cart = [];
      render();
    }),
  delacc: () =>
    ask(
      'Delete your account?',
      'This can’t be undone on this device.',
      'Delete',
      () => {
        const m = me();
        wr(
          K.acc,
          accounts().filter((a) => a.email !== m.email),
        );
        localStorage.removeItem(K.ses);
        S.view = 'login';
        render();
        toast('Account deleted');
      },
      1,
    ),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (el) A[el.dataset.a]?.(el.dataset, el);
});
document.addEventListener('input', (e) => {
  const t = e.target,
    k = t.dataset.in;
  if (k === 'q') {
    S.q = t.value;
    $('#grid').innerHTML = grid();
  }
  if (k === 'note') S.note = t.value;
  if (k === 'meter') {
    const s = score(t.value);
    const b = $('#bar');
    b.style.width = s * 20 + '%';
    b.style.background = s <= 2 ? 'var(--out)' : s === 3 ? '#e0a100' : 'var(--ok)';
    $('#hint').textContent = ['Too short', 'Weak', 'Weak', 'Okay', 'Strong', 'Very strong'][s];
  }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.ch === 'idle') {
    updateMe({ idle: +t.value });
    toast('Saved');
  }
  if (t.dataset.ch === 'photo') {
    try {
      updateMe({ photo: await shrink(t.files[0]) });
      toast('Photo updated');
      render();
    } catch (x) {
      toast(x.message, 1);
    }
  }
});
const F = {
  login(f) {
    const d = new FormData(f),
      e = d.get('e').trim().toLowerCase(),
      err = $('#err');
    if (Date.now() < S.lock)
      return (err.textContent = `Too many tries. Wait ${Math.ceil((S.lock - Date.now()) / 1000)}s.`);
    const a = accounts().find((x) => x.email.toLowerCase() === e && x.password === d.get('p'));
    if (!a) {
      if (++S.fails >= 5) {
        S.lock = Date.now() + 30000;
        S.fails = 0;
      }
      return (err.textContent = 'Incorrect Gmail or password.');
    }
    S.fails = 0;
    wr(
      K.acc,
      accounts().map((x) =>
        x.email === a.email
          ? { ...x, lastLogin: x.loginAt || null, loginAt: new Date().toISOString() }
          : x,
      ),
    );
    localStorage.setItem(K.ses, a.email);
    S.view = 'app';
    S.page = 'menu';
    S.idleAt = Date.now();
    S.sig = '';
    render();
  },
  signup(f) {
    const d = new FormData(f),
      e = d.get('e').trim().toLowerCase(),
      n = d.get('n').trim(),
      l = d.get('l').trim(),
      p = d.get('p'),
      err = $('#err');
    if (!/^[^@\s]+@gmail\.com$/.test(e))
      return (err.textContent = 'Use a Gmail address (@gmail.com).');
    if (n.length < 3) return (err.textContent = 'Enter your real name.');
    if (!/^\d{12}$/.test(l)) return (err.textContent = 'LRN must be exactly 12 digits.');
    if (accounts().some((a) => a.email.toLowerCase() === e || a.lrn === l))
      return (err.textContent = 'An account already exists with this Gmail or LRN.');
    if (!pwOk(p, l))
      return (err.textContent =
        'Password needs 8+ characters, a capital letter, a number, a symbol, and can’t be your LRN.');
    if (p !== d.get('c')) return (err.textContent = 'Passwords don’t match.');
    wr(K.acc, [
      ...accounts(),
      { name: n, email: e, lrn: l, password: p, idle: 15, created: new Date().toISOString() },
    ]);
    localStorage.setItem(K.ses, e);
    S.view = 'app';
    S.page = 'menu';
    S.idleAt = Date.now();
    render();
  },
  forgot(f) {
    const d = new FormData(f),
      e = d.get('e').trim().toLowerCase(),
      err = $('#err');
    const a = accounts().find((x) => x.email.toLowerCase() === e && x.lrn === d.get('l').trim());
    if (!a) return (err.textContent = 'We couldn’t match that Gmail and LRN.');
    if (!pwOk(d.get('p'), a.lrn))
      return (err.textContent =
        'Password needs 8+ characters, a capital letter, a number and a symbol.');
    wr(
      K.acc,
      accounts().map((x) => (x === a || x.email === a.email ? { ...x, password: d.get('p') } : x)),
    );
    S.view = 'login';
    render();
    toast('Password reset. Please log in.');
  },
  info(f) {
    const d = new FormData(f);
    const n = d.get('n').trim();
    if (n.length < 3) return toast('Enter your real name', 1);
    updateMe({ name: n, phone: d.get('ph').trim(), section: d.get('sec').trim() });
    toast('Information saved');
    render();
  },
  pw(f) {
    const d = new FormData(f),
      m = me(),
      err = $('#err'),
      n = d.get('n');
    if (d.get('c') !== m.password) return (err.textContent = 'Current password is incorrect.');
    if (n === m.password) return (err.textContent = 'Choose a different password.');
    if (!pwOk(n, m.lrn))
      return (err.textContent =
        'Needs 8+ characters, a capital letter, a number, a symbol, and can’t be your LRN.');
    if (n !== d.get('k')) return (err.textContent = 'Passwords don’t match.');
    updateMe({ password: n });
    f.reset();
    err.textContent = '';
    $('#bar').style.width = '0';
    toast('Password updated');
  },
};
document.addEventListener('submit', (e) => {
  const h = F[e.target.dataset.f];
  if (h) {
    e.preventDefault();
    h(e.target);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') A.mclose();
});
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, () => (S.idleAt = Date.now()), { passive: true }),
);

const sig = () =>
  (localStorage.getItem(K.food) || '') + '|' + (localStorage.getItem(K.orders) || '');
function sync() {
  const s = sig();
  if (s === S.sig) return;
  S.sig = s;
  if (S.view !== 'app' || !me()) return;
  myOrders().forEach((o) => {
    if (S.seen[o.id] && S.seen[o.id] !== o.status)
      toast(
        o.status === 'Ready to Pick Up'
          ? `Order ${o.id} is ready to pick up! 🎉`
          : `Order ${o.id} is now ${o.status}`,
      );
    S.seen[o.id] = o.status;
  });
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (!typing && !$('.scrim')) render();
}
addEventListener('storage', sync);
setInterval(sync, 1500);
setInterval(() => {
  const m = me();
  if (m && +m.idle && Date.now() - S.idleAt > m.idle * 60000) {
    localStorage.removeItem(K.ses);
    S.view = 'login';
    render();
    toast('Logged out after inactivity');
  }
}, 15000);

if (me()) S.view = 'app';
S.sig = sig();
myOrders().forEach((o) => (S.seen[o.id] = o.status));
render();

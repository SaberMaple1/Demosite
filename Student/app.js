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
      auth.signOut();
    }),
  delacc: () =>
    ask(
      'Delete your account?',
      'This can’t be undone.',
      'Delete',
      async () => {
        const m = me(),
          u = auth.currentUser;
        const copy = { ...m };
        delete copy.uid;
        try {
          const b = db.batch();
          b.delete(db.collection('students').doc(m.uid));
          b.delete(db.collection('lrns').doc(m.lrn));
          await b.commit();
          try {
            await u.delete();
          } catch (x) {
            const r = db.batch();
            r.set(db.collection('students').doc(m.uid), copy);
            r.set(db.collection('lrns').doc(m.lrn), { uid: m.uid });
            await r.commit();
            throw x;
          }
          toast('Account deleted');
        } catch (x) {
          toast(
            x.code === 'auth/requires-recent-login'
              ? 'For safety, log out, log back in, then try again.'
              : 'Could not delete. Try again.',
            1,
          );
        }
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
  async login(f) {
    const d = new FormData(f),
      e = d.get('e').trim().toLowerCase(),
      err = $('#err');
    if (Date.now() < S.lock)
      return (err.textContent = `Too many tries. Wait ${Math.ceil((S.lock - Date.now()) / 1000)}s.`);
    err.textContent = 'Logging in…';
    try {
      const c = await auth.signInWithEmailAndPassword(e, d.get('p'));
      S.fails = 0;
      S.idleAt = Date.now();
      const r = db.collection('students').doc(c.user.uid);
      r.get()
        .then((sn) =>
          r.set(
            { lastLogin: (sn.data() || {}).loginAt || null, loginAt: new Date().toISOString() },
            { merge: true },
          ),
        )
        .catch(() => {});
    } catch (x) {
      if (++S.fails >= 5) {
        S.lock = Date.now() + 30000;
        S.fails = 0;
      }
      err.textContent = fbErr(x);
    }
  },
  async signup(f) {
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
    if (!pwOk(p, l))
      return (err.textContent =
        'Password needs 8+ characters, a capital letter, a number, a symbol, and can’t be your LRN.');
    if (p !== d.get('c')) return (err.textContent = 'Passwords don’t match.');
    err.textContent = 'Creating your account…';
    let c;
    try {
      c = await auth.createUserWithEmailAndPassword(e, p);
    } catch (x) {
      return (err.textContent = fbErr(x));
    }
    try {
      const b = db.batch();
      b.set(db.collection('lrns').doc(l), { uid: c.user.uid });
      b.set(db.collection('students').doc(c.user.uid), {
        name: n,
        email: e,
        lrn: l,
        idle: 15,
        created: new Date().toISOString(),
      });
      await b.commit();
      S.idleAt = Date.now();
    } catch (x) {
      await c.user.delete().catch(() => {});
      await auth.signOut().catch(() => {});
      toast('An account already exists with this LRN.', 1);
    }
  },
  async forgot(f) {
    const e = new FormData(f).get('e').trim().toLowerCase(),
      err = $('#err');
    try {
      await auth.sendPasswordResetEmail(e);
    } catch (x) {
      if (x.code !== 'auth/user-not-found') return (err.textContent = fbErr(x));
    }
    S.view = 'login';
    render();
    toast('If that Gmail has an account, a reset link was sent. Check your inbox and spam.');
  },
  info(f) {
    const d = new FormData(f);
    const n = d.get('n').trim();
    if (n.length < 3) return toast('Enter your real name', 1);
    updateMe({ name: n, phone: d.get('ph').trim(), section: d.get('sec').trim() });
    toast('Information saved');
    render();
  },
  async pw(f) {
    const d = new FormData(f),
      m = me(),
      err = $('#err'),
      n = d.get('n'),
      cur = d.get('c');
    if (n === cur) return (err.textContent = 'Choose a different password.');
    if (!pwOk(n, m.lrn))
      return (err.textContent =
        'Needs 8+ characters, a capital letter, a number, a symbol, and can’t be your LRN.');
    if (n !== d.get('k')) return (err.textContent = 'Passwords don’t match.');
    try {
      const u = auth.currentUser;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, cur));
      await u.updatePassword(n);
    } catch (x) {
      return (err.textContent = ['auth/invalid-credential', 'auth/wrong-password'].includes(x.code)
        ? 'Current password is incorrect.'
        : fbErr(x));
    }
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
    auth.signOut();
    toast('Logged out after inactivity');
  }
}, 15000);

auth.onAuthStateChanged((u) => {
  if (!u) {
    stopData();
    C.me = null;
    C.food = [];
    C.orders = [];
    S.cart = [];
    S.seen = {};
    if (S.view === 'app') S.view = 'login';
    render();
    return;
  }
  startData(u);
});

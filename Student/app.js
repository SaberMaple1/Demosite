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
  when: (d) => {
    S.when = d.v === 'tomorrow' ? 'tomorrow' : 'today';
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
  rmphoto: async () => {
    if (await updateMe({ photo: '' })) render();
  },
  logout: () =>
    ask('Log out?', 'You can log back in any time.', 'Log out', () => {
      Auth.logout();
      location.replace('../index.html');
    }),
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
    if (await updateMe({ idle: +t.value })) toast('Saved');
  }
  if (t.dataset.ch === 'photo') {
    try {
      if (await updateMe({ photo: await shrink(t.files[0]) })) {
        toast('Photo updated');
        render();
      }
    } catch (x) {
      toast(x.message, 1);
    }
  }
});
const F = {

  async info(f) {
    const d = new FormData(f);
    const n = d.get('n').trim();
    if (n.length < 3) return toast('Enter your real name', 1);
    if (await updateMe({ name: n, phone: d.get('ph').trim(), section: d.get('sec').trim() })) {
      toast('Information saved');
      render();
    }
  },
  async pw(f) {
    const d = new FormData(f),
      m = me(),
      err = $('#err'),
      n = d.get('n');
    if (n === d.get('c')) return (err.textContent = 'Choose a different password.');
    if (!pwOk(n, m.id))
      return (err.textContent =
        'Needs 8+ characters, a capital letter, a number, a symbol, and can’t be your Student No.');
    if (n !== d.get('k')) return (err.textContent = 'Passwords don’t match.');
    try {
      await Auth.changePassword(d.get('c'), n);
    } catch (x) {
      return (err.textContent = x.message);
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

/* Check the server every few seconds for menu, order and open/closed changes */
let syncing = false;
async function sync(force) {
  if (syncing || S.view !== 'app' || !me()) return;
  syncing = true;
  try {
    const r = await Auth.sync(force);
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
    if (r.changed && !typing && !$('.scrim')) render();
  } catch {}
  syncing = false;
}
setInterval(sync, 6000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
setInterval(() => {
  const m = me();
  if (m && +m.idle && Date.now() - S.idleAt > m.idle * 60000) {
    Auth.logout();
    location.replace('../index.html');
  }
}, 15000);

(async () => {
  if (!me()) { location.replace('../index.html'); return; }
  try { await Auth.sync(true); }
  catch (e) {
    $('#app').innerHTML = `<div class="closed-page"><h1>Can’t load the canteen</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  S.view = 'app';
  myOrders().forEach((o) => (S.seen[o.id] = o.status));
  render();
})();

const LABEL = { menu: 'Menu', cart: 'Cart', history: 'Orders', profile: 'Profile' };

function statusBanner() {
  const st = Auth.orderStatus(), set = Auth.settings();
  if (S.when === 'tomorrow')
    return st.pre
      ? `<div class="open-banner">Pre-ordering for <b>tomorrow, ${esc(Auth.dayLabel(set.tomorrow))}</b>. Pay and pick up tomorrow.</div>`
      : `<div class="closed-banner"><b>Pre-orders are closed.</b> ${esc(st.preMsg)}</div>`;
  if (!st.open) return `<div class="closed-banner"><b>Ordering is closed.</b> ${esc(st.msg)}${st.pre ? ' You can still pre-order for tomorrow.' : ''}</div>`;
  return set.cutoffOn ? `<div class="open-banner">${esc(st.msg)}</div>` : '';
}

/* Today / Tomorrow (pre-order) switch */
function whenSwitch() {
  const set = Auth.settings();
  if (!set.preorderOn) return '';
  return `<div class="chips when" role="group" aria-label="Order for">
    <button class="${S.when === 'today' ? 'on' : ''}" data-a="when" data-v="today">Order for today</button>
    <button class="${S.when === 'tomorrow' ? 'on' : ''}" data-a="when" data-v="tomorrow">Pre-order for tomorrow · ${esc(Auth.dayLabel(set.tomorrow))}</button>
  </div>`;
}

function foodCard(f) {
  const pre = S.when === 'tomorrow';
  const st = pre
    ? f.preorder ? ['', 'Pre-order'] : ['out', 'No pre-order']
    : f.soldOut ? ['out', 'Not available today']
    : f.stock === 0 ? ['out', 'Out of stock']
    : f.stock <= 5 ? ['low', `Only ${f.stock} left`]
    : ['', `${f.stock} available`];
  return ` <article class="food">
    <div class="ph">
      <span class="tag ${st[0]}">${st[1]}</span>
      ${f.image ? `<img src="${imgSrc(f.image)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.e))" data-e="${esc(f.emoji)}" />` : f.emoji}
    </div>

    <div class="fb">
      <small>${esc(f.cat)}</small>
      <h3>${esc(f.name)}</h3>
      <p>${esc(f.desc)}</p>

      <div class="row sp">
        <span class="price">${peso(f.price)}</span>
        <button class="cssbuttons-io-button" ${canOrder(f) ? '' : 'disabled'} data-a="add" data-id="${f.id}">
          <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0h24v24H0z" fill="none"></path>
            <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" fill="currentColor"></path>
          </svg>
          <span>Add</span>
        </button>
      </div>
    </div>
  </article>`;
}

function grid() {
  const q = S.q.toLowerCase();
  const l = foods().filter(
    (f) =>
      (S.cat === 'All' || f.cat === S.cat) &&
      (!q || (f.name + f.desc + f.cat).toLowerCase().includes(q)),
  );
  return l.length
    ? l.map(foodCard).join('')
    : `<div class="empty" style="grid-column:1/-1">
        ${foods().length
          ? 'No food matches your search.'
          : 'The canteen hasn’t published a menu yet.'}
      </div>`;
}

function menuPage() {
  const m = me();
  const cats = [
    'All',
    ...new Set(
      foods()
        .map((f) => f.cat)
        .filter(Boolean),
    ),
  ].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
  if (!cats.includes(S.cat)) S.cat = 'All';
  return `${statusBanner()}${whenSwitch()}<div class="banner">
      <div>
        <h1>Hi ${esc(m.name.split(' ')[0])}, what’s for lunch?</h1>
        <p>The menu updates live whenever the canteen changes it.</p>
      </div>
      <label class="search">
        <input data-in="q" type="search" placeholder="Search adobo, tea…" value="${esc(S.q)}" />
      </label>
    </div>

    <div class="chips">
      ${cats
        .map(
          (c) =>
            `<button class="${S.cat === c ? 'on' : ''}" data-a="cat" data-c="${esc(c)}">
              ${esc(c)}
            </button>`,
        )
        .join('')}
    </div>
    <div class="grid" id="grid">${grid()}</div>`;
}

function cartPage() {
  const l = cartLines();
  if (!l.length)
    return `<div class="empty">
    <h2>Your cart is empty</h2>
    <p>Pick something from the menu.</p>
    <button class="btn btn-p" data-a="nav" data-p="menu">Browse menu</button>
  </div>`;

  return `${statusBanner()}${whenSwitch()}<h2 style="margin-bottom:1rem">Your cart</h2>
    <div class="two">
      <section class="card">
        ${l
          .map(
            (x) =>
              `<div class="line">
                <span class="th"
                  >${x.image ? `<img src="${imgSrc(x.image)}" alt="" onerror="this.replaceWith(document.createTextNode(this.dataset.e))" data-e="${esc(x.emoji)}" />` : x.emoji}</span
                >
                <div style="flex:1">
                  <b>${esc(x.name)}</b>
                  <div class="mute">${peso(x.price)} each</div>
                </div>

                <div class="qty">
                  <button data-a="qty" data-id="${x.id}" data-d="-1" aria-label="Less">−</button>
                  <b>${x.qty}</b>
                  <button data-a="qty" data-id="${x.id}" data-d="1" aria-label="More">+</button>
                </div>

                <b style="min-width:70px;text-align:right">${peso(x.qty * x.price)}</b>
              </div>`,
          )
          .join('')}
      </section>

      <aside class="card">
        <div class="tot">
          <span>Total</span>
          <span>${peso(total())}</span>
        </div>
        <label class="field">
          <span>Note for the canteen</span>
          <textarea data-in="note" rows="3" placeholder="e.g. No onions, please.">
${esc(S.note)}</textarea
          >
        </label>

        <p class="mute" style="font-size:.85rem">
          ${S.when === 'tomorrow' ? 'Pay at pick-up tomorrow. The canteen prepares pre-orders that day.' : 'Pay at pick-up. Your food is only reserved once you place the order.'}
        </p>
        <button class="btn btn-p block" data-a="place" ${orderOpen() && !S.busy ? '' : 'disabled'}>${S.busy ? 'Placing order…' : S.when === 'tomorrow' ? 'Place pre-order' : 'Place order'}</button>
      </aside>
    </div>`;
}

function orderCard(o) {
  const i = ['Pending', 'Ready to Pick Up', 'Completed'].indexOf(o.status);
  const s = ['Pending', 'Ready', 'Done'];

  return `<article class="card">
    <div class="row sp">
      <div>
        <small class="mute">Order ${esc(o.id)} · ${esc(o.date)}${o.preorder ? ` · <b>Pre-order for ${esc(Auth.dayLabel(o.pickupDate))}</b>` : ''}</small>
        <h3 style="margin-top:.2rem">
          ${o.items.map((x) => `${x.qty}× ${esc(x.name)}`).join(', ')}
        </h3>
      </div>
      <span class="badge ${o.status.split(' ')[0]}">${esc(o.status)} </span>
    </div>

    <div class="prog">
      ${s
        .map(
          (t, n) =>
            ` <span class="${n <= i ? 'on' : ''}">${t} </span>
              ${n < 2 ? `<i class="${n < i ? 'on' : ''}"></i>` : ''}`,
        )
        .join('')}
    </div>

    <div class="row sp">
      <b>${peso(o.total)}</b>
      <span class="row">
        <button class="btn" data-a="receipt" data-id="${esc(o.id)}">Receipt</button>
        <button class="btn" data-a="reorder" data-id="${esc(o.id)}">Order again</button>
      </span>
    </div>
  </article>`;
}

function historyPage() {
  const all = myOrders();
  const act = all.filter((o) => o.status !== 'Completed'),
    old = all.filter((o) => o.status === 'Completed');
  return `<h2 style="margin-bottom:1rem">My orders</h2>
    <h3 class="mute" style="font-size:1rem;margin-bottom:.6rem">Active</h3>
    ${act.length ? act.map(orderCard).join('') : '<div class="empty">No active orders.</div>'}
    <h3 class="mute" style="font-size:1rem;margin:1.4rem 0 .6rem">Previous</h3>
    ${old.length
      ? old.map(orderCard).join('')
      : '<div class="empty">Completed orders show up here.</div>'}`;
}
function receiptPage() {
  const o = myOrders().find((x) => x.id === S.receipt);
  if (!o) {
    S.page = 'history';
    return historyPage();
  }
  const m = me();

  return `<button class="btn" data-a="nav" data-p="history">← My orders</button>
    <section class="card" style="max-width:480px;margin:1rem auto">
      <div style="text-align:center">
        <img class="logo logo-md" src="pickago_Logo.png" alt="Pickago" style="margin:0 auto .5rem" />
        <h2>Order ${esc(o.id)}</h2>
        <p class="mute">${esc(o.date)}</p>
        ${o.preorder ? `<p><b>Pre-order · pick up on ${esc(Auth.dayLabel(o.pickupDate))}</b></p>` : ''}
        <span class="badge ${o.status.split(' ')[0]}">${esc(o.status)} </span>
      </div>

      <p><b>Student:</b> ${esc(m.name)}</p>
      ${o.items
        .map(
          (i) =>
            `<div class="row sp" style="padding:.3rem 0">
              <span>${i.qty}× ${esc(i.name)}</span>
              <b>${peso(i.qty * i.price)}</b>
            </div> `,
        )
        .join('')}
      <div class="tot">
        <span>Total</span>
        <span>${peso(o.total)}</span>
      </div>
      <p class="mute">Note: ${esc(o.note || 'None')}</p>
      <p class="mute" style="font-size:.85rem">Show this order number at the counter to pick up.</p>
    </section>`;
}

function profilePage() {
  const m = me();
  const t = S.tab;

  const tabs = `<div class="tabs">
    ${[
      ['info', 'Information'],
      ['sec', 'Security'],
      ['help', 'Help & About'],
    ]
      .map(
        ([k, l]) =>
          `<button class="${t === k ? 'on' : ''}" data-a="tab" data-t="${k}">
            ${l}
          </button>`,
      )
      .join('')}
  </div>`;
  const head = `<section class="card row wrap">
    ${avatar(m, 1)}
    <div style="flex:1">
      <h2>${esc(m.name)}</h2>
      <p class="mute" style="margin:.2rem 0">Student No. ${esc(m.id)}</p>
      <label class="btn" style="display:inline-block;margin-top:.4rem;font-size:.85rem"
        >Change photo<input type="file" accept="image/*" data-ch="photo" hidden
      /></label>
      ${m.photo
        ? '<button class="btn" data-a="rmphoto" style="font-size:.85rem">Remove</button>'
        : ''}
    </div>
  </section>`;

  let b = '';
  const my = myOrders();
  if (t === 'info')
    b = `<section class="card">
      <form data-f="info">
        <label class="field">
          <span>Full name</span>
          <input name="n" value="${esc(m.name)}" required
        /></label>
        <label class="field">
          <span>Mobile number (optional)</span>
          <input name="ph" type="tel" value="${esc(m.phone || '')}" placeholder="09xx xxx xxxx" />
        </label>
        <label class="field">
          <span>Grade & section (optional)</span>
          <input name="sec" value="${esc(m.section || '')}" placeholder="e.g. Grade 10 – Rizal" />
        </label>

        <dl style="margin:1rem 0">
          <dt>Student No.</dt>
          <dd>${esc(m.id)}</dd>
          <dt>Orders placed</dt>
          <dd>${my.length}</dd>
          <dt>Total spent</dt>
          <dd>${peso(my.reduce((s, o) => s + o.total, 0))}</dd>
        </dl>

        <button class="btn btn-p">Save information</button>
      </form>
    </section>`;

  if (t === 'sec')
    b = `<section class="card">
        <h3>Change password</h3>
        <form data-f="pw">
          <label class="field">
            <span>Current password</span>
            <input name="c" type="password" required autocomplete="current-password" />
          </label>
          <label class="field">
            <span>New password</span>
            <input name="n" type="password" data-in="meter" required autocomplete="new-password"
          /></label>

          <div class="bar">
            <i id="bar"></i>
          </div>
          <p class="mute" id="hint" style="font-size:.8rem">
            8+ characters with a capital letter, number and symbol.
          </p>

          <label class="field">
            <span>Confirm new password</span>
            <input name="k" type="password" required autocomplete="new-password" />
          </label>

          <div class="err" id="err"></div>
          <button class="btn btn-p">Update password</button>
        </form>
      </section>

      <section class="card">
        <h3>Sessions</h3>
        <p class="mute">
          Last login:
          ${m.lastLogin
            ? new Date(m.lastLogin).toLocaleString('en-PH')
            : 'This is your first login'}
        </p>
        <label class="field">
          <span>Auto log out when idle</span
          ><select data-ch="idle">
            ${[
              [0, 'Never'],
              [5, '5 minutes'],
              [15, '15 minutes'],
              [30, '30 minutes'],
            ]
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${(+m.idle || 0) === v ? 'selected' : ''}>
                    ${l}
                  </option>`,
              )
              .join('')}
          </select></label
        ><button class="btn" data-a="logout">Log out</button>
      </section>`;
  if (t === 'help')
    b = `<section class="card">
        <h3>How ordering works</h3>
        <div class="line">
          <b>1</b><span>Add food to your cart. Availability is live from the canteen.</span>
        </div>
        <div class="line">
          <b>2</b><span>Place your order. The canteen sees it right away.</span>
        </div>
        <div class="line">
          <b>3</b
          ><span
            >When the status says <b>Ready to Pick Up</b>, show your order number at the counter and
            pay.</span
          >
        </div>
      </section>
      <section class="card">
        <h3>FAQ</h3>
        <details>
          <summary>Why is an item out of stock?</summary>
          <p>The canteen sets stock. It updates here as soon as they change it.</p>
        </details>
        <details>
          <summary>Can I change an order after placing it?</summary>
          <p>Not yet. Tell the canteen staff, or place a new order with a note.</p>
        </details>
        <details>
          <summary>Who can see my details?</summary>
          <p>
            The canteen sees your name and orders so they can prepare your food. Your password is never shown to them.
          </p>
        </details>
        <details>
          <summary>Keep your account safe</summary>
          <p>
            Use a password you don’t use elsewhere, never share it, and log out on shared devices.
          </p>
        </details>
      </section>
      <p class="mute" style="text-align:center">Pickago Student · demo build</p>`;
  return head + tabs + b;
}

function render() {
  const app = $('#app');
  if (!me()) {
    location.replace('../index.html');
    return;
  }
  S.view = 'app';
  const m = me();
  const y = scrollY;
  const st = Auth.orderStatus();
  if (!st.site) {
    app.innerHTML = `<div class="closed-page"><img class="logo logo-md" src="pickago_Logo.png" alt="Pickago" /><h1>The canteen website is closed</h1><p>${esc(st.msg)}</p><button class="btn" data-a="logout">Log out</button></div>`;
    return;
  }
  const pg =
    {
      menu: menuPage,
      cart: cartPage,
      history: historyPage,
      receipt: receiptPage,
      profile: profilePage,
    }[S.page] || menuPage;
  const nav = (c) =>
    Object.entries(LABEL)
      .map(
        ([k, l]) =>
          `<button
            data-a="nav"
            data-p="${k}"
            ${S.page === k ? 'aria-current="page"' : ''}
          >
            ${c
              ? `<span
                  >${{ menu: '🍽️', cart: '🛒', history: '🧾', profile: '👤' }[k]}</span
                >`
              : ''}${l}${k === 'cart' && cartN() ? ` (${cartN()})` : ''}
          </button>`,
      )
      .join('');
  app.innerHTML = `<header class="top">
      <button class="brand" data-a="nav" data-p="menu"><img class="logo" src="pickago_Logo.png" alt="" />Pickago</button>
      <nav class="nav" aria-label="Main">${nav()}</nav>
      <button class="me" data-a="nav" data-p="profile">
        ${avatar(m)}<span>${esc(m.name.split(' ')[0])}</span>
      </button>
    </header>
    <main class="page">${pg()}</main>
    <nav class="tabbar" aria-label="Main">${nav(1)}</nav>`;
  scrollTo(0, y);
}

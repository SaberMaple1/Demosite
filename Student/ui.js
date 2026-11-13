const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const peso = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);

function toast(m, e) {
  const t = document.createElement('div');
  t.className = 'toast' + (e ? ' e' : '');
  t.textContent = m;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}
function ask(title, text, ok, cb, danger) {
  $('#modal').innerHTML = `<div class="scrim">
    <div class="sheet" role="dialog" aria-modal="true">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="row">
        <button class="btn" data-a="mclose">Cancel</button
        ><button class="btn ${danger ? 'btn-d' : 'btn-p'}" id="mok">${esc(ok)}</button>
      </div>
    </div>
  </div>`;
  $('#mok').onclick = () => {
    $('#modal').innerHTML = '';
    cb();
  };
}
function initials(n) {
  return (n || 'S')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
function avatar(m, big) {
  return `<span class="av ${big ? 'lg' : ''}"
    >${m.photo ? `<img src="${m.photo}" alt="" />` : esc(initials(m.name))}</span
  >`;
}
function score(v) {
  return [
    v.length >= 8,
    v.length >= 12,
    /[A-Z]/.test(v),
    /\d/.test(v),
    /[^A-Za-z0-9]/.test(v),
  ].filter(Boolean).length;
}
function pwOk(p, lrn) {
  return p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p) && p !== lrn;
}

function shrink(file, max = 240) {
  return new Promise((ok, no) => {
    if (!file || !file.type.startsWith('image/')) return no(new Error('Choose an image file.'));
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        const s = Math.min(1, max / Math.max(i.width, i.height)),
          c = document.createElement('canvas');
        c.width = i.width * s;
        c.height = i.height * s;
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      i.onerror = () => no(new Error('Could not open that image.'));
      i.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

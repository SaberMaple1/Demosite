
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Always escape user-entered text before putting it in HTML. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const peso = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0);
const longDate = (d) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(new Date(d));

/* Feather-style line icons */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  logout: '<path d="M9 4H4v16h5M16 8l4 4-4 4M20 12H9"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/*  Toasts  */
function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

/*   Modal (bottom sheet on phones)   */
const Modal = {
  onDismiss: null,

  open(html) {
    this.close();
    const root = $('#modal-root');
    root.innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
    const scrim = $('.scrim', root);
    scrim.addEventListener('mousedown', (e) => {
      if (e.target === scrim) { const cb = this.onDismiss; this.close(); cb?.(); }
    });
    $('input:not([type=file]):not([readonly]), textarea', root)?.focus();
    return $('.sheet', root);
  },

  close() { this.onDismiss = null; $('#modal-root').innerHTML = ''; },

  confirm(title, text, okLabel = 'Confirm', danger = false) {
    return new Promise((resolve) => {
      const sheet = this.open(`
        <h2>${esc(title)}</h2>
        <p class="mute">${esc(text)}</p>
        <div class="sheet-actions">
          <button class="btn" data-answer="0">Cancel</button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-answer="1">${esc(okLabel)}</button>
        </div>`);
      this.onDismiss = () => resolve(false);
      $$('[data-answer]', sheet).forEach((b) => b.addEventListener('click', () => {
        this.onDismiss = null; this.close(); resolve(b.dataset.answer === '1');
      }));
    });
  },

  prompt(title, label, value = '', { type = 'text', okLabel = 'Save', min } = {}) {
    return new Promise((resolve) => {
      const sheet = this.open(`
        <form>
          <h2>${esc(title)}</h2>
          <label class="field"><span>${esc(label)}</span>
            <input name="v" type="${type}" value="${esc(value)}" ${min !== undefined ? `min="${min}"` : ''} required></label>
          <div class="sheet-actions">
            <button type="button" class="btn" data-answer="0">Cancel</button>
            <button class="btn btn-primary">${esc(okLabel)}</button>
          </div>
        </form>`);
      this.onDismiss = () => resolve(null);
      $('[data-answer]', sheet).addEventListener('click', () => { this.onDismiss = null; this.close(); resolve(null); });
      $('form', sheet).addEventListener('submit', (e) => {
        e.preventDefault();
        const v = new FormData(e.target).get('v').trim();
        this.onDismiss = null; this.close(); resolve(v);
      });
      $('input', sheet).select();
    });
  },
};

/*   Image helper  
   Photos are stored as text in localStorage, which is small (~5 MB).
   Shrinking them keeps many food photos possible. */
function compressImage(file, maxSize = 520, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

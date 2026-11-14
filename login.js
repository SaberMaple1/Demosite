/* One login page for everyone: pick Student, Canteen Staff or Admin Staff. */
const ROLES = {
  student: { tab: 'Student', title: 'Student Login', label: 'Student No.', ph: 'e.g. 2026-0001', go: 'Student/index.html', sub: 'Use the Student No. and password the admin gave you.' },
  staff: { tab: 'Canteen Staff', title: 'Canteen Staff Login', label: 'Staff username', ph: 'e.g. staff01', go: 'Staff/index.html', sub: 'Sign in to manage the menu, stock and orders.' },
  admin: { tab: 'Admin Staff', title: 'Admin Staff Login', label: 'Admin username', ph: 'admin', go: 'Admin/index.html', sub: 'Manage accounts, the cut-off time and when ordering is open.' },
};
let role = localStorage.getItem('pickagoLastRole');
if (!ROLES[role]) role = 'student';

const sess = Auth.session();
if (sess && ROLES[sess.role] && Auth.current(sess.role)) location.replace(ROLES[sess.role].go);

function render() {
  const r = ROLES[role];
  $('#app').innerHTML = `
  <section class="login">
    <div class="login-art">
      <div class="light-rays" data-light-rays='{"raysOrigin":"top-center","raysColor":"#ffffff","raysSpeed":1,"lightSpread":0.5,"rayLength":3,"glow":0.6,"haze":0.25,"followMouse":true,"mouseInfluence":0.1}'></div>
      <img class="logo logo-lg" src="pickago_Logo.png" alt="Pickago">
      <h2>Fresh orders, ready when students are.</h2>
    </div>
    <div class="login-form">
      <form data-form="login" autocomplete="on">
        <h1>${r.title}</h1>
        <div class="role-tabs" role="tablist">${Object.entries(ROLES).map(([k, v]) => `<button type="button" role="tab" data-role="${k}" aria-selected="${k === role}">${v.tab}</button>`).join('')}</div>
        <p class="mute" style="margin-bottom:1.2rem">${r.sub}</p>
        <label class="field"><span>${r.label}</span><input name="u" autocomplete="username" placeholder="${r.ph}" required></label>
        <label class="field"><span>Password</span>
          <div class="pw-wrap"><input name="p" type="password" autocomplete="current-password" required>
          <button type="button" data-pw>Show</button></div>
        </label>
        <p class="error-text" id="login-err" role="alert"></p>
        <button class="btn btn-primary btn-block">Sign in</button>
        ${role === 'student' ? '<p class="mute" style="margin-top:1rem;font-size:.85rem">No account yet? Ask the canteen admin to create one for you.</p>' : ''}
      </form>
    </div>
  </section>`;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-role]');
  if (t) { role = t.dataset.role; localStorage.setItem('pickagoLastRole', role); render(); }
  const pw = e.target.closest('[data-pw]');
  if (pw) { const i = pw.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; pw.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target), err = $('#login-err'), btn = e.target.querySelector('.btn-primary');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await Auth.login(role, fd.get('u'), fd.get('p'));
    if (res.ok) { location.replace(ROLES[role].go); return; }
    err.textContent = res.error;
  } catch (x) { err.textContent = x.message; }
  btn.disabled = false; btn.textContent = 'Sign in';
});
render();

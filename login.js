/* One login for everyone. The account's role decides which dashboard opens.
   Students can also sign up here: email + password -> Student ID emailed -> enter it -> name + section. */
const HOME = { student: 'Student/index.html', staff: 'Staff/index.html', admin: 'Admin/index.html' };
const SU_KEY = 'pickagoSignup';           // {ticket, email, stage, studentId}
let view = 'login', su = null, prefill = '', resendAt = 0, busy = false;

const sess = Auth.session();
if (sess && HOME[sess.role] && Auth.current(sess.role)) location.replace(HOME[sess.role]);

const readSU = () => { try { return JSON.parse(sessionStorage.getItem(SU_KEY)); } catch { return null; } };
const saveSU = (v) => { su = v; try { v ? sessionStorage.setItem(SU_KEY, JSON.stringify(v)) : sessionStorage.removeItem(SU_KEY); } catch {} };
const strongPw = (p) => p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

const LEGAL = `<p class="legal"><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a></p>`;
const pwField = (name, label, auto) => `<label class="field"><span>${label}</span><div class="pw-wrap"><input name="${name}" type="password" autocomplete="${auto}" required><button type="button" data-pw>Show</button></div></label>`;

const VIEWS = {
  login: () => `
    <form data-form="login" autocomplete="on">
      <h1>Log in</h1>
      <p class="mute" style="margin-bottom:1.2rem">Students: use your Student ID. Canteen staff and admins: use your username.</p>
      <label class="field"><span>Student ID or username</span><input name="u" autocomplete="username" placeholder="e.g. 2026-0001" value="${esc(prefill)}" required></label>
      ${pwField('p', 'Password', 'current-password')}
      <p class="error-text" id="err" role="alert"></p>
      <button class="btn btn-primary btn-block">Log in</button>
      <p class="or"><span>New student?</span></p>
      <button type="button" class="btn btn-block" data-go="signup">Sign up</button>
      ${LEGAL}
    </form>`,
  signup: () => `
    <form data-form="signup" autocomplete="on">
      <p class="step">Step 1 of 3</p>
      <h1>Student sign up</h1>
      <p class="mute" style="margin-bottom:1.2rem">Create your login. We’ll email your Student ID to confirm it’s you.</p>
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
      ${pwField('p', 'Password', 'new-password')}
      <p class="hint">At least 8 characters with a capital letter, a number and a symbol.</p>
      <label class="agree"><input type="checkbox" name="terms"> <span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a> and the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
      <p class="error-text" id="err" role="alert"></p>
      <button class="btn btn-primary btn-block">Continue</button>
      <p class="or"><span>Already have an account?</span></p>
      <button type="button" class="btn btn-block" data-go="login">Log in</button>
      ${LEGAL}
    </form>`,
  verify: () => `
    <form data-form="verify" autocomplete="off">
      <p class="step">Step 2 of 3</p>
      <h1>Check your email</h1>
      <p class="mute" style="margin-bottom:1.2rem">We sent your <b>Student ID</b> to <b>${esc(su.email)}</b>. Type it below to continue. If you can’t see it, look in your Spam or Junk folder.</p>
      <label class="field"><span>Student ID</span><input name="sid" placeholder="e.g. 2026-0001" autocomplete="off" required autofocus></label>
      <p class="error-text" id="err" role="alert"></p>
      <button class="btn btn-primary btn-block">Verify</button>
      <p class="or"><span>No email?</span></p>
      <button type="button" class="btn btn-block" data-act="resend" id="resend">Send it again</button>
      <button type="button" class="link" data-act="restart">Use a different email</button>
    </form>`,
  setup: () => `
    <form data-form="setup" autocomplete="on">
      <p class="step">Step 3 of 3</p>
      <h1>Set up your profile</h1>
      <p class="mute" style="margin-bottom:1.2rem">Your email is confirmed. Finish your details.</p>
      <label class="field"><span>Student ID</span><input value="${esc(su.studentId)}" readonly class="locked"></label>
      <label class="field"><span>Name</span><input name="name" autocomplete="name" placeholder="Full name" maxlength="60" required></label>
      <label class="field"><span>Section</span><input name="section" placeholder="e.g. Grade 10 - Rizal" maxlength="60" required></label>
      <p class="error-text" id="err" role="alert"></p>
      <button class="btn btn-primary btn-block">Finish</button>
    </form>`,
  done: () => `
    <div>
      <h1>You’re all set 🎉</h1>
      <p class="mute" style="margin:.4rem 0 1.4rem">Your account is ready. Log in with your Student ID and the password you chose.</p>
      <p class="idbox">${esc(prefill)}</p>
      <button class="btn btn-primary btn-block" data-go="login">Go to log in</button>
    </div>`,
};

function render() {
  $('#app').innerHTML = `
  <section class="login">
    <div class="login-art">
      <div class="light-rays" data-light-rays='{"raysOrigin":"top-center","raysColor":"#ffffff","raysSpeed":1,"lightSpread":0.5,"rayLength":3,"glow":0.6,"haze":0.25,"followMouse":true,"mouseInfluence":0.1}'></div>
      <img class="logo logo-lg" src="pickago_Logo.png" alt="Pickago">
      <h2>Fresh orders, ready when students are.</h2>
    </div>
    <div class="login-form">${VIEWS[view]()}</div>
  </section>`;
  tickResend();
}
const go = (v) => { view = v; render(); };
const err = (m) => { const e = $('#err'); if (e) e.textContent = m || ''; };
const lock = (btn, text) => { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = text; };
const unlock = (btn) => { btn.disabled = false; btn.textContent = btn.dataset.t || btn.textContent; };

/* "Send it again" waits a minute between sends */
function tickResend() {
  const b = $('#resend'); if (!b) return;
  const left = Math.ceil((resendAt - Date.now()) / 1000);
  if (left > 0) { b.disabled = true; b.textContent = `Send it again (${left}s)`; setTimeout(tickResend, 1000); }
  else { b.disabled = false; b.textContent = 'Send it again'; }
}

document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { if (g.dataset.go === 'login' && view !== 'done') prefill = ''; go(g.dataset.go); return; }
  const pw = e.target.closest('[data-pw]');
  if (pw) { const i = pw.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; pw.textContent = i.type === 'password' ? 'Show' : 'Hide'; return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'resend') {
    if (Date.now() < resendAt) return;
    a.disabled = true;
    try { await Auth.rpc('signup_resend', { p_ticket: su.ticket }); resendAt = Date.now() + 60000; err(''); toast('Email sent again'); }
    catch (x) { err(x.message); }
    tickResend(); if (Date.now() >= resendAt) a.disabled = false;
  }
  if (a.dataset.act === 'restart') {
    try { await Auth.rpc('signup_cancel', { p_ticket: su.ticket }); } catch {}
    saveSU(null); go('signup');
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target.dataset.form, fd = new FormData(e.target), btn = e.target.querySelector('.btn-primary');
  if (busy) return; busy = true; err(''); lock(btn, 'Please wait…');
  try {
    if (form === 'login') {
      const res = await Auth.login(fd.get('u'), fd.get('p'));
      if (res.ok) { location.replace(HOME[res.role] || 'index.html'); return; }
      err(res.error);
    }
    if (form === 'signup') {
      const pw = fd.get('p');
      if (!fd.get('terms')) err('Please agree to the Terms of Use and the Privacy Policy.');
      else if (!strongPw(pw)) err('Your password needs 8+ characters with a capital letter, a number and a symbol.');
      else {
        const r = await Auth.rpc('signup_start', { p_email: fd.get('email'), p_password: pw, p_terms: true });
        saveSU({ ticket: r.ticket, email: r.email, stage: 'verify', studentId: null }); resendAt = Date.now() + 60000; go('verify'); return;
      }
    }
    if (form === 'verify') {
      const r = await Auth.rpc('signup_verify', { p_ticket: su.ticket, p_student_id: fd.get('sid') });
      if (r.ok) { saveSU({ ...su, stage: 'setup', studentId: r.studentId }); go('setup'); return; }
      if (r.expired) { saveSU(null); go('signup'); setTimeout(() => err(r.error), 0); return; }
      err(r.error);
    }
    if (form === 'setup') {
      const r = await Auth.rpc('signup_finish', { p_ticket: su.ticket, p_name: fd.get('name'), p_section: fd.get('section') });
      prefill = r.studentId; saveSU(null); go('done'); return;
    }
  } catch (x) { err(x.message); }
  finally { busy = false; if (btn.isConnected) unlock(btn); }
});

(async () => {
  su = readSU();
  if (su && su.ticket) {
    try {
      const r = await Auth.rpc('signup_status', { p_ticket: su.ticket });
      if (r.ok) { saveSU({ ...su, email: r.email, stage: r.stage, studentId: r.studentId }); view = r.stage; }
      else saveSU(null);
    } catch { saveSU(null); }
  }
  render();
})();

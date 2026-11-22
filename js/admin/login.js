import { api, isDemo, invalidate } from '../data/api.js';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../data/demo.js';
import { initCats } from '../lib/cats.js';
import { icon } from '../lib/icons.js';
import { esc, $, toast } from '../lib/util.js';
import { navigate } from '../lib/router.js';
import { adminMeta, busy } from './ui.js';

export default function loginPage(view, ctx) {
  adminMeta('Sign in');
  const next = ctx.query.get('next');
  const dest = next && /^\/admin(\/|$)/.test(next) && next !== '/admin' ? next : '/admin/dashboard';

  view.innerHTML = `
    <section class="login-page">
      <div class="cats-stage">
        <div class="cat-interactive protected-zone" data-sound="/assets/miaw.mp3">
          <div class="cat-shadow" aria-hidden="true"></div>
          <div class="cat-visual"><img src="/assets/cat-1.png" alt="Cat" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
        </div>
        <div class="cat-interactive protected-zone" data-sound="/assets/blublub.mp3">
          <div class="cat-shadow" aria-hidden="true"></div>
          <div class="cat-visual"><img src="/assets/cat-2.png" alt="Cat" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
        </div>
      </div>
      <h1>Admin login</h1>
      <p class="sub">The senior engineers only let the owner through.</p>

      <form class="login-card" id="loginForm" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" type="email" autocomplete="username" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="pw-wrap">
            <input class="input" id="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
            <button type="button" class="icon-btn" id="togglePw" aria-label="Show password">${icon('eye')}</button>
          </div>
        </div>
        <p class="err-text" id="loginErr" role="alert" hidden></p>
        <button class="btn primary" type="submit">${icon('lock')}Sign in</button>
      </form>

      ${
        isDemo
          ? `<div class="callout demo-hint">${icon('info')}<span><strong>Demo mode.</strong> Supabase isn't configured yet, so data lives only in this browser. Use <code data-fill>${esc(DEMO_EMAIL)}</code> / <code data-fill-pw>${esc(DEMO_PASSWORD)}</code> (click to fill).</span></div>`
          : ''
      }
    </section>`;
  initCats(view);

  const form = $('#loginForm', view);
  const err = $('#loginErr', view);
  const email = $('#email', view);
  const pw = $('#password', view);

  $('#togglePw', view).addEventListener('click', (e) => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  view.querySelector('[data-fill]')?.addEventListener('click', () => { email.value = DEMO_EMAIL; pw.value = DEMO_PASSWORD; pw.focus(); });
  view.querySelector('[data-fill-pw]')?.addEventListener('click', () => { email.value = DEMO_EMAIL; pw.value = DEMO_PASSWORD; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    email.classList.toggle('invalid', !email.value.trim());
    pw.classList.toggle('invalid', !pw.value);
    if (!email.value.trim() || !pw.value) {
      err.textContent = 'Enter your email and password.';
      err.hidden = false;
      return;
    }
    try {
      await busy(form.querySelector('button[type=submit]'), () => api.signIn(email.value, pw.value));
      invalidate();
      toast('Welcome back!');
      navigate(dest, { replace: true, force: true });
    } catch (ex) {
      err.textContent = /invalid/i.test(ex.message) ? 'Wrong email or password.' : ex.message || 'Could not sign in.';
      err.hidden = false;
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      pw.select();
    }
  });
  setTimeout(() => email.focus(), 300);
}

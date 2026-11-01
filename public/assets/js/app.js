/* ExcelLab · comportamiento del cliente */
(function () {
  'use strict';
  const csrf = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  // POST con CSRF que devuelve JSON
  window.XL = {
    async post(url, data) {
      const body = new URLSearchParams(data);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': csrf(), 'Accept': 'application/json' },
        body,
        credentials: 'same-origin'
      });
      let json = {};
      try { json = await res.json(); } catch (e) { json = { ok: false, message: 'Respuesta inesperada del servidor.' }; }
      if (res.status === 401) { window.location.reload(); }
      return json;
    }
  };

  // Menú lateral en móvil
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggle = () => { sidebar.classList.toggle('open'); backdrop.classList.toggle('show'); };
  document.querySelectorAll('[data-toggle-sidebar]').forEach(b => b.addEventListener('click', toggle));
  if (backdrop) backdrop.addEventListener('click', toggle);

  // Confirmaciones
  document.addEventListener('submit', e => {
    const msg = e.target.dataset.confirm;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Validación del lado del cliente (Bootstrap)
  document.querySelectorAll('form.needs-validation').forEach(form => {
    form.addEventListener('submit', e => {
      if (!form.checkValidity()) { e.preventDefault(); e.stopPropagation(); }
      form.classList.add('was-validated');
    });
  });

  // Mostrar/ocultar contraseña
  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.dataset.togglePass);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  });

  // ---------- Ejercicios ----------
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  document.querySelectorAll('.exercise-card[data-check-url]').forEach(card => {
    const btn = card.querySelector('.btn-check-ex');
    const box = card.querySelector('.feedback');
    if (!btn) return;
    const getAnswer = () => {
      const radio = card.querySelector('input[type=radio]:checked');
      if (card.querySelector('input[type=radio]')) return radio ? radio.value : '';
      const t = card.querySelector('.answer-input');
      return t ? t.value.trim() : '';
    };
    const run = async () => {
      const answer = getAnswer();
      box.className = 'feedback show bad';
      if (!answer) { box.innerHTML = '<i class="bi bi-info-circle"></i> Escribe o selecciona una respuesta antes de comprobar.'; return; }
      btn.disabled = true;
      const r = await XL.post(card.dataset.checkUrl, { answer, context: card.dataset.context || 'lab' });
      btn.disabled = false;
      if (!r.ok) { box.innerHTML = escapeHtml(r.message || 'No se pudo comprobar.'); return; }
      box.className = 'feedback show ' + (r.correct ? 'ok' : 'bad');
      let html = '<strong><i class="bi ' + (r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill') + '"></i> ' + escapeHtml(r.message) + '</strong>';
      if (r.correct && r.points && !r.preview) html += ' <span class="chip success">+' + r.points + ' pts</span>';
      if (r.correct_answer) html += '<div class="mt-1">Respuesta correcta: <code>' + escapeHtml(r.correct_answer) + '</code></div>';
      if (r.explanation) html += '<div class="explain"><strong>Explicación:</strong> ' + escapeHtml(r.explanation) + '</div>';
      (r.badges || []).forEach(b => { html += '<div class="mt-2"><span class="chip warning"><i class="bi bi-award"></i> Nuevo logro: ' + escapeHtml(b.name) + '</span></div>'; });
      box.innerHTML = html;
      // Marcar opciones
      if (card.querySelector('input[type=radio]')) {
        card.querySelectorAll('.opt').forEach(o => o.classList.remove('right', 'wrong'));
        const chosen = card.querySelector('input[type=radio]:checked');
        if (chosen) chosen.closest('.opt').classList.add(r.correct ? 'right' : 'wrong');
      }
      const done = card.querySelector('.lesson-ex-done');
      if (done && r.correct) done.classList.remove('d-none');
    };
    btn.addEventListener('click', run);
    const input = card.querySelector('.answer-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  });

  // ---------- Retos ----------
  const ch = document.getElementById('challengeBox');
  if (ch) {
    const started = Date.now();
    const timerEl = document.getElementById('challengeTimer');
    setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      timerEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
    const btn = document.getElementById('challengeBtn');
    const input = document.getElementById('challengeAnswer');
    const box = ch.querySelector('.feedback');
    const run = async () => {
      const answer = input.value.trim();
      box.className = 'feedback show bad';
      if (!answer) { box.innerHTML = 'Escribe tu resultado antes de validar.'; return; }
      btn.disabled = true;
      const r = await XL.post(ch.dataset.url, { answer, seconds: Math.floor((Date.now() - started) / 1000) });
      btn.disabled = false;
      if (!r.ok) { box.innerHTML = escapeHtml(r.message || 'No se pudo validar.'); return; }
      box.className = 'feedback show ' + (r.correct ? 'ok' : 'bad');
      let html = '<strong><i class="bi ' + (r.correct ? 'bi-trophy-fill' : 'bi-x-circle-fill') + '"></i> ' + escapeHtml(r.message) + '</strong>';
      if (r.correct && r.points) html += ' <span class="chip success">+' + r.points + ' pts</span>';
      if (r.correct && r.already && !r.preview) html += '<div class="small mt-1">Ya habías superado este reto: no suma puntos de nuevo.</div>';
      (r.badges || []).forEach(b => { html += '<div class="mt-2"><span class="chip warning"><i class="bi bi-award"></i> Nuevo logro: ' + escapeHtml(b.name) + '</span></div>'; });
      box.innerHTML = html;
    };
    btn.addEventListener('click', run);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  }

  // ---------- Evaluaciones: temporizador ----------
  const timer = document.getElementById('examTimer');
  if (timer) {
    let left = parseInt(timer.dataset.remaining, 10);
    const form = document.getElementById('examForm');
    const tick = () => {
      if (left <= 0) { timer.textContent = '00:00'; form.submit(); return; }
      const m = Math.floor(left / 60), s = left % 60;
      timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      timer.classList.toggle('low', left <= 60);
      left--;
    };
    tick();
    setInterval(tick, 1000);
    form.addEventListener('submit', () => { form.querySelectorAll('button[type=submit]').forEach(b => b.disabled = true); });
  }
})();

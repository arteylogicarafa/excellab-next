import { logoUrl } from '@/lib/helpers';

// Pantalla de carga con el logo: se muestra una vez al iniciar la sesión del navegador.
// (Réplica de app/Views/components/loader.php; la cookie la decide el propio cliente.)

const SPLASH_CSS = `#splash{position:fixed;inset:0;z-index:3000;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.6rem;transition:opacity .5s ease,visibility .5s}
#splash.hide{opacity:0;visibility:hidden}
#splash img{width:min(440px,78vw);height:auto;animation:splashIn .7s ease both}
#splash .fallback{display:flex;align-items:center;gap:.8rem;font-size:2.4rem;font-weight:800;color:#185c37;animation:splashIn .7s ease both}
#splash .fallback span{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#217346,#16a34a);color:#fff;display:grid;place-items:center;font-size:1.9rem}
#splash .bar{width:min(240px,60vw);height:5px;border-radius:99px;background:#e5ece8;overflow:hidden}
#splash .bar i{display:block;height:100%;width:40%;border-radius:99px;background:linear-gradient(90deg,#217346,#4ade80);animation:splashBar 1.1s ease-in-out infinite}
#splash small{color:#6b7280;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem}
@keyframes splashIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes splashBar{0%{margin-left:-40%}100%{margin-left:100%}}
@media (prefers-reduced-motion:reduce){#splash *{animation:none!important}}`;

const SPLASH_JS = `(function () {
  var s = document.getElementById('splash');
  if (!s) return;
  if (/(^|;\\s*)excellab_splash=/.test(document.cookie)) { s.remove(); return; }
  document.cookie = 'excellab_splash=1; path=/; max-age=2592000';
  function done() { s.classList.add('hide'); setTimeout(function () { s.remove(); }, 700); }
  // No espera a que carguen TODOS los recursos (fuentes, gráficos): en redes
  // lentas eso dejaba el logo varios segundos. Igual animación, antes.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(done, 900); });
  } else {
    setTimeout(done, 900);
  }
  setTimeout(done, 3000);
})();`;

export default function Splash() {
  const logo = logoUrl();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <div id="splash" role="status" aria-label="Cargando ExcelLab">
        {logo ? (
          <img src={logo} alt="ExcelLab by Rafa Guerrero" />
        ) : (
          <div className="fallback">
            <span>
              <i className="bi bi-grid-3x3-gap-fill" />
            </span>{' '}
            ExcelLab
          </div>
        )}
        <div className="bar">
          <i />
        </div>
        <small>Cargando…</small>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_JS }} />
    </>
  );
}

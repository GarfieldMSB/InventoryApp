/* Arranque, navegación (hash), diseño y eventos */
import * as store from './store.js';
import * as db from './db.js';
import { ui, setHooks, saveDrafts, vs } from './core.js';
import { icon, esc, toast, openModal, closeModal, modalOpen, runModalOk } from './ui.js';

import inicio from './views/inicio.js';
import inventario from './views/inventario.js';
import ingresos from './views/ingresos.js';
import salidas from './views/salidas.js';
import kits from './views/kits.js';
import vencimientos from './views/vencimientos.js';
import adminInsumos from './views/admin-insumos.js';
import adminKits from './views/admin-kits.js';
import adminCatalogos from './views/admin-catalogos.js';
import adminAjustes from './views/admin-ajustes.js';
import configuracion from './views/configuracion.js';

const VIEWS = [inicio, inventario, ingresos, salidas, kits, vencimientos, adminInsumos, adminKits, adminCatalogos, adminAjustes, configuracion];
const BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
const ACTIONS = {}; const FORMS = {}; const HOOKS = {}; const PREVIEWS = {};
VIEWS.forEach((v) => { Object.assign(ACTIONS, v.actions || {}); Object.assign(FORMS, v.forms || {}); Object.assign(HOOKS, v.hooks || {}); Object.assign(PREVIEWS, v.preview || {}); });

const $ = (id) => document.getElementById(id);
const THEME_KEY = 'bodega.tema';
try { ui.theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { ui.theme = 'auto'; }
const applyTheme = () => { if (ui.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = ui.theme; };
applyTheme();

/* ---------- Navegación ---------- */
function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, qs] = h.split('?');
  const q = {};
  new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
  return { path: BY_ID[path] ? path : 'inicio', q };
}
function go(path) { if (location.hash === '#/' + path) onRoute(); else location.hash = '#/' + path; }
function onRoute() {
  ui.route = parseHash();
  const v = BY_ID[ui.route.path];
  if (v.enter) v.enter(ui.route.q);
  document.body.classList.remove('nav-open');
  if (modalOpen()) closeModal();
  render();
  $('view').scrollTop = 0;
  window.scrollTo(0, 0);
}

/* ---------- Diseño ---------- */
const NAV = [
  ['Operación', ['inicio', 'inventario', 'ingresos', 'salidas', 'kits', 'vencimientos']],
  ['Administración', ['admin/insumos', 'admin/kits', 'admin/catalogos', 'admin/ajustes', 'admin/config']],
];

function renderNav(d) {
  const badges = { kits: d.alertas.kitsPendientes.length, vencimientos: d.alertas.vencidos.length + d.alertas.porVencer.length, inventario: d.alertas.bajos.length + d.alertas.agotados.length };
  const mode = db.getMode();
  $('nav').innerHTML = `<div class="nav-brand"><span class="logo">${icon('box')}</span><div><b>${esc(d.cfg.nombre)}</b><small>Control de inventario</small></div>
      <button type="button" class="icon-btn nav-x" data-action="nav-close" aria-label="Cerrar menú">${icon('close')}</button></div>
    <div class="nav-scroll">${NAV.map(([title, ids]) => `<div class="nav-sec"><span class="nav-t">${title}</span>${ids.map((id) => {
      const v = BY_ID[id];
      const b = badges[id];
      return `<a href="#/${id}" class="nav-i ${ui.route.path === id ? 'on' : ''}" ${ui.route.path === id ? 'aria-current="page"' : ''}>${icon(v.icon)}<span>${v.title}</span>${b ? `<em>${b}</em>` : ''}</a>`;
    }).join('')}</div>`).join('')}</div>
    <div class="nav-foot"><span class="dbchip ${mode}">${icon('db')}${mode === 'supabase' ? 'Supabase' : 'Modo demo (local)'}</span>
      <button type="button" class="icon-btn" data-action="refresh" title="Recargar datos" aria-label="Recargar datos">${icon('refresh')}</button></div>`;
}

function renderTopbar() {
  const v = BY_ID[ui.route.path];
  $('topbar').innerHTML = `<button type="button" class="icon-btn" data-action="nav-open" aria-label="Abrir menú">${icon('menu')}</button>
    <b class="tb-title">${esc(v.title)}</b>
    <button type="button" class="icon-btn" data-action="refresh" aria-label="Recargar datos">${icon('refresh')}</button>`;
}

function renderTabbar(d) {
  const p = ui.route.path;
  const item = (id, label, ic, badge) => `<a href="#/${id}" class="tab ${p === id ? 'on' : ''}">${icon(ic)}<span>${label}</span>${badge ? `<em>${badge}</em>` : ''}</a>`;
  $('tabbar').innerHTML = item('inicio', 'Inicio', 'home') + item('inventario', 'Inventario', 'box') +
    `<button type="button" class="tab fab" data-action="quick" aria-label="Registrar">${icon('plus')}</button>` +
    item('kits', 'Kits', 'kit', d.alertas.kitsPendientes.length) +
    `<button type="button" class="tab ${p.startsWith('admin') || p === 'ingresos' || p === 'salidas' || p === 'vencimientos' ? 'on' : ''}" data-action="nav-open">${icon('menu')}<span>Más</span></button>`;
}

/** Re-renderiza un contenedor sin perder el foco ni la posición del cursor */
function withFocus(container, html) {
  const a = document.activeElement;
  let sel = null;
  if (a && container.contains(a) && a !== container) {
    if (a.id) sel = '#' + CSS.escape(a.id);
    else if (a.dataset.bind) sel = `[data-bind="${a.dataset.bind}"]`;
    else if (a.name && a.form && a.form.dataset.form) sel = `form[data-form="${a.form.dataset.form}"] [name="${a.name}"]`;
  }
  let range = null;
  try { range = a && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null; } catch (e) { range = null; }
  container.innerHTML = html;
  const el = sel && container.querySelector(sel);
  if (el) { el.focus({ preventScroll: true }); if (range) try { el.setSelectionRange(range[0], range[1]); } catch (e) { /* sin selección */ } }
}

function renderView(d) {
  const v = BY_ID[ui.route.path];
  try {
    withFocus($('view'), `<div class="page">${v.render({ d })}</div>`);
  } catch (e) {
    console.error(e);
    $('view').innerHTML = `<div class="page"><div class="empty">${icon('warn')}<p>Error al mostrar esta vista: ${esc(e.message)}</p></div></div>`;
  }
}

function render() {
  if (!store.getRaw()) return;
  const d = store.derive();
  document.title = `${BY_ID[ui.route.path].title} · ${d.cfg.nombre}`;
  renderNav(d); renderTopbar(); renderTabbar(d); renderView(d);
}

/* ---------- Acciones globales ---------- */
const GLOBAL = {
  go: (p) => go(p),
  'nav-open': () => document.body.classList.add('nav-open'),
  'nav-close': () => document.body.classList.remove('nav-open'),
  'modal-close': () => closeModal(),
  'modal-ok': () => runModalOk(),
  refresh: async () => { try { await store.load(); toast('Datos actualizados'); } catch (e) { toast(e.message, 'err'); } },
  theme: (t) => { ui.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* */ } applyTheme(); render(); },
  'draft-clear': (f) => { const keep = { ingreso: ['fecha'], salida: ['fecha', 'motivo'], entrega: ['fecha'] }[f] || []; const d = ui.drafts[f] || {}; ui.drafts[f] = {}; keep.forEach((k) => { if (d[k]) ui.drafts[f][k] = d[k]; }); saveDrafts(); render(); },
  quick: () => openModal('Registrar', `<div class="sheet">
      <a class="sheet-i" href="#/ingresos">${icon('in')}<span><b>Ingreso</b><small>Llegó mercadería</small></span></a>
      <a class="sheet-i" href="#/salidas">${icon('out')}<span><b>Salida</b><small>Retiro de bodega</small></span></a>
      <a class="sheet-i" href="#/kits?tab=entregar">${icon('kit')}<span><b>Entregar kit</b><small>Armar y prestar</small></span></a>
      <a class="sheet-i" href="#/kits?tab=prestamo">${icon('return')}<span><b>Devolución de kit</b><small>Recibir un kit</small></span></a>
      <a class="sheet-i" href="#/admin/ajustes">${icon('sliders')}<span><b>Ajuste de stock</b><small>Conteo físico</small></span></a>
    </div>`),
};

/* ---------- Eventos ---------- */
function setPath(path, value) {
  const [view, key] = path.split('.');
  const s = vs(view, () => ({}));
  s[key] = value;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.sheet-i')) closeModal();
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  e.preventDefault();
  const raw = el.dataset.action;
  const i = raw.indexOf(':');
  const name = i < 0 ? raw : raw.slice(0, i);
  const arg = i < 0 ? undefined : raw.slice(i + 1);
  const fn = GLOBAL[name] || ACTIONS[name];
  if (fn) fn(arg, el);
});

$('overlay').addEventListener('mousedown', (e) => { if (e.target.id === 'overlay') closeModal(); });
$('scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind) { setPath(t.dataset.bind, t.value); render(); return; }
  if (t.dataset.hook && HOOKS[t.dataset.hook]) { HOOKS[t.dataset.hook](t); return; }
  const form = t.form && t.form.dataset.draft;
  if (form && t.name) {
    ui.drafts[form] = Object.assign(ui.drafts[form] || {}, { [t.name]: t.type === 'checkbox' ? t.checked : t.value });
    saveDrafts();
    const p = PREVIEWS[form];
    if (p) { const out = p(store.derive()); const box = $(out.id); if (box) box.innerHTML = out.html; }
    if (form === 'ingreso' && t.name === 'insumo_id') render(); // muestra la unidad
  }
});

document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const h = FORMS[f.dataset.form];
  if (!h || ui.busy) return;
  const data = Object.fromEntries(new FormData(f).entries());
  const btn = f.querySelector('button[type=submit]');
  if (btn) btn.classList.add('loading');
  try { await h(data, f); } finally { if (btn && btn.isConnected) btn.classList.remove('loading'); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (modalOpen()) closeModal(); else document.body.classList.remove('nav-open'); }
});

window.addEventListener('hashchange', onRoute);

// Al volver a la app (otra pestaña o el celular desbloqueado) se refrescan los datos compartidos
document.addEventListener('visibilitychange', () => {
  const at = store.getLoadedAt();
  if (document.visibilityState === 'visible' && db.getMode() === 'supabase' && at && Date.now() - at.getTime() > 30000 && !ui.busy && !modalOpen()) {
    store.load().catch(() => {});
  }
});

/* ---------- Arranque ---------- */
async function boot() {
  const status = (msg) => { const s = $('boot-msg'); if (s) s.textContent = msg; };
  setHooks({ rerender: render, go });
  store.subscribe(render);
  try {
    await db.connect(status);
    status('Cargando datos…');
    ui.route = parseHash();
    const v = BY_ID[ui.route.path];
    await store.load();
    if (v.enter) v.enter(ui.route.q);
    render();
    $('boot').remove();
    document.body.classList.add('ready');
  } catch (e) {
    console.error(e);
    $('boot').innerHTML = `<div class="boot-card">${icon('warn')}<h1>No se pudo iniciar</h1><p>${esc(e.message || String(e))}</p>
      <p class="small muted">${db.getMode() === 'supabase' ? 'Revisa SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js y que hayas ejecutado sql/schema.sql y sql/supabase.sql.' : 'El modo demo necesita internet la primera vez (descarga la base de datos local) y abrir la app desde un servidor (no con doble clic). Ver README.'}</p>
      <button class="btn primary" onclick="location.reload()">Reintentar</button></div>`;
  }
}
boot();

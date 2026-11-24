/* Estado de interfaz compartido por las vistas (sin depender de app.js) */
import * as store from './store.js';
import { toast, esc } from './ui.js';

const DRAFT_KEY = 'bodega.borradores.v1';
export const ui = { v: {}, drafts: {}, busy: false, route: { path: 'inicio', q: {} } };
try { ui.drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch (e) { ui.drafts = {}; }
export const saveDrafts = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(ui.drafts)); } catch (e) { /* sin storage */ } };

const hooks = { rerender: () => {}, go: () => {} };
export const setHooks = (h) => Object.assign(hooks, h);
export const rerender = () => hooks.rerender();
export const go = (path) => hooks.go(path);

/** Estado propio de una vista (filtros, pestañas…) */
export const vs = (id, init) => ui.v[id] || (ui.v[id] = init());

/** Valor de borrador de un formulario */
export const dv = (form, name, def) => { const d = ui.drafts[form]; return d && d[name] != null ? d[name] : def; };
export function setDraft(form, values) { ui.drafts[form] = Object.assign({}, values); saveDrafts(); }
export function clearDraft(form, keep) {
  const d = ui.drafts[form] || {};
  ui.drafts[form] = {};
  (keep || []).forEach((k) => { if (d[k] != null) ui.drafts[form][k] = d[k]; });
  saveDrafts();
}

/** Ejecuta una escritura en la base de datos con indicador de carga, recarga y aviso */
export async function run(fn, okMsg) {
  if (ui.busy) return false;
  ui.busy = true;
  document.body.classList.add('busy');
  try {
    await store.mutate(fn);
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    toast(e.message || String(e), 'err');
    return false;
  } finally {
    ui.busy = false;
    document.body.classList.remove('busy');
  }
}

/** <select> de insumos agrupado por categoría */
export function insumoOptions(d, selected, opts = {}) {
  const groups = {};
  d.insumos.filter((i) => i.activo || i.id === Number(selected)).forEach((i) => { (groups[i.categoria] = groups[i.categoria] || []).push(i); });
  return `<option value="">${esc(opts.placeholder || 'Selecciona un insumo')}</option>` + Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es')).map((c) =>
    `<optgroup label="${esc(c)}">${groups[c].map((i) => `<option value="${i.id}" ${String(i.id) === String(selected) ? 'selected' : ''}>${esc(i.nombre)} · ${esc(i.codigo)}${opts.stock ? ` (${d.stock[i.id].utilizable} ${esc(i.unidad)})` : ''}</option>`).join('')}</optgroup>`).join('');
}

export const int = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
export const idOrNull = (v) => (v === '' || v == null ? null : Number(v));

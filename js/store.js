/* Estado de la aplicación: carga desde la base de datos y cálculos derivados */
import * as db from './db.js';

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => toISO(new Date());
export const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return toISO(new Date(y, m - 1, d + n)); };
export const diffDays = (a, b) => {
  const u = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((u(b) - u(a)) / 86400000);
};

export const MOTIVOS_SALIDA = ['Despacho', 'Baja por vencimiento', 'Merma / daño', 'Préstamo externo', 'Otro'];
export const MOTIVOS_AJUSTE = ['Conteo físico', 'Error de registro', 'Pérdida', 'Hallazgo', 'Otro'];

const listeners = new Set();
let raw = null;
let cache = null;
let loadedAt = null;

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getRaw = () => raw;
export const getLoadedAt = () => loadedAt;
const emit = () => listeners.forEach((f) => f());

export async function load() {
  const names = ['configuracion', 'categorias', 'unidades', 'insumos', 'v_lotes', 'kits', 'kit_items', 'entregas', 'entrega_items', 'operaciones', 'movimientos'];
  const res = await Promise.all(names.map((n) => db.selectAll(n)));
  const r = {};
  names.forEach((n, i) => { r[n] = res[i]; });
  r.lotes = r.v_lotes;
  delete r.v_lotes;
  raw = r;
  cache = null;
  loadedAt = new Date();
  emit();
}

/** Ejecuta una escritura y recarga los datos */
export async function mutate(fn) {
  const out = await fn(db);
  await load();
  return out;
}

export function config() {
  const c = {};
  (raw ? raw.configuracion : []).forEach((x) => { c[x.clave] = x.valor; });
  return { nombre: c.nombre_bodega || 'Bodega', dias: Math.max(1, Number(c.dias_por_vencer) || 30) };
}

function estadoLote(vence, hoy, dias) {
  if (!vence) return 'vigente';
  const d = diffDays(hoy, vence);
  if (d < 0) return 'vencido';
  if (d <= dias) return 'porvencer';
  return 'vigente';
}

export function derive() {
  if (cache && cache.hoy === today()) return cache;
  const s = raw;
  const hoy = today();
  const cfg = config();
  const by = (arr) => { const m = {}; arr.forEach((x) => { m[x.id] = x; }); return m; };
  const cat = by(s.categorias);
  const uni = by(s.unidades);

  const insumos = s.insumos.map((i) => Object.assign({}, i, {
    categoria: cat[i.categoria_id] ? cat[i.categoria_id].nombre : 'Sin categoría',
    unidad: uni[i.unidad_id] ? uni[i.unidad_id].nombre : 'unidad',
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const ins = by(insumos);

  const lotes = s.lotes.map((l) => Object.assign({}, l, {
    insumo: ins[l.insumo_id],
    estado: estadoLote(l.vence, hoy, cfg.dias),
    dias: l.vence ? diffDays(hoy, l.vence) : null,
    usado: l.cantidad - l.disponible,
  }));
  const lot = by(lotes);

  // movimientos por operación
  const movByOp = {};
  s.movimientos.forEach((m) => { (movByOp[m.operacion_id] = movByOp[m.operacion_id] || []).push(Object.assign({}, m, { lote: lot[m.lote_id] })); });
  const operaciones = s.operaciones.map((o) => {
    const movs = movByOp[o.id] || [];
    return Object.assign({}, o, { movs, total: movs.reduce((a, m) => a + m.cantidad, 0), insumo: ins[o.insumo_id] || (movs[0] && movs[0].lote && movs[0].lote.insumo) });
  }).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

  // kits y entregas
  const itemsByKit = {};
  s.kit_items.forEach((k) => { (itemsByKit[k.kit_id] = itemsByKit[k.kit_id] || []).push(Object.assign({}, k, { insumo: ins[k.insumo_id] })); });
  const kits = s.kits.map((k) => Object.assign({}, k, { items: (itemsByKit[k.id] || []).sort((a, b) => (a.insumo ? a.insumo.nombre : '').localeCompare(b.insumo ? b.insumo.nombre : '', 'es')) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const itemsByEnt = {};
  s.entrega_items.forEach((e) => { (itemsByEnt[e.entrega_id] = itemsByEnt[e.entrega_id] || []).push(Object.assign({}, e, { insumo: ins[e.insumo_id] })); });
  const entregas = s.entregas.map((e) => Object.assign({}, e, {
    items: itemsByEnt[e.id] || [],
    diasFuera: diffDays(e.fecha_entrega, e.fecha_devolucion || hoy),
  })).sort((a, b) => b.fecha_entrega.localeCompare(a.fecha_entrega) || b.id - a.id);

  // stock por insumo
  const stock = {};
  insumos.forEach((i) => { stock[i.id] = { insumo: i, ingresado: 0, disponible: 0, vencido: 0, porvencer: 0, vigente: 0, utilizable: 0, prestado: 0, proxVence: null, lotes: [], estado: 'ok' }; });
  lotes.forEach((l) => {
    const r = stock[l.insumo_id];
    if (!r) return;
    r.ingresado += l.cantidad;
    r.disponible += l.disponible;
    if (l.disponible > 0) {
      r[l.estado] += l.disponible;
      if (l.vence && l.estado !== 'vencido' && (!r.proxVence || l.vence < r.proxVence)) r.proxVence = l.vence;
    }
    r.lotes.push(l);
  });
  entregas.filter((e) => e.estado === 'entregado').forEach((e) => e.items.forEach((it) => { if (stock[it.insumo_id]) stock[it.insumo_id].prestado += it.cantidad; }));
  Object.values(stock).forEach((r) => {
    r.utilizable = r.vigente + r.porvencer;
    r.estado = !r.insumo.activo ? 'inactivo' : r.utilizable <= 0 ? 'agotado' : r.utilizable <= r.insumo.stock_minimo ? 'bajo' : 'ok';
    r.lotes.sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999') || a.id - b.id);
  });

  const categorias = s.categorias.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const porCategoria = categorias.map((c) => ({ id: c.id, nombre: c.nombre, insumos: 0, vigente: 0, porvencer: 0, vencido: 0 }));
  const pc = by(porCategoria);
  Object.values(stock).forEach((r) => { const x = pc[r.insumo.categoria_id]; if (x) { x.insumos++; x.vigente += r.vigente; x.porvencer += r.porvencer; x.vencido += r.vencido; } });

  const activos = Object.values(stock).filter((r) => r.insumo.activo);
  const alertas = {
    vencidos: lotes.filter((l) => l.estado === 'vencido' && l.disponible > 0).sort((a, b) => a.vence.localeCompare(b.vence)),
    porVencer: lotes.filter((l) => l.estado === 'porvencer' && l.disponible > 0).sort((a, b) => a.vence.localeCompare(b.vence)),
    bajos: activos.filter((r) => r.estado === 'bajo'),
    agotados: activos.filter((r) => r.estado === 'agotado'),
    kitsPendientes: entregas.filter((e) => e.estado === 'entregado'),
  };
  alertas.total = alertas.vencidos.length + alertas.porVencer.length + alertas.bajos.length + alertas.agotados.length;

  cache = { hoy, cfg, insumos, ins, lotes, lot, operaciones, kits, entregas, stock, categorias, unidades: s.unidades.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), porCategoria, alertas };
  return cache;
}

/** Plan FEFO del lado del cliente (solo para vista previa; la base de datos hace el cálculo real) */
export function previewFefo(insumoId, cantidad, fecha, motivo) {
  const d = derive();
  const r = d.stock[insumoId];
  if (!r) return { asign: [], disponible: 0, faltante: cantidad };
  let lots = r.lotes.filter((l) => l.disponible > 0 && l.fecha_ingreso <= fecha);
  if (motivo === 'Despacho' || motivo === 'kit') lots = lots.filter((l) => !l.vence || l.vence >= fecha);
  else if (motivo === 'Baja por vencimiento') lots = lots.filter((l) => l.vence && l.vence < fecha);
  lots.sort((a, b) => (a.vence || '9999-12-31').localeCompare(b.vence || '9999-12-31') || a.fecha_ingreso.localeCompare(b.fecha_ingreso) || a.id - b.id);
  let need = cantidad;
  const asign = [];
  for (const l of lots) { if (need <= 0) break; const t = Math.min(need, l.disponible); asign.push({ lote: l, cantidad: t }); need -= t; }
  return { asign, disponible: lots.reduce((a, l) => a + l.disponible, 0), faltante: Math.max(0, need) };
}

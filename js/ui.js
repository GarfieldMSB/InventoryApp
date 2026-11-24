/* Utilidades de interfaz: formato, componentes, toasts, modales */
import { icon } from './icons.js';
export { icon };

export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-CL');
export const num = (n) => nf.format(Number(n) || 0);
export const fdate = (iso) => (iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : '—');
export const fshort = (iso) => {
  if (!iso) return '—';
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(iso.slice(5, 7)) - 1];
  return Number(iso.slice(8, 10)) + ' ' + m;
};

const ESTADOS = {
  vencido: ['Vencido', 'red'], porvencer: ['Por vencer', 'amber'], vigente: ['Vigente', 'green'],
  agotado: ['Agotado', 'red'], bajo: ['Stock bajo', 'amber'], ok: ['OK', 'green'], inactivo: ['Inactivo', 'gray'],
  entregado: ['En préstamo', 'blue'], devuelto: ['Devuelto', 'gray'],
};
export const estadoLabel = (e) => (ESTADOS[e] ? ESTADOS[e][0] : e);
export const badge = (estado, txt) => { const e = ESTADOS[estado] || [estado, 'gray']; return `<span class="badge ${e[1]}">${esc(txt || e[0])}</span>`; };
export const tag = (txt, color) => `<span class="badge ${color || 'gray'}">${esc(txt)}</span>`;

export function diasTxt(d) {
  if (d == null) return '<span class="muted">No vence</span>';
  if (d < 0) return `<span class="c-red">venció hace ${-d} d</span>`;
  if (d === 0) return '<span class="c-amber">vence hoy</span>';
  return `en ${d} d`;
}

export const pageHead = (title, sub, actions) => `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
export const button = (label, action, opts = {}) => `<button type="button" class="btn ${opts.cls || ''}" data-action="${esc(action)}"${opts.title ? ` title="${esc(opts.title)}"` : ''}>${opts.icon ? icon(opts.icon) : ''}${label ? `<span>${esc(label)}</span>` : ''}</button>`;
export const iconButton = (ic, action, title, cls) => `<button type="button" class="icon-btn ${cls || ''}" data-action="${esc(action)}" title="${esc(title)}" aria-label="${esc(title)}">${icon(ic)}</button>`;
export const emptyState = (msg, action) => `<div class="empty">${icon('box')}<p>${msg}</p>${action || ''}</div>`;
export const searchBox = (bind, value, ph) => `<label class="search">${icon('search')}<input type="search" data-bind="${bind}" value="${esc(value)}" placeholder="${esc(ph || 'Buscar…')}" aria-label="${esc(ph || 'Buscar')}"></label>`;
export const seg = (items, current, action) => `<div class="seg" role="tablist">${items.map(([v, l, n]) => `<button type="button" role="tab" aria-selected="${v === current}" class="${v === current ? 'on' : ''}" data-action="${esc(action)}:${esc(v)}">${esc(l)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
export const match = (q, ...f) => !q || f.join(' ').toLowerCase().includes(String(q).toLowerCase().trim());

export function stackBar(x) {
  const t = x.vigente + x.porvencer + x.vencido;
  if (!t) return '<div class="stack"></div>';
  const w = (v) => ((v / t) * 100).toFixed(2) + '%';
  return `<div class="stack" title="Vigente ${num(x.vigente)} · Por vencer ${num(x.porvencer)} · Vencido ${num(x.vencido)}"><i class="bg-green" style="width:${w(x.vigente)}"></i><i class="bg-amber" style="width:${w(x.porvencer)}"></i><i class="bg-red" style="width:${w(x.vencido)}"></i></div>`;
}

/**
 * Tabla responsiva: en el celular cada fila se vuelve una tarjeta con etiquetas.
 * cols: [{ h: 'Título', cls: 'num|main|act' }]
 * rows: arrays de celdas, o { cells, cls, attrs, after } o { group: html }
 */
export function rtable(cols, rows, opts = {}) {
  const body = rows.map((r) => {
    const row = Array.isArray(r) ? { cells: r } : r;
    if (row.group != null) return `<tr class="grp"><td colspan="${cols.length}">${row.group}</td></tr>`;
    return `<tr class="${row.cls || ''}" ${row.attrs || ''}>${row.cells.map((c, i) => `<td class="${cols[i].cls || ''}" data-l="${esc(cols[i].h)}">${c}</td>`).join('')}</tr>${row.after || ''}`;
  }).join('');
  return `<div class="table-card ${opts.wrapCls || ''}"><table class="rt"><thead><tr>${cols.map((c) => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody>${opts.foot ? `<tfoot>${opts.foot}</tfoot>` : ''}</table></div>`;
}

/* ---------- Toasts ---------- */
export function toast(msg, type) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'ok');
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = icon(type === 'err' ? 'warn' : 'check') + '<span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, type === 'err' ? 6000 : 2800);
}

/* ---------- Modal (en celular aparece como hoja inferior) ---------- */
let onOk = null;
export function openModal(title, body, opts = {}) {
  const ov = document.getElementById('overlay');
  ov.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-action="modal-close" aria-label="Cerrar">${icon('close')}</button></div>
    <div class="modal-body">${body}</div>${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}</div>`;
  ov.classList.add('open');
  document.body.classList.add('modal-open');
  const f = ov.querySelector('[autofocus], input:not([type=hidden]):not([readonly]), select, textarea');
  if (f && window.innerWidth > 700) setTimeout(() => f.focus(), 40);
}
export function closeModal() {
  const ov = document.getElementById('overlay');
  ov.classList.remove('open');
  ov.innerHTML = '';
  document.body.classList.remove('modal-open');
  onOk = null;
}
export const modalOpen = () => document.getElementById('overlay').classList.contains('open');
export function confirmDialog(title, msg, okLabel, fn, danger) {
  openModal(title, `<p class="confirm">${msg}</p>`, {
    footer: `<button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-action="modal-ok">${esc(okLabel)}</button>`,
  });
  onOk = fn;
}
export function runModalOk() { const f = onOk; onOk = null; if (f) f(); }

/* ---------- Descargas ---------- */
export function download(name, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/** CSV con ";" y BOM: se abre directo en Excel en español */
export function csv(name, rows) {
  const cell = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  download(name, '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

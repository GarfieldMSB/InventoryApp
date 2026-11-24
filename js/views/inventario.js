import { esc, num, fdate, badge, diasTxt, pageHead, button, emptyState, searchBox, seg, match, stackBar, rtable, csv, estadoLabel, tag } from '../ui.js';
import { vs, rerender } from '../core.js';
import { derive } from '../store.js';

const S = () => vs('inventario', () => ({ q: '', cat: '', estado: '', tab: 'insumo', open: {} }));

function lotTable(r) {
  if (!r.lotes.length) return '<p class="muted pad">Sin lotes registrados.</p>';
  return `<div class="lots">${r.lotes.map((l) => `<div class="lot ${l.disponible ? '' : 'dim'}">
    <div><b class="mono">${esc(l.codigo_lote || '#' + l.id)}</b><small>Ingresó ${fdate(l.fecha_ingreso)}${l.proveedor ? ' · ' + esc(l.proveedor) : ''}</small></div>
    <div><small>Vence</small><span>${l.vence ? fdate(l.vence) : '—'} <small>${diasTxt(l.dias)}</small></span></div>
    <div class="num"><small>Ingresó / usado</small><span>${num(l.cantidad)} / ${num(l.usado)}</span></div>
    <div class="num"><small>Disponible</small><b>${num(l.disponible)}</b></div>
    <div>${l.disponible ? badge(l.estado) : '<span class="muted">Consumido</span>'}</div></div>`).join('')}</div>`;
}

export default {
  id: 'inventario', title: 'Inventario', icon: 'box',
  enter(q) { const s = S(); if (q.q != null) { s.q = q.q; s.cat = ''; s.estado = ''; s.tab = 'insumo'; } if (q.estado != null) { s.estado = q.estado; s.q = ''; } if (q.cat != null) s.cat = q.cat; },
  render({ d }) {
    const s = S();
    const rows = Object.values(d.stock).filter((r) => {
      const i = r.insumo;
      if (s.cat && String(i.categoria_id) !== s.cat) return false;
      if (!s.estado && !i.activo) return false;
      if (s.estado === 'alerta' && !(r.estado === 'bajo' || r.estado === 'agotado')) return false;
      if (s.estado && s.estado !== 'alerta' && r.estado !== s.estado) return false;
      return match(s.q, i.codigo, i.nombre, i.categoria, r.lotes.map((l) => l.codigo_lote).join(' '));
    }).sort((a, b) => a.insumo.categoria.localeCompare(b.insumo.categoria, 'es') || a.insumo.nombre.localeCompare(b.insumo.nombre, 'es'));

    const filters = `<div class="toolbar">
      ${seg([['insumo', 'Por insumo'], ['categoria', 'Por categoría y vencimiento']], s.tab, 'inv-tab')}
      ${searchBox('inventario.q', s.q, 'Buscar insumo, código o lote')}
      <select data-bind="inventario.cat" aria-label="Categoría"><option value="">Todas las categorías</option>${d.categorias.map((c) => `<option value="${c.id}" ${String(c.id) === s.cat ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
      <select data-bind="inventario.estado" aria-label="Estado">${[['', 'Activos'], ['alerta', 'Solo alertas'], ['ok', 'OK'], ['bajo', 'Stock bajo'], ['agotado', 'Agotados'], ['inactivo', 'Inactivos']].map(([v, l]) => `<option value="${v}" ${s.estado === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${s.q || s.cat || s.estado ? button('Limpiar', 'inv-clear', { cls: 'ghost sm', icon: 'close' }) : ''}
    </div>`;

    let body;
    if (!rows.length) body = emptyState('No hay insumos con estos filtros.');
    else if (s.tab === 'insumo') {
      body = rtable(
        [{ h: 'Insumo', cls: 'main' }, { h: 'En bodega', cls: 'num' }, { h: 'Utilizable', cls: 'num' }, { h: 'Vencido', cls: 'num' }, { h: 'En préstamo', cls: 'num' }, { h: 'Mínimo', cls: 'num' }, { h: 'Próx. vencimiento' }, { h: 'Estado' }],
        rows.map((r) => {
          const i = r.insumo; const open = !!s.open[i.id];
          return {
            cls: 'clickable' + (open ? ' open' : ''), attrs: `data-action="inv-open:${i.id}" aria-expanded="${open}"`,
            cells: [
              `<b>${esc(i.nombre)}</b><small>${esc(i.codigo)} · ${esc(i.categoria)} · ${esc(i.unidad)}${i.reutilizable ? ' · reutilizable' : ''}</small>`,
              num(r.disponible), `<b>${num(r.utilizable)}</b>`, r.vencido ? `<span class="c-red">${num(r.vencido)}</span>` : '<span class="muted">0</span>',
              r.prestado ? `<span class="c-blue">${num(r.prestado)}</span>` : '<span class="muted">0</span>', `<span class="muted">${num(i.stock_minimo)}</span>`,
              r.proxVence ? fdate(r.proxVence) : '<span class="muted">—</span>', badge(r.estado) + (r.vencido ? ' ' + tag('Con vencidos', 'red') : ''),
            ],
            after: open ? `<tr class="sub"><td colspan="8">${lotTable(r)}</td></tr>` : '',
          };
        }));
    } else {
      const groups = {};
      rows.forEach((r) => { (groups[r.insumo.categoria] = groups[r.insumo.categoria] || []).push(r); });
      const out = [];
      Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es')).forEach((c) => {
        const t = groups[c].reduce((a, r) => ({ vigente: a.vigente + r.vigente, porvencer: a.porvencer + r.porvencer, vencido: a.vencido + r.vencido }), { vigente: 0, porvencer: 0, vencido: 0 });
        out.push({ group: `<div class="grp-row"><b>${esc(c)}</b><span class="muted">${groups[c].length} insumos</span><span class="c-green">${num(t.vigente)} vigente</span><span class="c-amber">${num(t.porvencer)} por vencer</span><span class="c-red">${num(t.vencido)} vencido</span></div>` });
        groups[c].forEach((r) => out.push([`<b>${esc(r.insumo.nombre)}</b><small>${esc(r.insumo.unidad)}</small>`, num(r.vigente), r.porvencer ? `<span class="c-amber">${num(r.porvencer)}</span>` : '0', r.vencido ? `<span class="c-red">${num(r.vencido)}</span>` : '0', num(r.disponible), stackBar(r)]));
      });
      body = rtable([{ h: 'Insumo', cls: 'main' }, { h: 'Vigente', cls: 'num' }, { h: 'Por vencer', cls: 'num' }, { h: 'Vencido', cls: 'num' }, { h: 'Total', cls: 'num' }, { h: 'Distribución', cls: 'wbar' }], out);
    }

    return pageHead('Inventario', 'Stock calculado automáticamente: <b>ingresos − salidas − kits prestados + devoluciones ± ajustes</b>. Toca un insumo para ver sus lotes.',
      button('Exportar CSV', 'inv-csv', { icon: 'download', cls: 'ghost' })) + filters + body;
  },
  actions: {
    'inv-tab': (t) => { S().tab = t; rerender(); },
    'inv-open': (id) => { const s = S(); s.open[id] = !s.open[id]; rerender(); },
    'inv-clear': () => { Object.assign(S(), { q: '', cat: '', estado: '' }); rerender(); },
    'inv-csv': () => {
      const d = derive();
      csv(`inventario-${d.hoy}.csv`, [['Código', 'Insumo', 'Categoría', 'Unidad', 'Ingresado', 'En bodega', 'Vigente', 'Por vencer', 'Vencido', 'Utilizable', 'En préstamo', 'Stock mínimo', 'Próx. vencimiento', 'Estado']]
        .concat(Object.values(d.stock).map((r) => [r.insumo.codigo, r.insumo.nombre, r.insumo.categoria, r.insumo.unidad, r.ingresado, r.disponible, r.vigente, r.porvencer, r.vencido, r.utilizable, r.prestado, r.insumo.stock_minimo, r.proxVence ? fdate(r.proxVence) : '', estadoLabel(r.estado)])));
    },
  },
};

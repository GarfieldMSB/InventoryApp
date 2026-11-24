import { esc, num, fdate, badge, diasTxt, pageHead, button, emptyState, seg, rtable, openModal, closeModal, stackBar, csv, estadoLabel, icon } from '../ui.js';
import { vs, run, int, rerender } from '../core.js';
import { derive } from '../store.js';

const S = () => vs('vencimientos', () => ({ f: 'todos', cat: '' }));

export default {
  id: 'vencimientos', title: 'Vencimientos', icon: 'clock',
  enter(q) { if (q.f) S().f = q.f; },
  render({ d }) {
    const s = S();
    const base = d.lotes.filter((l) => l.disponible > 0 && l.vence && l.insumo && (!s.cat || String(l.insumo.categoria_id) === s.cat));
    const c = { todos: base.length, vencido: 0, porvencer: 0, vigente: 0 };
    base.forEach((l) => { c[l.estado]++; });
    const list = base.filter((l) => s.f === 'todos' || l.estado === s.f).sort((a, b) => a.vence.localeCompare(b.vence));

    const cards = `<div class="catcards">${d.porCategoria.filter((x) => x.insumos).map((x) => `<button type="button" class="catcard ${String(x.id) === s.cat ? 'on' : ''}" data-action="ven-cat:${x.id}">
      <span class="cc-h"><b>${esc(x.nombre)}</b><small>${x.insumos} insumos</small></span>${stackBar(x)}
      <span class="cc-n"><span class="c-green">${num(x.vigente)}<small>vigente</small></span><span class="c-amber">${num(x.porvencer)}<small>por vencer</small></span><span class="c-red">${num(x.vencido)}<small>vencido</small></span></span></button>`).join('')}</div>`;

    const table = list.length ? rtable(
      [{ h: 'Insumo', cls: 'main' }, { h: 'Vence' }, { h: 'Plazo' }, { h: 'Lote' }, { h: 'Disponible', cls: 'num' }, { h: 'Estado' }, { h: '', cls: 'act' }],
      list.map((l) => ({
        cls: 'r-' + l.estado,
        cells: [`<b>${esc(l.insumo.nombre)}</b><small>${esc(l.insumo.categoria)}</small>`, fdate(l.vence), diasTxt(l.dias), `<span class="mono">${esc(l.codigo_lote || '#' + l.id)}</span>`,
          `<b>${num(l.disponible)}</b> <small>${esc(l.insumo.unidad)}</small>`, badge(l.estado),
          l.estado === 'vencido' ? button('Dar de baja', 'ven-baja:' + l.id, { cls: 'danger sm' }) : ''],
      }))) : emptyState('No hay lotes en este filtro.');

    return pageHead('Vencimientos', `<b>Vencido</b>: fecha pasada · <b>Por vencer</b>: ${d.cfg.dias} días o menos · <b>Vigente</b>: más de ${d.cfg.dias} días.`, button('Exportar CSV', 'ven-csv', { icon: 'download', cls: 'ghost' })) + cards +
      `<div class="toolbar">${seg([['todos', 'Todos', c.todos], ['vencido', 'Vencidos', c.vencido], ['porvencer', 'Por vencer', c.porvencer], ['vigente', 'Vigentes', c.vigente]], s.f, 'ven-f')}
       ${s.cat ? button('Quitar filtro de categoría', 'ven-cat:' + s.cat, { cls: 'ghost sm', icon: 'close' }) : ''}</div>` + table;
  },
  forms: {
    baja: async (f, form) => {
      const l = derive().lot[Number(form.dataset.id)];
      const ok = await run((db) => db.rpc('registrar_salida', {
        p_insumo: l.insumo_id, p_cantidad: int(f.cantidad), p_fecha: derive().hoy, p_motivo: 'Baja por vencimiento',
        p_destino: 'Eliminación', p_persona: f.persona, p_nota: f.nota, p_lote: l.id,
      }), 'Lote dado de baja');
      if (ok) closeModal();
      return ok;
    },
  },
  actions: {
    'ven-f': (f) => { S().f = f; rerender(); },
    'ven-cat': (id) => { const s = S(); s.cat = s.cat === id ? '' : id; rerender(); },
    'ven-baja': (id) => {
      const l = derive().lot[Number(id)];
      if (!l) return;
      openModal('Dar de baja lote vencido', `<form data-form="baja" data-id="${l.id}" autocomplete="off">
        <p class="small">Se registra una salida por <b>baja por vencimiento</b> del lote <span class="mono">${esc(l.codigo_lote || '#' + l.id)}</span> de <b>${esc(l.insumo.nombre)}</b> (venció el ${fdate(l.vence)}).</p>
        <div class="fields f-modal">
          <label>Cantidad *<input type="number" inputmode="numeric" name="cantidad" min="1" max="${l.disponible}" value="${l.disponible}" required></label>
          <label>Responsable<input name="persona"></label>
          <label class="f2">Observación<input name="nota" placeholder="Ej: enviado a eliminación"></label>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn danger" type="submit">${icon('trash')}<span>Dar de baja</span></button></div></form>`);
    },
    'ven-csv': () => {
      const d = derive();
      csv(`vencimientos-${d.hoy}.csv`, [['Vencimiento', 'Días', 'Código', 'Insumo', 'Categoría', 'Lote', 'Disponible', 'Unidad', 'Estado']]
        .concat(d.lotes.filter((l) => l.disponible > 0 && l.vence).sort((a, b) => a.vence.localeCompare(b.vence)).map((l) => [fdate(l.vence), l.dias, l.insumo.codigo, l.insumo.nombre, l.insumo.categoria, l.codigo_lote, l.disponible, l.insumo.unidad, estadoLabel(l.estado)])));
    },
  },
};

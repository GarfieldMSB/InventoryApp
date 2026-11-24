import { esc, num, fdate, badge, pageHead, iconButton, emptyState, rtable, confirmDialog, icon, toast } from '../ui.js';
import { vs, dv, run, insumoOptions, int } from '../core.js';
import { MOTIVOS_AJUSTE, today } from '../store.js';

const S = () => vs('admin-ajustes', () => ({ insumo: '' }));
const F = 'ajuste';

export default {
  id: 'admin/ajustes', title: 'Ajustes de stock', icon: 'sliders', admin: true,
  render({ d }) {
    const s = S();
    const r = s.insumo ? d.stock[Number(s.insumo)] : null;
    const hist = d.operaciones.filter((o) => o.tipo === 'ajuste');

    const lots = r ? (r.lotes.length ? rtable(
      [{ h: 'Lote', cls: 'main' }, { h: 'Vence' }, { h: 'Estado' }, { h: 'Sistema', cls: 'num' }, { h: 'Conteo físico', cls: 'wform' }],
      r.lotes.map((l) => [
        `<b class="mono">${esc(l.codigo_lote || '#' + l.id)}</b><small>Ingresó ${fdate(l.fecha_ingreso)}</small>`, l.vence ? fdate(l.vence) : '—', l.disponible ? badge(l.estado) : '<span class="muted">Sin stock</span>',
        `<b>${num(l.disponible)}</b>`,
        `<form class="inline-form" data-form="ajuste-lote" data-lote="${l.id}" data-sis="${l.disponible}" autocomplete="off"><input type="number" inputmode="numeric" name="contado" min="0" step="1" required placeholder="${l.disponible}" aria-label="Cantidad contada" class="short"><button class="btn sm" type="submit">Ajustar</button></form>`,
      ])) : emptyState('Este insumo no tiene lotes. Registra un ingreso primero.')) : '';

    return pageHead('Ajustes de stock', 'Corrige diferencias entre el sistema y un conteo físico. Cada ajuste queda registrado con su motivo y se puede anular.') +
      `<section class="card form"><div class="card-h"><h2>${icon('sliders')} Nuevo ajuste</h2></div>
        <form class="fields" data-form="ajuste-cfg" data-draft="${F}" autocomplete="off" onsubmit="return false">
          <label class="f2">Insumo<select data-bind="admin-ajustes.insumo">${insumoOptions(d, s.insumo, { placeholder: 'Selecciona el insumo a contar' })}</select></label>
          <label>Motivo<select name="motivo">${MOTIVOS_AJUSTE.map((m) => `<option ${m === dv(F, 'motivo', 'Conteo físico') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Fecha<input type="date" name="fecha" max="${d.hoy}" value="${esc(dv(F, 'fecha', d.hoy))}"></label>
          <label class="f4">Observación<input name="nota" value="${esc(dv(F, 'nota', ''))}" placeholder="Ej: inventario mensual de noviembre"></label>
        </form>
        ${r ? `<p class="small muted">Escribe la cantidad <b>contada</b> en el lote que tenga diferencia. El sistema registra la diferencia automáticamente.</p>${lots}` : '<p class="muted small">Elige un insumo para ver sus lotes.</p>'}
      </section>
      <h3 class="section-t">Historial de ajustes</h3>` +
      (hist.length ? rtable([{ h: 'Insumo', cls: 'main' }, { h: 'Fecha' }, { h: 'Diferencia', cls: 'num' }, { h: 'Lote' }, { h: 'Motivo' }, { h: 'Observación' }, { h: '', cls: 'act' }],
        hist.map((o) => [`<b>${esc(o.insumo ? o.insumo.nombre : '?')}</b>`, fdate(o.fecha), `<b class="${o.total > 0 ? 'c-green' : 'c-red'}">${o.total > 0 ? '+' : ''}${num(o.total)}</b>`,
          `<span class="mono">${o.movs.map((m) => esc(m.lote ? m.lote.codigo_lote || '#' + m.lote.id : '?')).join(', ')}</span>`, esc(o.motivo || ''), esc(o.nota || ''), iconButton('undo', 'aj-del:' + o.id, 'Anular ajuste')]))
        : emptyState('Sin ajustes registrados.'));
  },
  forms: {
    'ajuste-lote': async (f, el) => {
      const contado = int(f.contado);
      if (contado == null || contado < 0) { toast('Escribe la cantidad contada', 'err'); return false; }
      if (contado === Number(el.dataset.sis)) { toast('No hay diferencia con el sistema', 'err'); return false; }
      return run((db) => db.rpc('ajustar_stock', { p_lote: Number(el.dataset.lote), p_contado: contado, p_fecha: dv(F, 'fecha', null) || today(), p_motivo: dv(F, 'motivo', 'Conteo físico'), p_nota: dv(F, 'nota', '') }),
        `Ajuste registrado: ${contado - Number(el.dataset.sis) > 0 ? '+' : ''}${contado - Number(el.dataset.sis)}`);
    },
  },
  actions: {
    'aj-del': (id) => confirmDialog('Anular ajuste', 'El lote vuelve a la cantidad que tenía antes del ajuste.', 'Anular', () => run((db) => db.rpc('anular_operacion', { p_op: Number(id) }), 'Ajuste anulado'), true),
  },
};

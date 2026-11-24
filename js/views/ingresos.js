import { esc, num, fdate, badge, pageHead, button, iconButton, emptyState, searchBox, match, rtable, confirmDialog, csv, icon } from '../ui.js';
import { vs, dv, run, clearDraft, insumoOptions, int, idOrNull } from '../core.js';
import { derive } from '../store.js';

const S = () => vs('ingresos', () => ({ q: '', desde: '', hasta: '' }));
const F = 'ingreso';

export default {
  id: 'ingresos', title: 'Ingresos', icon: 'in',
  render({ d }) {
    const s = S();
    const sel = d.ins[Number(dv(F, 'insumo_id', ''))];
    const list = d.lotes.filter((l) => (!s.desde || l.fecha_ingreso >= s.desde) && (!s.hasta || l.fecha_ingreso <= s.hasta) &&
      match(s.q, l.insumo && l.insumo.nombre, l.insumo && l.insumo.codigo, l.codigo_lote, l.proveedor, l.documento))
      .sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso) || b.id - a.id);
    const provs = [...new Set(d.lotes.map((l) => l.proveedor).filter(Boolean))];

    const form = `<form class="card form" data-form="${F}" data-draft="${F}" autocomplete="off">
      <div class="card-h"><h2>${icon('in')} Nuevo ingreso</h2><button type="button" class="link" data-action="go:admin/insumos?nuevo=1">${icon('plus')} Crear insumo</button></div>
      <div class="fields">
        <label class="f2">Insumo *<select name="insumo_id" required>${insumoOptions(d, dv(F, 'insumo_id', ''))}</select></label>
        <label>Cantidad *${sel ? ` <small>(${esc(sel.unidad)})</small>` : ''}<input type="number" inputmode="numeric" name="cantidad" min="1" step="1" required value="${esc(dv(F, 'cantidad', ''))}" placeholder="0"></label>
        <label>Fecha de ingreso *<input type="date" name="fecha" required max="${d.hoy}" value="${esc(dv(F, 'fecha', d.hoy))}"></label>
        <label>Fecha de vencimiento<input type="date" name="vence" value="${esc(dv(F, 'vence', ''))}"><small>Vacío si no vence</small></label>
        <label>N° de lote<input name="codigo_lote" value="${esc(dv(F, 'codigo_lote', ''))}" placeholder="Ej: L2611-045"></label>
        <label>Proveedor<input name="proveedor" list="dl-prov" value="${esc(dv(F, 'proveedor', ''))}"></label>
        <label>Factura / guía<input name="documento" value="${esc(dv(F, 'documento', ''))}" placeholder="FAC-0000"></label>
        <label class="f3">Observación<input name="nota" value="${esc(dv(F, 'nota', ''))}"></label>
        <div class="form-actions"><button type="button" class="btn ghost" data-action="draft-clear:${F}">Limpiar</button><button class="btn primary" type="submit">${icon('check')}<span>Registrar ingreso</span></button></div>
      </div>
      <datalist id="dl-prov">${provs.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
    </form>`;

    const table = list.length ? rtable(
      [{ h: 'Insumo', cls: 'main' }, { h: 'Fecha' }, { h: 'Cantidad', cls: 'num' }, { h: 'Vence' }, { h: 'Lote' }, { h: 'Proveedor' }, { h: 'Documento' }, { h: 'Queda', cls: 'num' }, { h: 'Estado' }, { h: '', cls: 'act' }],
      list.map((l) => [
        `<b>${esc(l.insumo ? l.insumo.nombre : '?')}</b><small>${esc(l.insumo ? l.insumo.codigo : '')}</small>`,
        fdate(l.fecha_ingreso), `<span class="c-green">+${num(l.cantidad)}</span> <small>${esc(l.insumo ? l.insumo.unidad : '')}</small>`,
        l.vence ? fdate(l.vence) : '<span class="muted">—</span>', `<span class="mono">${esc(l.codigo_lote || '—')}</span>`, esc(l.proveedor || ''), `<span class="mono">${esc(l.documento || '')}</span>`,
        num(l.disponible), l.disponible ? badge(l.estado) : '<span class="muted">Consumido</span>',
        l.usado === 0 ? iconButton('trash', 'ing-del:' + l.id, 'Eliminar ingreso') : '',
      ])) : emptyState('No hay ingresos en este período.');

    return pageHead('Ingreso de insumos', 'Cada ingreso crea un <b>lote</b> con su propia fecha de vencimiento.', button('Exportar CSV', 'ing-csv', { icon: 'download', cls: 'ghost' })) + form +
      `<div class="toolbar"><h3>Historial de ingresos</h3>${searchBox('ingresos.q', s.q, 'Insumo, lote, proveedor…')}
        <label class="inline">Desde<input type="date" data-bind="ingresos.desde" value="${esc(s.desde)}"></label>
        <label class="inline">Hasta<input type="date" data-bind="ingresos.hasta" value="${esc(s.hasta)}"></label></div>` + table;
  },
  forms: {
    [F]: async (f) => {
      const ok = await run((db) => db.rpc('registrar_ingreso', {
        p_insumo: idOrNull(f.insumo_id), p_fecha: f.fecha, p_cantidad: int(f.cantidad), p_vence: f.vence || null,
        p_codigo_lote: f.codigo_lote, p_proveedor: f.proveedor, p_documento: f.documento, p_nota: f.nota,
      }), 'Ingreso registrado');
      if (ok) clearDraft(F, ['fecha', 'proveedor', 'documento']);
      return ok;
    },
  },
  actions: {
    'ing-del': (id) => confirmDialog('Eliminar ingreso', 'Se eliminará este lote del inventario. Solo es posible si no se ha usado.', 'Eliminar',
      () => run((db) => db.remove('lotes', Number(id)), 'Ingreso eliminado'), true),
    'ing-csv': () => {
      const d = derive();
      csv(`ingresos-${d.hoy}.csv`, [['Fecha', 'Código', 'Insumo', 'Cantidad', 'Unidad', 'Vencimiento', 'Lote', 'Proveedor', 'Documento', 'Disponible', 'Observación']]
        .concat(d.lotes.slice().sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso)).map((l) => [fdate(l.fecha_ingreso), l.insumo.codigo, l.insumo.nombre, l.cantidad, l.insumo.unidad, l.vence ? fdate(l.vence) : '', l.codigo_lote, l.proveedor, l.documento, l.disponible, l.nota])));
    },
  },
};

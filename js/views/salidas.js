import { esc, num, fdate, fshort, tag, pageHead, button, iconButton, emptyState, searchBox, seg, match, rtable, confirmDialog, csv, icon } from '../ui.js';
import { vs, dv, run, clearDraft, insumoOptions, int, idOrNull, rerender } from '../core.js';
import { derive, previewFefo, addDays, MOTIVOS_SALIDA } from '../store.js';

const S = () => vs('salidas', () => ({ q: '', desde: '', hasta: '', motivo: '', rango: '' }));
const F = 'salida';

export function salidaPreview(d) {
  const ins = d.ins[Number(dv(F, 'insumo_id', ''))];
  if (!ins) return `<div class="preview">${icon('box')}<p class="muted">Elige un insumo para ver cuánto hay disponible y de qué lotes saldrá.</p></div>`;
  const motivo = dv(F, 'motivo', 'Despacho');
  const cant = int(dv(F, 'cantidad', 0)) || 0;
  const p = previewFefo(ins.id, cant, dv(F, 'fecha', d.hoy), motivo);
  const r = d.stock[ins.id];
  return `<div class="preview ${cant ? (p.faltante ? 'bad' : 'good') : ''}">
    <div class="pv"><span>Disponible ${motivo === 'Despacho' ? '(sin vencidos)' : ''}</span><b>${num(p.disponible)} ${esc(ins.unidad)}</b></div>
    ${cant && !p.faltante ? `<div class="pv"><span>Quedará</span><b>${num(p.disponible - cant)} ${esc(ins.unidad)}</b></div>` : ''}
    ${p.faltante && cant ? `<p class="c-red small">${icon('warn')} Faltan ${num(p.faltante)} ${esc(ins.unidad)}.</p>` : ''}
    ${cant && p.asign.length ? `<p class="small muted">Saldrá primero lo que vence antes:</p><div class="chips">${p.asign.map((a) => `<span class="chip sm">${esc(a.lote.codigo_lote || '#' + a.lote.id)} · ${a.lote.vence ? 'vence ' + fshort(a.lote.vence) : 'no vence'} <b>×${num(a.cantidad)}</b></span>`).join('')}</div>` : ''}
    ${motivo === 'Despacho' && r.vencido ? `<p class="c-amber small">${icon('warn')} ${num(r.vencido)} ${esc(ins.unidad)} vencidas no se despachan: dalas de baja en Vencimientos.</p>` : ''}
  </div>`;
}

export default {
  id: 'salidas', title: 'Salidas', icon: 'out',
  preview: { [F]: (d) => ({ id: 'salida-preview', html: salidaPreview(d) }) },
  render({ d }) {
    const s = S();
    const ops = d.operaciones.filter((o) => (o.tipo === 'salida' || o.tipo === 'baja') && (!s.desde || o.fecha >= s.desde) && (!s.hasta || o.fecha <= s.hasta) &&
      (!s.motivo || o.motivo === s.motivo) && match(s.q, o.insumo && o.insumo.nombre, o.insumo && o.insumo.codigo, o.destino, o.persona, o.motivo));
    const byDay = {};
    ops.forEach((o) => { (byDay[o.fecha] = byDay[o.fecha] || []).push(o); });
    const tot = {};
    ops.forEach((o) => { if (o.insumo) tot[o.insumo.id] = (tot[o.insumo.id] || 0) - o.total; });
    const totList = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    const maxT = totList.length ? totList[0][1] : 1;
    const destinos = [...new Set(d.operaciones.map((o) => o.destino).filter(Boolean))];
    const personas = [...new Set(d.operaciones.map((o) => o.persona).filter(Boolean))];

    const form = `<form class="card form" data-form="${F}" data-draft="${F}" autocomplete="off">
      <div class="card-h"><h2>${icon('out')} Nuevo retiro de bodega</h2></div>
      <div class="split">
        <div class="fields">
          <label class="f2">Insumo *<select name="insumo_id" required>${insumoOptions(d, dv(F, 'insumo_id', ''), { stock: true })}</select></label>
          <label>Cantidad *<input type="number" inputmode="numeric" name="cantidad" min="1" step="1" required value="${esc(dv(F, 'cantidad', ''))}" placeholder="0"></label>
          <label>Fecha *<input type="date" name="fecha" required max="${d.hoy}" value="${esc(dv(F, 'fecha', d.hoy))}"></label>
          <label>Motivo<select name="motivo">${MOTIVOS_SALIDA.map((m) => `<option ${m === dv(F, 'motivo', 'Despacho') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Destino / servicio<input name="destino" list="dl-dest" value="${esc(dv(F, 'destino', ''))}" placeholder="¿A dónde va?"></label>
          <label class="f2">Retira / responsable<input name="persona" list="dl-pers" value="${esc(dv(F, 'persona', ''))}"></label>
          <label>Observación<input name="nota" value="${esc(dv(F, 'nota', ''))}"></label>
          <div class="form-actions"><button type="button" class="btn ghost" data-action="draft-clear:${F}">Limpiar</button><button class="btn primary" type="submit">${icon('check')}<span>Registrar salida</span></button></div>
        </div>
        <div id="salida-preview">${salidaPreview(d)}</div>
      </div>
      <datalist id="dl-dest">${destinos.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <datalist id="dl-pers">${personas.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    </form>`;

    const rows = [];
    Object.keys(byDay).sort().reverse().forEach((day) => {
      rows.push({ group: `<div class="grp-row"><b>${fdate(day)}</b><span class="muted">${byDay[day].length} retiro${byDay[day].length > 1 ? 's' : ''}</span></div>` });
      byDay[day].forEach((o) => rows.push([
        `<b>${esc(o.insumo ? o.insumo.nombre : '?')}</b><small>${esc(o.insumo ? o.insumo.codigo : '')}</small>`,
        `<span class="c-violet">−${num(-o.total)}</span> <small>${esc(o.insumo ? o.insumo.unidad : '')}</small>`,
        o.motivo === 'Despacho' ? 'Despacho' : tag(o.motivo, o.tipo === 'baja' ? 'red' : 'amber'),
        esc(o.destino || ''), esc(o.persona || ''),
        `<div class="chips">${o.movs.map((m) => `<span class="chip sm">${esc(m.lote ? m.lote.codigo_lote || '#' + m.lote.id : '?')} ×${num(-m.cantidad)}</span>`).join('')}</div>`,
        iconButton('undo', 'sal-del:' + o.id, 'Anular (devuelve el stock)'),
      ]));
    });

    const hist = rows.length ? rtable([{ h: 'Insumo', cls: 'main' }, { h: 'Cantidad', cls: 'num' }, { h: 'Motivo' }, { h: 'Destino' }, { h: 'Responsable' }, { h: 'Lotes' }, { h: '', cls: 'act' }], rows) : emptyState('No hay salidas en este período.');
    const totals = `<section class="card sticky"><div class="card-h"><h2>Total retirado por insumo</h2><span class="muted">${ops.length} registros</span></div>
      ${totList.length ? `<ul class="hbars">${totList.map(([id, q]) => { const i = d.ins[id]; return `<li><span>${esc(i ? i.nombre : '?')}</span><b>${num(q)} <small>${esc(i ? i.unidad : '')}</small></b><i><em style="width:${(q / maxT) * 100}%"></em></i></li>`; }).join('')}</ul>` : emptyState('Sin retiros.')}</section>`;

    return pageHead('Salida de insumos', 'Retiros desde la bodega. Se descuenta en el momento, primero de los lotes que vencen antes.', button('Exportar CSV', 'sal-csv', { icon: 'download', cls: 'ghost' })) + form +
      `<div class="toolbar"><h3>Retiros por fecha</h3>
        ${seg([['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes'], ['', 'Todo']], s.rango, 'sal-range')}
        ${searchBox('salidas.q', s.q, 'Insumo, destino, persona…')}
        <select data-bind="salidas.motivo" aria-label="Motivo"><option value="">Todos los motivos</option>${MOTIVOS_SALIDA.map((m) => `<option ${m === s.motivo ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <label class="inline">Desde<input type="date" data-bind="salidas.desde" value="${esc(s.desde)}"></label>
        <label class="inline">Hasta<input type="date" data-bind="salidas.hasta" value="${esc(s.hasta)}"></label>
      </div><div class="grid side">${hist}${totals}</div>`;
  },
  forms: {
    [F]: async (f) => {
      const ok = await run((db) => db.rpc('registrar_salida', {
        p_insumo: idOrNull(f.insumo_id), p_cantidad: int(f.cantidad), p_fecha: f.fecha, p_motivo: f.motivo,
        p_destino: f.destino, p_persona: f.persona, p_nota: f.nota,
      }), 'Salida registrada');
      if (ok) clearDraft(F, ['fecha', 'destino', 'persona', 'motivo']);
      return ok;
    },
  },
  actions: {
    'sal-range': (r) => {
      const s = S(); const d = derive(); s.rango = r;
      if (!r) { s.desde = ''; s.hasta = ''; } else if (r === 'mes') { s.desde = d.hoy.slice(0, 8) + '01'; s.hasta = d.hoy; } else { s.desde = addDays(d.hoy, -(Number(r) - 1)); s.hasta = d.hoy; }
      rerender();
    },
    'sal-del': (id) => confirmDialog('Anular salida', 'La cantidad vuelve a quedar disponible en los mismos lotes.', 'Anular salida',
      () => run((db) => db.rpc('anular_operacion', { p_op: Number(id) }), 'Salida anulada'), true),
    'sal-csv': () => {
      const d = derive();
      csv(`salidas-${d.hoy}.csv`, [['Fecha', 'Código', 'Insumo', 'Cantidad', 'Unidad', 'Motivo', 'Destino', 'Responsable', 'Lotes', 'Observación']]
        .concat(d.operaciones.filter((o) => o.tipo === 'salida' || o.tipo === 'baja').map((o) => [fdate(o.fecha), o.insumo && o.insumo.codigo, o.insumo && o.insumo.nombre, -o.total, o.insumo && o.insumo.unidad, o.motivo, o.destino, o.persona,
          o.movs.map((m) => (m.lote ? m.lote.codigo_lote || '#' + m.lote.id : '') + ' x' + -m.cantidad).join(', '), o.nota])));
    },
  },
};

import { esc, num, fdate, tag, pageHead, button, iconButton, emptyState, searchBox, seg, match, rtable, confirmDialog, openModal, closeModal, icon, toast } from '../ui.js';
import { vs, dv, run, clearDraft, insumoOptions, int, rerender } from '../core.js';
import { derive, previewFefo } from '../store.js';

const S = () => vs('kits', () => ({ tab: 'prestamo', q: '' }));
const E = () => vs('entregaItems', () => ({ kit_id: '', items: [] }));
const F = 'entrega';

function loadKit(kitId) {
  const d = derive();
  const k = d.kits.find((x) => String(x.id) === String(kitId));
  const e = E();
  e.kit_id = kitId ? String(kitId) : '';
  e.items = k ? k.items.map((it) => ({ insumo_id: String(it.insumo_id), cantidad: String(it.cantidad) })) : [];
}

function entregarForm(d) {
  const e = E();
  const fecha = dv(F, 'fecha', d.hoy);
  let problemas = 0;
  const rows = e.items.map((it, idx) => {
    const ins = d.ins[Number(it.insumo_id)];
    const cant = int(it.cantidad) || 0;
    const p = ins ? previewFefo(ins.id, cant, fecha, 'kit') : null;
    const falta = p && cant > 0 && p.faltante > 0;
    if (falta || !ins || cant <= 0) problemas++;
    return `<div class="kit-row ${falta ? 'bad' : ''}">
      <select name="ins_${idx}" data-hook="ent-item" data-idx="${idx}" data-field="insumo_id" aria-label="Insumo">${insumoOptions(d, it.insumo_id)}</select>
      <input type="number" inputmode="numeric" min="1" step="1" name="cant_${idx}" data-hook="ent-item" data-idx="${idx}" data-field="cantidad" value="${esc(it.cantidad)}" aria-label="Cantidad">
      <span class="kit-av">${ins ? (falta ? `<span class="c-red">${icon('warn')} hay ${num(p.disponible)}</span>` : `<span class="muted">de ${num(p.disponible)} ${esc(ins.unidad)}</span>`) + (ins.reutilizable ? ' ' + tag('Reutilizable', 'blue') : '') : '<span class="muted">—</span>'}</span>
      ${iconButton('close', 'ent-rm:' + idx, 'Quitar insumo')}
    </div>`;
  }).join('');

  return `<form class="card form" data-form="${F}" data-draft="${F}" autocomplete="off">
    <div class="card-h"><h2>${icon('kit')} Armar y entregar kit</h2></div>
    <div class="fields">
      <label class="f2">Plantilla<select data-hook="ent-kit" aria-label="Plantilla de kit"><option value="">Kit personalizado (sin plantilla)</option>${d.kits.filter((k) => k.activo).map((k) => `<option value="${k.id}" ${String(k.id) === e.kit_id ? 'selected' : ''}>${esc(k.nombre)} · ${esc(k.codigo)}</option>`).join('')}</select></label>
      <label class="f2">Se entrega a *<input name="persona" required value="${esc(dv(F, 'persona', ''))}" placeholder="Nombre de quien recibe"></label>
      <label>Destino / uso<input name="destino" value="${esc(dv(F, 'destino', ''))}"></label>
      <label>Entregado por<input name="responsable" value="${esc(dv(F, 'responsable', ''))}"></label>
      <label>Fecha *<input type="date" name="fecha" required max="${d.hoy}" value="${esc(fecha)}"></label>
      <label>Observación<input name="nota" value="${esc(dv(F, 'nota', ''))}"></label>
    </div>
    <div class="kit-items">
      <div class="kit-items-h"><b>Contenido del kit</b><span class="muted small">Puedes ajustar cantidades según lo que haya en bodega</span></div>
      ${rows || '<p class="muted small pad">Elige una plantilla o agrega insumos.</p>'}
      <button type="button" class="btn ghost sm" data-action="ent-add">${icon('plus')}<span>Agregar insumo</span></button>
    </div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="ent-reset">Limpiar</button>
      <button class="btn primary" type="submit" ${e.items.length && !problemas ? '' : 'disabled'}>${icon('check')}<span>Entregar kit</span></button></div>
  </form>`;
}

function pendientes(d, s) {
  const list = d.entregas.filter((e) => e.estado === 'entregado' && match(s.q, e.persona, e.kit_nombre, e.destino));
  if (!list.length) return emptyState('No hay kits en préstamo.', button('Entregar un kit', 'kits-tab:entregar', { cls: 'primary', icon: 'kit' }));
  return `<div class="cards">${list.map((e) => `<article class="card loan">
    <div class="loan-h"><div><small class="muted">${esc(e.kit_nombre)} · N° ${e.id}</small><h3>${esc(e.persona)}</h3><small>${e.destino ? esc(e.destino) + ' · ' : ''}desde ${fdate(e.fecha_entrega)}</small></div>
      <span class="days ${e.diasFuera > 14 ? 'warn' : ''}">${e.diasFuera}<small>días</small></span></div>
    <ul class="loan-items">${e.items.map((it) => `<li><span>${esc(it.insumo ? it.insumo.nombre : '?')}</span><b>×${num(it.cantidad)}</b>${it.insumo && it.insumo.reutilizable ? icon('return', 'c-blue') : ''}</li>`).join('')}</ul>
    <div class="loan-a">${button('Registrar devolución', 'dev-open:' + e.id, { cls: 'primary', icon: 'return' })}${button('Anular', 'ent-anular:' + e.id, { cls: 'ghost danger-t' })}</div>
  </article>`).join('')}</div>`;
}

function devueltos(d, s) {
  const list = d.entregas.filter((e) => e.estado === 'devuelto' && match(s.q, e.persona, e.kit_nombre, e.destino));
  if (!list.length) return emptyState('Aún no hay devoluciones.');
  return rtable([{ h: 'Persona', cls: 'main' }, { h: 'Kit' }, { h: 'Entregado' }, { h: 'Devuelto' }, { h: 'Días', cls: 'num' }, { h: 'Volvió al stock', cls: 'num' }, { h: 'Desechado', cls: 'num' }, { h: '', cls: 'act' }],
    list.map((e) => [
      `<b>${esc(e.persona)}</b><small>${esc(e.destino || '')}</small>`, esc(e.kit_nombre), fdate(e.fecha_entrega), fdate(e.fecha_devolucion), e.diasFuera,
      `<span class="c-green">${num(e.items.reduce((a, i) => a + (i.devuelto || 0), 0))}</span>`, `<span class="c-red">${num(e.items.reduce((a, i) => a + (i.descartado || 0), 0))}</span>`,
      iconButton('list', 'ent-ver:' + e.id, 'Ver detalle') + iconButton('undo', 'dev-revert:' + e.id, 'Revertir devolución'),
    ]));
}

function devolucionBody(e, d) {
  return `<form data-form="devolucion" data-id="${e.id}" autocomplete="off">
    <p class="muted small">Indica cuántas unidades de cada insumo <b>vuelven al stock</b>. El resto se registra como <b>usado o desechado</b> y no vuelve. Los insumos marcados como reutilizables vienen preseleccionados.</p>
    <div class="ret-list">${e.items.map((it) => {
      const reu = it.insumo && it.insumo.reutilizable;
      const dev = reu ? it.cantidad : 0;
      return `<div class="ret-row">
        <div class="ret-name"><b>${esc(it.insumo ? it.insumo.nombre : '?')}</b><small>Entregado: ${num(it.cantidad)} ${esc(it.insumo ? it.insumo.unidad : '')} ${reu ? tag('Reutilizable', 'blue') : tag('Desechable', 'gray')}</small></div>
        <div class="ret-ctl">
          <div class="seg sm"><button type="button" data-action="dev-set:${it.id}:all" class="${dev === it.cantidad ? 'on' : ''}" data-r="${it.id}" data-m="all">Vuelve</button><button type="button" data-action="dev-set:${it.id}:none" class="${dev === 0 ? 'on' : ''}" data-r="${it.id}" data-m="none">Se desecha</button></div>
          <label class="ret-num">Vuelven<input type="number" inputmode="numeric" name="dev_${it.id}" min="0" max="${it.cantidad}" step="1" value="${dev}" data-hook="dev-calc" data-max="${it.cantidad}" data-id="${it.id}"></label>
          <span class="ret-desc" id="desc-${it.id}">Se desechan: <b>${it.cantidad - dev}</b></span>
        </div></div>`;
    }).join('')}</div>
    <div class="fields f-modal">
      <label>Fecha de devolución *<input type="date" name="fecha" required min="${e.fecha_entrega}" max="${d.hoy}" value="${d.hoy}"></label>
      <label>Recibido por<input name="recibido_por"></label>
      <label class="f2">Observación<input name="nota" placeholder="Ej: tijera con daño, se desecha"></label>
    </div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary" type="submit">${icon('check')}<span>Registrar devolución</span></button></div>
  </form>`;
}

function updateRet(id) {
  const inp = document.querySelector(`[name="dev_${id}"]`);
  if (!inp) return;
  const max = Number(inp.dataset.max);
  let v = Math.max(0, Math.min(max, int(inp.value) || 0));
  if (String(v) !== inp.value && inp.value !== '') inp.value = v;
  if (inp.value === '') v = 0;
  const span = document.getElementById('desc-' + id);
  if (span) span.innerHTML = `Se desechan: <b>${max - v}</b>`;
  document.querySelectorAll(`[data-r="${id}"]`).forEach((b) => b.classList.toggle('on', (b.dataset.m === 'all' && v === max) || (b.dataset.m === 'none' && v === 0)));
}

export default {
  id: 'kits', title: 'Kits', icon: 'kit',
  enter(q) { const s = S(); if (q.tab) s.tab = q.tab; if (q.kit) { s.tab = 'entregar'; loadKit(q.kit); } },
  render({ d }) {
    const s = S();
    const nPend = d.entregas.filter((e) => e.estado === 'entregado').length;
    const nDev = d.entregas.length - nPend;
    const body = s.tab === 'entregar' ? entregarForm(d) : s.tab === 'devueltos' ? devueltos(d, s) : pendientes(d, s);
    return pageHead('Kits', 'Arma kits a pedido con lo que hay en bodega, entrégalos a una persona y registra su devolución.',
      button('Plantillas de kits', 'go:admin/kits', { icon: 'layers', cls: 'ghost' })) +
      `<div class="toolbar">${seg([['prestamo', 'En préstamo', nPend], ['devueltos', 'Devueltos', nDev], ['entregar', '+ Entregar kit']], s.tab, 'kits-tab')}
      ${s.tab !== 'entregar' ? searchBox('kits.q', s.q, 'Persona, kit o destino') : ''}</div>` + body;
  },
  hooks: {
    'ent-kit': (el) => { loadKit(el.value); rerender(); },
    'ent-item': (el) => { const e = E(); const it = e.items[Number(el.dataset.idx)]; if (it) { it[el.dataset.field] = el.value; rerender(); } },
    'dev-calc': (el) => updateRet(el.dataset.id),
  },
  forms: {
    [F]: async (f) => {
      const e = E();
      const items = e.items.map((it) => ({ insumo_id: Number(it.insumo_id), cantidad: int(it.cantidad) })).filter((it) => it.insumo_id && it.cantidad > 0);
      if (!items.length) { toast('Agrega al menos un insumo', 'err'); return false; }
      const ok = await run((db) => db.rpc('entregar_kit', {
        p_kit: e.kit_id ? Number(e.kit_id) : null, p_fecha: f.fecha, p_persona: f.persona, p_items: items,
        p_destino: f.destino, p_responsable: f.responsable, p_nota: f.nota,
      }), `Kit entregado a ${f.persona}`);
      if (ok) { clearDraft(F, ['fecha', 'responsable']); loadKit(''); S().tab = 'prestamo'; rerender(); }
      return ok;
    },
    devolucion: async (f, form) => {
      const d = derive();
      const e = d.entregas.find((x) => x.id === Number(form.dataset.id));
      if (!e) return false;
      const items = e.items.map((it) => { const dev = Math.max(0, Math.min(it.cantidad, int(f['dev_' + it.id]) || 0)); return { id: it.id, devuelto: dev, descartado: it.cantidad - dev }; });
      const ok = await run((db) => db.rpc('devolver_kit', { p_entrega: e.id, p_fecha: f.fecha, p_items: items, p_recibido_por: f.recibido_por, p_nota: f.nota }), 'Devolución registrada');
      if (ok) closeModal();
      return ok;
    },
  },
  actions: {
    'kits-tab': (t) => { S().tab = t; rerender(); },
    'ent-add': () => { E().items.push({ insumo_id: '', cantidad: '1' }); rerender(); },
    'ent-rm': (i) => { E().items.splice(Number(i), 1); rerender(); },
    'ent-reset': () => { clearDraft(F, ['fecha']); loadKit(''); rerender(); },
    'ent-anular': (id) => confirmDialog('Anular entrega', 'Se eliminará la entrega y todos sus insumos vuelven al stock como si nunca hubieran salido. Úsalo solo para corregir errores.', 'Anular entrega',
      () => run((db) => db.rpc('anular_entrega', { p_entrega: Number(id) }), 'Entrega anulada'), true),
    'dev-open': (id) => { const d = derive(); const e = d.entregas.find((x) => x.id === Number(id)); if (e) openModal(`Devolución · ${e.kit_nombre} · ${e.persona}`, devolucionBody(e, d), { wide: true }); },
    'dev-set': (arg) => {
      const [id, mode] = arg.split(':');
      const inp = document.querySelector(`[name="dev_${id}"]`);
      if (inp) { inp.value = mode === 'all' ? inp.dataset.max : 0; updateRet(id); }
    },
    'dev-revert': (id) => confirmDialog('Revertir devolución', 'El kit vuelve a quedar "en préstamo" y se quita del stock lo que se había devuelto.', 'Revertir',
      () => run((db) => db.rpc('revertir_devolucion', { p_entrega: Number(id) }), 'Devolución revertida'), true),
    'ent-ver': (id) => {
      const e = derive().entregas.find((x) => x.id === Number(id));
      if (!e) return;
      openModal(`${e.kit_nombre} · ${e.persona}`, `<p class="muted small">Entregado ${fdate(e.fecha_entrega)}${e.responsable ? ' por ' + esc(e.responsable) : ''} · devuelto ${fdate(e.fecha_devolucion)}${e.recibido_por ? ', recibió ' + esc(e.recibido_por) : ''}</p>` +
        rtable([{ h: 'Insumo', cls: 'main' }, { h: 'Entregado', cls: 'num' }, { h: 'Volvió', cls: 'num' }, { h: 'Desechado', cls: 'num' }],
          e.items.map((it) => [esc(it.insumo ? it.insumo.nombre : '?'), num(it.cantidad), `<span class="c-green">${num(it.devuelto)}</span>`, `<span class="c-red">${num(it.descartado)}</span>`])) +
        (e.nota_devolucion ? `<p class="small">${esc(e.nota_devolucion)}</p>` : ''), { wide: true });
    },
  },
};

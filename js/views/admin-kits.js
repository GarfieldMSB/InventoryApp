import { esc, num, tag, pageHead, button, iconButton, emptyState, searchBox, match, confirmDialog, openModal, closeModal, icon, toast } from '../ui.js';
import { vs, run, insumoOptions, int } from '../core.js';
import { derive } from '../store.js';

const S = () => vs('admin-kits', () => ({ q: '' }));
let K = null; // kit en edición

function editor(d) {
  const rows = K.items.map((it, idx) => {
    const ins = d.ins[Number(it.insumo_id)];
    return `<div class="kit-row">
      <select data-hook="kit-item" data-idx="${idx}" data-field="insumo_id" name="ki_${idx}" aria-label="Insumo">${insumoOptions(d, it.insumo_id)}</select>
      <input type="number" inputmode="numeric" min="1" step="1" data-hook="kit-item" data-idx="${idx}" data-field="cantidad" name="kc_${idx}" value="${esc(it.cantidad)}" aria-label="Cantidad">
      <span class="kit-av">${ins ? `<span class="muted">${esc(ins.unidad)}</span> ${ins.reutilizable ? tag('Reutilizable', 'blue') : tag('Desechable', 'gray')}` : ''}</span>
      ${iconButton('close', 'kit-rm:' + idx, 'Quitar')}
    </div>`;
  }).join('');
  return `<form data-form="kit" autocomplete="off">
    <div class="fields f-modal">
      <label>Código *<input name="codigo" data-hook="kit-f" required value="${esc(K.codigo)}" class="mono" placeholder="KIT-001"></label>
      <label class="f2">Nombre *<input name="nombre" data-hook="kit-f" required value="${esc(K.nombre)}" placeholder="Ej: Kit de curación"></label>
      <label class="f3">Descripción<input name="descripcion" data-hook="kit-f" value="${esc(K.descripcion)}"></label>
      <label class="check f3"><input type="checkbox" name="activo" data-hook="kit-f" ${K.activo ? 'checked' : ''}><span><b>Activo</b><small>Disponible para entregar</small></span></label>
    </div>
    <div class="kit-items"><div class="kit-items-h"><b>Insumos del kit</b><span class="muted small">${K.items.length} insumos</span></div>
      ${rows || '<p class="muted small pad">Agrega los insumos que lleva este kit.</p>'}
      <button type="button" class="btn ghost sm" data-action="kit-add">${icon('plus')}<span>Agregar insumo</span></button></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary" type="submit">${icon('check')}<span>${K.id ? 'Guardar kit' : 'Crear kit'}</span></button></div>
  </form>`;
}

function openEditor(kit) {
  K = kit ? { id: kit.id, codigo: kit.codigo, nombre: kit.nombre, descripcion: kit.descripcion || '', activo: kit.activo, items: kit.items.map((i) => ({ insumo_id: String(i.insumo_id), cantidad: String(i.cantidad) })) }
    : { id: null, codigo: '', nombre: '', descripcion: '', activo: true, items: [{ insumo_id: '', cantidad: '1' }] };
  openModal(kit ? 'Editar kit' : 'Nuevo kit', editor(derive()), { wide: true });
}
function refreshEditor() {
  const body = document.querySelector('#overlay .modal-body');
  if (body) body.innerHTML = editor(derive());
}

export default {
  id: 'admin/kits', title: 'Plantillas de kits', icon: 'layers', admin: true,
  render({ d }) {
    const s = S();
    const list = d.kits.filter((k) => match(s.q, k.codigo, k.nombre, k.descripcion, k.items.map((i) => i.insumo && i.insumo.nombre).join(' ')));
    const enUso = {};
    d.entregas.forEach((e) => { if (e.estado === 'entregado' && e.kit_id) enUso[e.kit_id] = (enUso[e.kit_id] || 0) + 1; });
    return pageHead('Plantillas de kits', 'Define qué insumos lleva cada kit. Al entregarlo se puede ajustar según lo que haya en bodega.', button('Nuevo kit', 'kit-new', { cls: 'primary', icon: 'plus' })) +
      `<div class="toolbar">${searchBox('admin-kits.q', s.q, 'Buscar kit o insumo')}</div>` +
      (list.length ? `<div class="cards">${list.map((k) => {
        const armables = k.items.length ? Math.min(...k.items.map((it) => Math.floor((d.stock[it.insumo_id] ? d.stock[it.insumo_id].utilizable : 0) / it.cantidad))) : 0;
        return `<article class="card kitcard ${k.activo ? '' : 'dim'}">
          <div class="loan-h"><div><small class="mono muted">${esc(k.codigo)}</small><h3>${esc(k.nombre)}</h3>${k.descripcion ? `<small>${esc(k.descripcion)}</small>` : ''}</div>
            <span class="days ${armables ? '' : 'warn'}" title="Kits que se pueden armar con el stock actual">${armables}<small>armables</small></span></div>
          <ul class="loan-items">${k.items.map((it) => `<li><span>${esc(it.insumo ? it.insumo.nombre : '?')}</span><b>×${num(it.cantidad)}</b>${it.insumo && it.insumo.reutilizable ? icon('return', 'c-blue') : ''}</li>`).join('')}</ul>
          <div class="loan-a">${k.activo ? button('Entregar', 'go:kits?kit=' + k.id, { cls: 'primary sm', icon: 'kit' }) : tag('Inactivo', 'gray')}${enUso[k.id] ? tag(enUso[k.id] + ' en préstamo', 'blue') : ''}<span class="grow"></span>
            ${iconButton('edit', 'kit-edit:' + k.id, 'Editar')}${iconButton('trash', 'kit-del:' + k.id, 'Eliminar')}</div>
        </article>`;
      }).join('')}</div>` : emptyState('Aún no hay kits.', button('Crear el primero', 'kit-new', { cls: 'primary', icon: 'plus' })));
  },
  hooks: {
    'kit-f': (el) => { if (!K) return; K[el.name] = el.type === 'checkbox' ? el.checked : el.value; },
    'kit-item': (el) => { if (!K) return; const it = K.items[Number(el.dataset.idx)]; if (it) it[el.dataset.field] = el.value; if (el.tagName === 'SELECT') refreshEditor(); },
  },
  forms: {
    kit: async () => {
      const items = K.items.map((i) => ({ insumo_id: Number(i.insumo_id), cantidad: int(i.cantidad) })).filter((i) => i.insumo_id && i.cantidad > 0);
      if (!items.length) { toast('Agrega al menos un insumo con cantidad', 'err'); return false; }
      const ok = await run((db) => db.rpc('guardar_kit', { p_id: K.id, p_codigo: K.codigo, p_nombre: K.nombre, p_descripcion: K.descripcion, p_items: items, p_activo: K.activo }), K.id ? 'Kit actualizado' : 'Kit creado');
      if (ok) { closeModal(); K = null; }
      return ok;
    },
  },
  actions: {
    'kit-new': () => openEditor(null),
    'kit-edit': (id) => openEditor(derive().kits.find((k) => k.id === Number(id))),
    'kit-add': () => { K.items.push({ insumo_id: '', cantidad: '1' }); refreshEditor(); },
    'kit-rm': (i) => { K.items.splice(Number(i), 1); refreshEditor(); },
    'kit-del': (id) => confirmDialog('Eliminar plantilla', 'Las entregas ya registradas se conservan en el historial.', 'Eliminar', () => run((db) => db.remove('kits', Number(id)), 'Kit eliminado'), true),
  },
};

import { esc, num, tag, pageHead, button, iconButton, emptyState, searchBox, match, rtable, confirmDialog, openModal, closeModal, icon, toast } from '../ui.js';
import { vs, run, int } from '../core.js';
import { derive } from '../store.js';

const S = () => vs('admin-insumos', () => ({ q: '', cat: '', ver: 'activos' }));

function form(d, i) {
  i = i || { activo: true, stock_minimo: 0, reutilizable: false };
  const noCats = !d.categorias.length || !d.unidades.length;
  return `<form data-form="insumo" data-id="${i.id || ''}" autocomplete="off">
    ${noCats ? `<p class="note">${icon('warn')} Primero crea al menos una categoría y una unidad en <a href="#/admin/catalogos">Categorías y unidades</a>.</p>` : ''}
    <div class="fields f-modal">
      <label>Código *<input name="codigo" required value="${esc(i.codigo || '')}" placeholder="GUA-002" class="mono" autocapitalize="characters"></label>
      <label class="f2">Nombre *<input name="nombre" required value="${esc(i.nombre || '')}" placeholder="Ej: Guantes de látex talla S"></label>
      <label>Categoría *<select name="categoria_id" required><option value="">Elegir…</option>${d.categorias.map((c) => `<option value="${c.id}" ${c.id === i.categoria_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label>Unidad *<select name="unidad_id" required><option value="">Elegir…</option>${d.unidades.map((u) => `<option value="${u.id}" ${u.id === i.unidad_id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select></label>
      <label>Stock mínimo<input type="number" inputmode="numeric" name="stock_minimo" min="0" step="1" value="${esc(i.stock_minimo)}"><small>Alerta cuando quede igual o menos</small></label>
      <label class="check f3"><input type="checkbox" name="reutilizable" ${i.reutilizable ? 'checked' : ''}><span><b>Reutilizable</b><small>Al devolver un kit, este insumo vuelve al stock por defecto (ej: tijeras, termómetros). Si no, se considera desechable.</small></span></label>
      <label class="check f3"><input type="checkbox" name="activo" ${i.activo ? 'checked' : ''}><span><b>Activo</b><small>Los inactivos no aparecen para nuevos ingresos, salidas ni kits.</small></span></label>
      <label class="f3">Notas<input name="notas" value="${esc(i.notas || '')}"></label>
    </div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary" type="submit">${icon('check')}<span>${i.id ? 'Guardar cambios' : 'Crear insumo'}</span></button></div>
  </form>`;
}

export default {
  id: 'admin/insumos', title: 'Insumos', icon: 'tag', admin: true,
  enter(q) { if (q.nuevo) setTimeout(() => openModal('Nuevo insumo', form(derive()), { wide: true }), 0); },
  render({ d }) {
    const s = S();
    const list = d.insumos.filter((i) => (s.ver === 'todos' || (s.ver === 'activos' ? i.activo : !i.activo)) && (!s.cat || String(i.categoria_id) === s.cat) && match(s.q, i.codigo, i.nombre, i.categoria));
    const kitsUso = {};
    d.kits.forEach((k) => k.items.forEach((it) => { kitsUso[it.insumo_id] = (kitsUso[it.insumo_id] || 0) + 1; }));
    return pageHead('Insumos', 'Catálogo maestro: cada insumo se define una vez con su categoría, unidad, stock mínimo y si es reutilizable.', button('Nuevo insumo', 'ins-new', { cls: 'primary', icon: 'plus' })) +
      `<div class="toolbar">${searchBox('admin-insumos.q', s.q, 'Buscar insumo')}
        <select data-bind="admin-insumos.cat" aria-label="Categoría"><option value="">Todas las categorías</option>${d.categorias.map((c) => `<option value="${c.id}" ${String(c.id) === s.cat ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
        <select data-bind="admin-insumos.ver" aria-label="Estado">${[['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']].map(([v, l]) => `<option value="${v}" ${s.ver === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="muted small">${list.length} de ${d.insumos.length}</span></div>` +
      (list.length ? rtable([{ h: 'Insumo', cls: 'main' }, { h: 'Categoría' }, { h: 'Unidad' }, { h: 'Mínimo', cls: 'num' }, { h: 'Stock', cls: 'num' }, { h: 'Tipo' }, { h: 'En kits', cls: 'num' }, { h: '', cls: 'act' }],
        list.map((i) => ({
          cls: i.activo ? '' : 'dim',
          cells: [`<b>${esc(i.nombre)}</b><small class="mono">${esc(i.codigo)}</small>`, esc(i.categoria), esc(i.unidad), num(i.stock_minimo), num(d.stock[i.id].utilizable),
            (i.reutilizable ? tag('Reutilizable', 'blue') : tag('Desechable', 'gray')) + (i.activo ? '' : ' ' + tag('Inactivo', 'gray')), kitsUso[i.id] || '—',
            iconButton('edit', 'ins-edit:' + i.id, 'Editar') + iconButton(i.activo ? 'close' : 'check', 'ins-toggle:' + i.id, i.activo ? 'Desactivar' : 'Activar') + iconButton('trash', 'ins-del:' + i.id, 'Eliminar')],
        }))) : emptyState('No hay insumos.', button('Crear el primero', 'ins-new', { cls: 'primary', icon: 'plus' })));
  },
  forms: {
    insumo: async (f, el) => {
      const id = el.dataset.id ? Number(el.dataset.id) : null;
      const row = {
        codigo: String(f.codigo || '').trim().toUpperCase(), nombre: String(f.nombre || '').trim(),
        categoria_id: Number(f.categoria_id) || null, unidad_id: Number(f.unidad_id) || null,
        stock_minimo: Math.max(0, int(f.stock_minimo) || 0), reutilizable: f.reutilizable === 'on', activo: f.activo === 'on', notas: String(f.notas || '').trim() || null,
      };
      if (!row.codigo || !row.nombre || !row.categoria_id || !row.unidad_id) { toast('Código, nombre, categoría y unidad son obligatorios', 'err'); return false; }
      const ok = await run((db) => (id ? db.update('insumos', id, row) : db.insert('insumos', row)), id ? 'Insumo actualizado' : 'Insumo creado');
      if (ok) closeModal();
      return ok;
    },
  },
  actions: {
    'ins-new': () => openModal('Nuevo insumo', form(derive()), { wide: true }),
    'ins-edit': (id) => { const d = derive(); openModal('Editar insumo', form(d, d.ins[Number(id)]), { wide: true }); },
    'ins-toggle': (id) => { const i = derive().ins[Number(id)]; run((db) => db.update('insumos', i.id, { activo: !i.activo }), i.activo ? 'Insumo desactivado' : 'Insumo activado'); },
    'ins-del': (id) => confirmDialog('Eliminar insumo', 'Solo se pueden eliminar insumos sin lotes ni kits asociados. Si ya tiene historial, mejor <b>desactívalo</b>.', 'Eliminar',
      () => run((db) => db.remove('insumos', Number(id)), 'Insumo eliminado'), true),
  },
};

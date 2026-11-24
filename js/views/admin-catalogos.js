import { esc, pageHead, iconButton, emptyState, confirmDialog, openModal, closeModal, icon, toast } from '../ui.js';
import { run } from '../core.js';
import { derive } from '../store.js';

function listCard(title, ic, kind, items, uso, addForm) {
  return `<section class="card"><div class="card-h"><h2>${icon(ic)} ${title}</h2><span class="muted small">${items.length}</span></div>
    ${addForm}
    ${items.length ? `<ul class="list editable">${items.map((x) => `<li><div><b>${esc(x.nombre)}</b><small>${x.abreviatura ? esc(x.abreviatura) + ' · ' : ''}${uso[x.id] || 0} insumos</small></div>
      <span>${iconButton('edit', `cat-edit:${kind}:${x.id}`, 'Editar')}${iconButton('trash', `cat-del:${kind}:${x.id}`, 'Eliminar')}</span></li>`).join('')}</ul>` : emptyState('Sin registros.')}
  </section>`;
}

export default {
  id: 'admin/catalogos', title: 'Categorías y unidades', icon: 'list', admin: true,
  render({ d }) {
    const usoCat = {}; const usoUni = {};
    d.insumos.forEach((i) => { usoCat[i.categoria_id] = (usoCat[i.categoria_id] || 0) + 1; usoUni[i.unidad_id] = (usoUni[i.unidad_id] || 0) + 1; });
    return pageHead('Categorías y unidades', 'Tipos de material para agrupar el inventario y unidades de medida para los insumos.') +
      `<div class="grid g2">
        ${listCard('Categorías (tipo de material)', 'layers', 'categorias', d.categorias, usoCat,
          `<form class="inline-form" data-form="cat-add" data-kind="categorias" autocomplete="off"><input name="nombre" required placeholder="Nueva categoría"><button class="btn primary" type="submit">${icon('plus')}<span>Agregar</span></button></form>`)}
        ${listCard('Unidades de medida', 'box', 'unidades', d.unidades, usoUni,
          `<form class="inline-form" data-form="cat-add" data-kind="unidades" autocomplete="off"><input name="nombre" required placeholder="Ej: caja"><input name="abreviatura" placeholder="Abrev." class="short"><button class="btn primary" type="submit">${icon('plus')}<span>Agregar</span></button></form>`)}
      </div>`;
  },
  forms: {
    'cat-add': async (f, el) => {
      const kind = el.dataset.kind;
      const row = { nombre: String(f.nombre || '').trim() };
      if (kind === 'unidades') row.abreviatura = String(f.abreviatura || '').trim() || null;
      if (!row.nombre) { toast('Escribe un nombre', 'err'); return false; }
      return run((db) => db.insert(kind, row), kind === 'categorias' ? 'Categoría agregada' : 'Unidad agregada');
    },
    'cat-edit': async (f, el) => {
      const kind = el.dataset.kind;
      const row = { nombre: String(f.nombre || '').trim() };
      if (kind === 'unidades') row.abreviatura = String(f.abreviatura || '').trim() || null;
      if (!row.nombre) { toast('Escribe un nombre', 'err'); return false; }
      const ok = await run((db) => db.update(kind, Number(el.dataset.id), row), 'Guardado');
      if (ok) closeModal();
      return ok;
    },
  },
  actions: {
    'cat-edit': (arg) => {
      const [kind, id] = arg.split(':');
      const d = derive();
      const x = (kind === 'categorias' ? d.categorias : d.unidades).find((c) => c.id === Number(id));
      if (!x) return;
      openModal(kind === 'categorias' ? 'Editar categoría' : 'Editar unidad', `<form data-form="cat-edit" data-kind="${kind}" data-id="${x.id}" autocomplete="off"><div class="fields f-modal">
        <label class="f2">Nombre *<input name="nombre" required value="${esc(x.nombre)}"></label>
        ${kind === 'unidades' ? `<label>Abreviatura<input name="abreviatura" value="${esc(x.abreviatura || '')}"></label>` : ''}</div>
        <div class="form-actions"><button type="button" class="btn ghost" data-action="modal-close">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>`);
    },
    'cat-del': (arg) => {
      const [kind, id] = arg.split(':');
      confirmDialog('Eliminar', 'Solo se puede eliminar si ningún insumo la usa.', 'Eliminar', () => run((db) => db.remove(kind, Number(id)), 'Eliminado'), true);
    },
  },
};

import { esc, pageHead, button, confirmDialog, icon, toast, csv, fdate } from '../ui.js';
import { run, ui } from '../core.js';
import { derive, load, getLoadedAt, getRaw } from '../store.js';
import * as db from '../db.js';
import { SUPABASE_URL } from '../config.js';

export default {
  id: 'admin/config', title: 'Configuración', icon: 'gear', admin: true,
  render({ d }) {
    const mode = db.getMode();
    const at = getLoadedAt();
    const r = getRaw();
    return pageHead('Configuración') + `<div class="grid g2">
      <form class="card form" data-form="config" autocomplete="off"><div class="card-h"><h2>${icon('gear')} General</h2></div>
        <div class="fields f-modal">
          <label class="f3">Nombre de la bodega<input name="nombre" value="${esc(d.cfg.nombre)}"></label>
          <label class="f3">Considerar "por vencer" cuando falten (días)<input type="number" inputmode="numeric" name="dias" min="1" max="365" value="${d.cfg.dias}"></label>
        </div>
        <div class="form-actions"><button class="btn primary" type="submit">${icon('check')}<span>Guardar</span></button></div>
      </form>
      <section class="card"><div class="card-h"><h2>${icon('db')} Base de datos</h2>${mode === 'supabase' ? '<span class="badge green">Supabase</span>' : '<span class="badge amber">Modo demo</span>'}</div>
        ${mode === 'supabase'
          ? `<p class="small">Conectado a <span class="mono">${esc(SUPABASE_URL.replace(/^https?:\/\//, ''))}</span>. Todos los dispositivos ven los mismos datos.</p>`
          : `<p class="small">Los datos se guardan <b>solo en este navegador</b> (PostgreSQL local). Para compartirlos entre PC y celular, conecta Supabase editando <span class="mono">js/config.js</span> (ver README).</p>`}
        <p class="small muted">${r.insumos.length} insumos · ${r.lotes.length} lotes · ${r.operaciones.length} operaciones · ${r.entregas.length} entregas de kits${at ? ` · actualizado ${at.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        <div class="btn-col">
          ${button('Recargar datos', 'cfg-reload', { icon: 'refresh' })}
          ${button('Exportar movimientos (CSV)', 'cfg-csv', { icon: 'download' })}
          ${mode === 'demo' ? button('Reiniciar demo con datos de ejemplo', 'cfg-demo:1', { icon: 'refresh', cls: 'ghost' }) + button('Reiniciar demo vacía', 'cfg-demo:0', { icon: 'trash', cls: 'ghost danger-t' }) : ''}
        </div>
      </section>
      <section class="card"><div class="card-h"><h2>${icon('sun')} Apariencia</h2></div>
        <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button type="button" class="${ui.theme === v ? 'on' : ''}" data-action="theme:${v}">${l}</button>`).join('')}</div>
      </section>
    </div>`;
  },
  forms: {
    config: async (f) => {
      const dias = Math.round(Number(f.dias));
      if (!(dias >= 1 && dias <= 365)) { toast('El umbral debe estar entre 1 y 365 días', 'err'); return false; }
      return run(async (x) => { await x.rpc('guardar_config', { p_clave: 'nombre_bodega', p_valor: String(f.nombre || '').trim() || 'Bodega' }); await x.rpc('guardar_config', { p_clave: 'dias_por_vencer', p_valor: String(dias) }); }, 'Configuración guardada');
    },
  },
  actions: {
    'cfg-reload': async () => { try { await load(); toast('Datos actualizados'); } catch (e) { toast(e.message, 'err'); } },
    'cfg-demo': (w) => confirmDialog('Reiniciar demo', 'Se borrarán todos los datos de este navegador.', 'Reiniciar',
      () => run(() => db.resetDemo(w === '1'), 'Demo reiniciada'), true),
    'cfg-csv': () => {
      const d = derive();
      const T = { salida: 'Salida', baja: 'Baja', ajuste: 'Ajuste', entrega_kit: 'Entrega de kit', devolucion_kit: 'Devolución de kit' };
      const rows = [['Fecha', 'Tipo', 'Código', 'Insumo', 'Lote', 'Cantidad', 'Motivo', 'Destino', 'Persona', 'Observación']];
      d.operaciones.forEach((o) => o.movs.forEach((m) => { const i = m.lote && m.lote.insumo; rows.push([fdate(o.fecha), T[o.tipo], i && i.codigo, i && i.nombre, m.lote && (m.lote.codigo_lote || '#' + m.lote.id), m.cantidad, o.motivo, o.destino, o.persona, o.nota]); }));
      csv(`movimientos-${d.hoy}.csv`, rows);
    },
  },
};

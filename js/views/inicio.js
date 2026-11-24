import { esc, num, fshort, icon, badge, diasTxt, pageHead, emptyState, stackBar } from '../ui.js';
import { addDays } from '../store.js';

function kpi(label, value, sub, tone, route) {
  return `<a class="kpi t-${tone}" href="#/${route}"><span class="kpi-l">${label}</span><span class="kpi-v">${value}</span><span class="kpi-s">${sub}</span></a>`;
}

export default {
  id: 'inicio', title: 'Inicio', icon: 'home',
  render({ d }) {
    const a = d.alertas;
    const activos = d.insumos.filter((i) => i.activo).length;

    // retiros por día (salidas + entregas de kits), últimos 14 días
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(addDays(d.hoy, -i));
    const count = {};
    d.operaciones.forEach((o) => { if (o.tipo === 'salida' || o.tipo === 'entrega_kit') count[o.fecha] = (count[o.fecha] || 0) + 1; });
    const vals = days.map((f) => count[f] || 0);
    const max = Math.max(1, ...vals);
    const chart = `<div class="bars" role="img" aria-label="Retiros por día en los últimos 14 días">${days.map((f, i) => `<div class="bar-c" title="${fshort(f)}: ${vals[i]} retiros"><span class="bar-n">${vals[i] || ''}</span><span class="bar" style="height:${Math.max(2, (vals[i] / max) * 100)}%"></span><span class="bar-x">${f.slice(8)}</span></div>`).join('')}</div>`;

    const movs = d.operaciones.slice(0, 7).map((o) => {
      const t = { salida: ['Salida', 'out', 'violet'], baja: ['Baja', 'trash', 'red'], ajuste: ['Ajuste', 'sliders', 'amber'], entrega_kit: ['Kit entregado', 'kit', 'blue'], devolucion_kit: ['Kit devuelto', 'return', 'green'] }[o.tipo];
      const what = o.tipo === 'entrega_kit' || o.tipo === 'devolucion_kit' ? (o.persona || '') : (o.insumo ? o.insumo.nombre : '');
      return `<li><span class="li-ic c-${t[2]}">${icon(t[1])}</span><div><b>${esc(what)}</b><small>${t[0]} · ${fshort(o.fecha)}${o.destino ? ' · ' + esc(o.destino) : ''}</small></div><span class="mono ${o.total < 0 ? 'c-violet' : 'c-green'}">${o.total > 0 ? '+' : ''}${num(o.total)}</span></li>`;
    }).join('');

    return pageHead(d.cfg.nombre, `Resumen al ${fshort(d.hoy)} · "por vencer" = ${d.cfg.dias} días o menos`) +
      `<div class="quick">
        <a class="qa" href="#/ingresos">${icon('in')}<span>Registrar ingreso</span></a>
        <a class="qa" href="#/salidas">${icon('out')}<span>Registrar salida</span></a>
        <a class="qa" href="#/kits?tab=entregar">${icon('kit')}<span>Entregar kit</span></a>
        <a class="qa" href="#/kits?tab=prestamo">${icon('return')}<span>Recibir devolución</span></a>
      </div>
      <div class="kpis">
        ${kpi('Insumos activos', num(activos), `${d.categorias.length} categorías`, 'blue', 'inventario')}
        ${kpi('Stock bajo o agotado', num(a.bajos.length + a.agotados.length), 'bajo el mínimo', 'violet', 'inventario?estado=alerta')}
        ${kpi('Lotes por vencer', num(a.porVencer.length), `en ${d.cfg.dias} días o menos`, 'amber', 'vencimientos?f=porvencer')}
        ${kpi('Lotes vencidos', num(a.vencidos.length), 'con stock en bodega', 'red', 'vencimientos?f=vencido')}
        ${kpi('Kits en préstamo', num(a.kitsPendientes.length), 'por devolver', 'green', 'kits?tab=prestamo')}
      </div>
      <div class="grid g2">
        <section class="card"><div class="card-h"><h2>Retiros de bodega</h2><span class="muted">últimos 14 días</span></div>${chart}</section>
        <section class="card"><div class="card-h"><h2>Vencimiento por categoría</h2><a class="link" href="#/vencimientos">Ver detalle</a></div>
          <div class="catbars">${d.porCategoria.filter((c) => c.insumos).map((c) => `<div class="catbar"><span>${esc(c.nombre)}</span>${stackBar(c)}<b>${num(c.vigente + c.porvencer + c.vencido)}</b></div>`).join('') || emptyState('Sin categorías.')}</div>
          <div class="legend"><span><i class="bg-green"></i>Vigente</span><span><i class="bg-amber"></i>Por vencer</span><span><i class="bg-red"></i>Vencido</span></div>
        </section>
      </div>
      <div class="grid g3">
        <section class="card"><div class="card-h"><h2>Kits en préstamo</h2><a class="link" href="#/kits?tab=prestamo">Ver todos</a></div>
          ${a.kitsPendientes.length ? `<ul class="list">${a.kitsPendientes.slice(0, 6).map((e) => `<li><span class="li-ic c-blue">${icon('user')}</span><div><b>${esc(e.persona)}</b><small>${esc(e.kit_nombre)} · desde ${fshort(e.fecha_entrega)}</small></div><span class="${e.diasFuera > 14 ? 'c-amber' : 'muted'}">${e.diasFuera} d</span></li>`).join('')}</ul>` : emptyState('No hay kits prestados.')}
        </section>
        <section class="card"><div class="card-h"><h2>Próximos a vencer</h2></div>
          ${a.porVencer.length ? `<ul class="list">${a.porVencer.slice(0, 6).map((l) => `<li><span class="li-ic c-amber">${icon('clock')}</span><div><b>${esc(l.insumo.nombre)}</b><small>${num(l.disponible)} ${esc(l.insumo.unidad)} · lote ${esc(l.codigo_lote || '#' + l.id)}</small></div><span class="c-amber">${diasTxt(l.dias)}</span></li>`).join('')}</ul>` : emptyState('Nada por vencer.')}
        </section>
        <section class="card"><div class="card-h"><h2>Últimos movimientos</h2><a class="link" href="#/salidas">Historial</a></div>
          ${movs ? `<ul class="list">${movs}</ul>` : emptyState('Sin movimientos.')}
        </section>
      </div>
      ${a.bajos.length + a.agotados.length ? `<section class="card"><div class="card-h"><h2>Reponer pronto</h2></div><div class="chips">${a.agotados.concat(a.bajos).map((r) => `<a class="chip" href="#/inventario?q=${encodeURIComponent(r.insumo.codigo)}">${esc(r.insumo.nombre)} ${badge(r.estado, num(r.utilizable) + ' / mín ' + num(r.insumo.stock_minimo))}</a>`).join('')}</div></section>` : ''}`;
  },
};

/* =====================================================================
   Acceso a datos. Dos motores con la misma interfaz:
   · Supabase (PostgreSQL en la nube, compartido entre dispositivos)
   · Demo: PGlite (PostgreSQL compilado a WebAssembly, en el navegador)
   Ambos ejecutan el mismo sql/schema.sql.
   ===================================================================== */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
const PGLITE_JS = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.17/dist/index.js';
const DEMO_DB = 'idb://bodega-demo';

const TABLES = {
  configuracion: 'clave', categorias: 'id', unidades: 'id', insumos: 'id', lotes: 'id', v_lotes: 'id',
  kits: 'id', kit_items: 'kit_id', entregas: 'id', entrega_items: 'id', operaciones: 'id', movimientos: 'id',
};
const RPCS = new Set(['registrar_ingreso', 'registrar_salida', 'ajustar_stock', 'anular_operacion', 'guardar_kit',
  'entregar_kit', 'devolver_kit', 'revertir_devolucion', 'anular_entrega', 'guardar_config']);

let mode = null;
let sb = null;
let pg = null;

export const getMode = () => mode;

/* ---------- Errores legibles ---------- */
function friendly(err) {
  const code = err && err.code;
  const msg = (err && (err.message || err.details)) || String(err);
  if (code === '23505') return new Error('Ya existe un registro con ese código o nombre.');
  if (code === '23503') return new Error('No se puede eliminar: hay otros registros que lo usan (lotes, kits o movimientos).');
  if (code === '23514') return new Error('Algún valor no es válido (revisa cantidades y campos obligatorios).');
  if (code === '42501' || /row-level security/i.test(msg)) return new Error('Sin permiso en la base de datos. ¿Ejecutaste sql/supabase.sql?');
  if (code === 'PGRST202' || /Could not find the function/i.test(msg)) return new Error('Falta una función en la base de datos. Ejecuta sql/schema.sql en Supabase.');
  if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(msg)) return new Error('Faltan tablas en la base de datos. Ejecuta sql/schema.sql en Supabase.');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new Error('Sin conexión con la base de datos. Revisa tu internet.');
  return new Error(msg.replace(/^ERROR:\s*/, ''));
}

/* ---------- Normalización (PGlite devuelve Date y BigInt) ---------- */
function normValue(v) {
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  return v;
}
const normRows = (rows) => rows.map((r) => { const o = {}; for (const k in r) o[k] = normValue(r[k]); return o; });
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('Identificador inválido: ' + s); return s; };
const tbl = (t) => { if (!(t in TABLES)) throw new Error('Tabla no permitida: ' + t); return t; };
// Parsers de PGlite: fechas y numéricos como texto, igual que Supabase
const PG_PARSERS = { 1082: (x) => x, 1114: (x) => x, 1184: (x) => x, 20: (x) => Number(x), 1700: (x) => Number(x) };

async function pgQuery(sql, params) {
  try {
    const r = await pg.query(sql, params || [], { parsers: PG_PARSERS });
    return normRows(r.rows);
  } catch (e) { throw friendly(e); }
}

/* ---------- Conexión ---------- */
export async function connect(onStatus) {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    onStatus && onStatus('Conectando con Supabase…');
    const { createClient } = await import(SUPABASE_JS);
    // Acepta la URL aunque se haya copiado con /rest/v1/ o con espacios
    const url = SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '');
    sb = createClient(url, SUPABASE_ANON_KEY.trim(), { auth: { persistSession: false } });
    mode = 'supabase';
    return mode;
  }
  onStatus && onStatus('Iniciando base de datos local (modo demo)…');
  const { PGlite } = await import(PGLITE_JS);
  pg = new PGlite(DEMO_DB);
  if (pg.waitReady) await pg.waitReady;
  mode = 'demo';
  const r = await pgQuery("select to_regclass('public.insumos')::text as t");
  if (!r[0] || !r[0].t) await installDemo(onStatus);
  return mode;
}

async function installDemo(onStatus) {
  onStatus && onStatus('Creando tablas y datos de ejemplo…');
  const [schema, demo] = await Promise.all([
    fetch('sql/schema.sql').then((r) => r.text()),
    fetch('sql/demo.sql').then((r) => r.text()),
  ]);
  try {
    await pg.exec(schema);
    await pg.exec(demo);
  } catch (e) { throw friendly(e); }
}

/** Solo modo demo: borra todo y vuelve a crear la base de ejemplo (vacía o con datos). */
export async function resetDemo(withData) {
  if (mode !== 'demo') throw new Error('Solo disponible en modo demo.');
  await pg.exec('drop schema public cascade; create schema public;');
  const schema = await fetch('sql/schema.sql').then((r) => r.text());
  await pg.exec(schema);
  if (withData) await pg.exec(await fetch('sql/demo.sql').then((r) => r.text()));
}

/* ---------- Lectura ---------- */
export async function selectAll(table) {
  tbl(table);
  const order = TABLES[table];
  if (mode === 'supabase') {
    const page = 1000;
    let out = [];
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from(table).select('*').order(order, { ascending: true }).range(from, from + page - 1);
      if (error) throw friendly(error);
      out = out.concat(data || []);
      if (!data || data.length < page) break;
    }
    return out;
  }
  return pgQuery(`select * from ${table} order by ${order}`);
}

/* ---------- Escritura simple (catálogos) ---------- */
export async function insert(table, row) {
  tbl(table);
  if (mode === 'supabase') {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw friendly(error);
    return data;
  }
  const keys = Object.keys(row).map(ident);
  const rows = await pgQuery(`insert into ${table} (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, keys.map((k) => row[k]));
  return rows[0];
}

export async function update(table, id, patch) {
  tbl(table);
  if (mode === 'supabase') {
    const { error } = await sb.from(table).update(patch).eq('id', id);
    if (error) throw friendly(error);
    return;
  }
  const keys = Object.keys(patch).map(ident);
  await pgQuery(`update ${table} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1}`, keys.map((k) => patch[k]).concat([id]));
}

export async function remove(table, id) {
  tbl(table);
  if (mode === 'supabase') {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw friendly(error);
    return;
  }
  await pgQuery(`delete from ${table} where id = $1`, [id]);
}

/* ---------- Operaciones de stock (funciones SQL) ---------- */
export async function rpc(name, args) {
  if (!RPCS.has(name)) throw new Error('Operación no permitida: ' + name);
  const clean = {};
  Object.entries(args || {}).forEach(([k, v]) => { if (v !== undefined) clean[k] = v === '' ? null : v; });
  if (mode === 'supabase') {
    const { data, error } = await sb.rpc(name, clean);
    if (error) throw friendly(error);
    return data;
  }
  const keys = Object.keys(clean).map(ident);
  const vals = keys.map((k) => (clean[k] !== null && typeof clean[k] === 'object' ? JSON.stringify(clean[k]) : clean[k]));
  const argSql = keys.map((k, i) => `${k} => $${i + 1}${clean[k] !== null && typeof clean[k] === 'object' ? '::jsonb' : ''}`).join(', ');
  const rows = await pgQuery(`select ${name}(${argSql}) as r`, vals);
  return rows[0] ? rows[0].r : null;
}

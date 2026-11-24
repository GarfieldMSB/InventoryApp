-- =====================================================================
--  Bodega · Permisos para Supabase
--  Ejecutar DESPUÉS de schema.sql, en el SQL Editor de Supabase.
--
--  ⚠ ETAPA SIN USUARIOS: estas políticas dejan leer y escribir a
--  cualquiera que tenga la URL de la app (la "anon key" es pública por
--  diseño). Sirve para probar. Cuando se agregue inicio de sesión, se
--  reemplazan por políticas "to authenticated" (ver README).
-- =====================================================================

-- La vista respeta los permisos de quien consulta
alter view v_lotes set (security_invoker = true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['configuracion', 'categorias', 'unidades', 'insumos', 'lotes', 'kits', 'kit_items',
                           'entregas', 'entrega_items', 'operaciones', 'movimientos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists acceso_temporal on %I', t);
    execute format('create policy acceso_temporal on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

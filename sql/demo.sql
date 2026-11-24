-- =====================================================================
--  Bodega · Datos de demostración (opcional)
--  Solo se cargan si la base no tiene insumos. Fechas relativas a hoy.
-- =====================================================================
do $$
declare
  hoy date := current_date;
  r record;
  d integer;
  v_kit bigint;
  v_ent bigint;
  v_items jsonb;
  destinos text[] := array['Urgencia', 'Pabellón', 'Sala 2° piso', 'Policlínico'];
  personas text[] := array['J. Pérez', 'M. González', 'C. Rojas', 'A. Muñoz', 'F. Díaz'];
begin
  if exists (select 1 from insumos) then
    raise notice 'La base ya tiene insumos: no se cargaron datos de demostración';
    return;
  end if;
  perform setseed(0.42);

  insert into categorias (nombre) values ('EPP'), ('Curación'), ('Limpieza'), ('Medicamentos'), ('Instrumental'), ('Oficina')
  on conflict (nombre) do nothing;
  insert into unidades (nombre, abreviatura) values
    ('unidad', 'u'), ('par', 'par'), ('caja', 'cja'), ('paquete', 'paq'), ('botella', 'bot'),
    ('bidón', 'bid'), ('resma', 'rsm'), ('rollo', 'rll')
  on conflict (nombre) do nothing;

  insert into insumos (codigo, nombre, categoria_id, unidad_id, stock_minimo, reutilizable)
  select v.codigo, v.nombre, c.id, u.id, v.minimo, v.reu
  from (values
    ('GUA-001', 'Guantes de nitrilo talla M', 'EPP', 'par', 60, false),
    ('MAS-001', 'Mascarilla quirúrgica', 'EPP', 'unidad', 80, false),
    ('PEC-001', 'Pechera desechable', 'EPP', 'unidad', 40, false),
    ('ANT-001', 'Antiparras de seguridad', 'EPP', 'unidad', 4, true),
    ('GAS-010', 'Gasa estéril 10x10 cm', 'Curación', 'paquete', 30, false),
    ('APO-001', 'Apósito transparente 6x7 cm', 'Curación', 'unidad', 30, false),
    ('VEN-010', 'Venda elástica 10 cm', 'Curación', 'unidad', 10, false),
    ('JER-005', 'Jeringa desechable 5 ml', 'Curación', 'unidad', 100, false),
    ('SUE-500', 'Suero fisiológico 500 ml', 'Medicamentos', 'unidad', 30, false),
    ('PAR-500', 'Paracetamol 500 mg (caja 16)', 'Medicamentos', 'caja', 10, false),
    ('ALC-001', 'Alcohol gel 1 L', 'Limpieza', 'botella', 10, false),
    ('CLO-005', 'Cloro concentrado 5 L', 'Limpieza', 'bidón', 3, false),
    ('TIJ-001', 'Tijera punta roma', 'Instrumental', 'unidad', 3, true),
    ('TER-001', 'Termómetro digital', 'Instrumental', 'unidad', 3, true),
    ('PIN-001', 'Pinza anatómica', 'Instrumental', 'unidad', 3, true),
    ('BOL-001', 'Bolso de primeros auxilios', 'Instrumental', 'unidad', 2, true),
    ('PAP-A4', 'Resma papel A4', 'Oficina', 'resma', 5, false)
  ) as v(codigo, nombre, cat, uni, minimo, reu)
  join categorias c on c.nombre = v.cat
  join unidades u on u.nombre = v.uni;

  -- Lotes: (código, días desde ingreso, cantidad, días al vencimiento | null, proveedor)
  insert into lotes (insumo_id, fecha_ingreso, cantidad, vence, codigo_lote, proveedor, documento)
  select i.id, hoy - v.ing, v.cant, case when v.ven is null then null else hoy + v.ven end,
         case when v.ven is null then null else 'L' || to_char(hoy - v.ing, 'YYMM') || '-' || lpad((row_number() over ())::text, 3, '0') end,
         v.prov, 'FAC-' || (10200 + row_number() over ())
  from (values
    ('GUA-001', 85, 300, -20, 'Distribuidora Andes'), ('GUA-001', 40, 400, 300, 'Distribuidora Andes'),
    ('MAS-001', 80, 500, 200, 'Distribuidora Andes'),
    ('PEC-001', 70, 200, null::integer, 'Distribuidora Andes'),
    ('ANT-001', 90, 10, null, 'Distribuidora Andes'),
    ('GAS-010', 84, 120, -30, 'MediSur Ltda.'), ('GAS-010', 50, 150, 18, 'MediSur Ltda.'), ('GAS-010', 15, 150, 260, 'MediSur Ltda.'),
    ('APO-001', 75, 100, -8, 'MediSur Ltda.'), ('APO-001', 30, 80, 12, 'MediSur Ltda.'),
    ('VEN-010', 60, 40, 600, 'MediSur Ltda.'),
    ('JER-005', 70, 400, 700, 'MediSur Ltda.'),
    ('SUE-500', 82, 120, -15, 'Farmacia Central'), ('SUE-500', 45, 60, 22, 'Farmacia Central'), ('SUE-500', 10, 100, 420, 'Farmacia Central'),
    ('PAR-500', 60, 40, 9, 'Farmacia Central'), ('PAR-500', 20, 30, 300, 'Farmacia Central'),
    ('ALC-001', 70, 36, 380, 'Comercial Limpio'),
    ('CLO-005', 65, 10, 160, 'Comercial Limpio'),
    ('TIJ-001', 90, 8, null, 'MediSur Ltda.'),
    ('TER-001', 90, 6, null, 'MediSur Ltda.'),
    ('PIN-001', 90, 8, null, 'MediSur Ltda.'),
    ('BOL-001', 90, 5, null, 'MediSur Ltda.'),
    ('PAP-A4', 60, 30, null, 'OfiMax')
  ) as v(codigo, ing, cant, ven, prov)
  join insumos i on i.codigo = v.codigo;

  -- Retiros diarios simulados
  for d in reverse 80..0 loop
    for r in
      select i.id, i.codigo, c.nombre as cat, v.uso
      from insumos i join categorias c on c.id = i.categoria_id
      join (values ('GUA-001', 20), ('MAS-001', 25), ('PEC-001', 12), ('GAS-010', 6), ('APO-001', 4),
                   ('VEN-010', 2), ('JER-005', 25), ('SUE-500', 4), ('PAR-500', 3), ('ALC-001', 3),
                   ('CLO-005', 1), ('PAP-A4', 2)) as v(codigo, uso) on v.codigo = i.codigo
      order by i.id
    loop
      if random() < 0.12 then
        begin
          perform registrar_salida(
            r.id, greatest(1, round(r.uso * (0.5 + random())))::integer, hoy - d, 'Despacho',
            case when r.cat = 'Oficina' then 'Administración' when r.cat = 'Limpieza' then 'Aseo y mantención'
                 else destinos[1 + floor(random() * 4)::integer] end,
            personas[1 + floor(random() * 5)::integer], null, null);
        exception when others then
          null; -- sin stock ese día: se omite
        end;
      end if;
    end loop;
  end loop;

  -- Plantillas de kits
  insert into kits (codigo, nombre, descripcion) values
    ('KIT-CUR', 'Kit de curación', 'Curación simple de heridas'),
    ('KIT-PAU', 'Kit de primeros auxilios', 'Bolso completo para terreno o eventos'),
    ('KIT-ASE', 'Kit de aseo terminal', 'Limpieza y desinfección de una sala');
  insert into kit_items (kit_id, insumo_id, cantidad)
  select k.id, i.id, v.cant
  from (values
    ('KIT-CUR', 'GAS-010', 4), ('KIT-CUR', 'APO-001', 2), ('KIT-CUR', 'GUA-001', 2), ('KIT-CUR', 'SUE-500', 1), ('KIT-CUR', 'PIN-001', 1),
    ('KIT-PAU', 'BOL-001', 1), ('KIT-PAU', 'TIJ-001', 1), ('KIT-PAU', 'TER-001', 1), ('KIT-PAU', 'GAS-010', 6), ('KIT-PAU', 'VEN-010', 2),
    ('KIT-PAU', 'GUA-001', 4), ('KIT-PAU', 'PAR-500', 1), ('KIT-PAU', 'APO-001', 4),
    ('KIT-ASE', 'CLO-005', 1), ('KIT-ASE', 'ALC-001', 1), ('KIT-ASE', 'GUA-001', 2), ('KIT-ASE', 'PEC-001', 2), ('KIT-ASE', 'ANT-001', 1)
  ) as v(kit, ins, cant)
  join kits k on k.codigo = v.kit join insumos i on i.codigo = v.ins;

  -- Entregas de ejemplo: dos devueltas y tres en préstamo
  for r in
    select * from (values
      ('KIT-PAU', 30, 'Carolina Soto', 'Operativo de vacunación', true),
      ('KIT-CUR', 14, 'Diego Fuentes', 'Policlínico', true),
      ('KIT-PAU', 6, 'Valentina Rivas', 'Evento deportivo', false),
      ('KIT-CUR', 3, 'Tomás Herrera', 'Urgencia', false),
      ('KIT-ASE', 1, 'Equipo de aseo', 'Sala 2° piso', false)
    ) as v(kit, dias, persona, destino, devuelto)
  loop
    select id into v_kit from kits where codigo = r.kit;
    select jsonb_agg(jsonb_build_object('insumo_id', insumo_id, 'cantidad', cantidad)) into v_items
    from kit_items where kit_id = v_kit;
    begin
      v_ent := entregar_kit(v_kit, hoy - r.dias, r.persona, v_items, r.destino, 'M. González', null);
      if r.devuelto then
        select jsonb_agg(jsonb_build_object(
                 'id', ei.id,
                 'devuelto', case when i.reutilizable then ei.cantidad else 0 end,
                 'descartado', case when i.reutilizable then 0 else ei.cantidad end))
          into v_items
        from entrega_items ei join insumos i on i.id = ei.insumo_id
        where ei.entrega_id = v_ent;
        perform devolver_kit(v_ent, hoy - r.dias + 2, v_items, 'M. González', null);
      end if;
    exception when others then
      raise notice 'No se pudo crear la entrega de ejemplo %: %', r.kit, sqlerrm;
    end;
  end loop;

  -- Una baja por vencimiento y un ajuste de conteo
  begin
    perform registrar_salida((select id from insumos where codigo = 'GAS-010'), 10, hoy - 5,
                             'Baja por vencimiento', 'Eliminación', 'M. González', 'Retiro parcial de lote vencido', null);
  exception when others then null;
  end;
  begin
    perform ajustar_stock((select id from lotes where insumo_id = (select id from insumos where codigo = 'MAS-001') order by id limit 1),
                          (select disponible - 5 from v_lotes where insumo_id = (select id from insumos where codigo = 'MAS-001') order by id limit 1),
                          hoy - 2, 'Conteo físico', 'Diferencia detectada en inventario mensual');
  exception when others then null;
  end;

  perform guardar_config('nombre_bodega', 'Bodega Central');
end $$;

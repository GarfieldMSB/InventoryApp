# Bodega · Control de inventario

Aplicación web para administrar los insumos de una bodega:

- **Lotes con vencimiento.** Cada ingreso guarda su propia fecha de vencimiento.
- **Salidas.** Se descuenta primero lo que vence antes (FEFO).
- **Kits en préstamo.** Se arman a pedido, se entregan a una persona y, al devolverlos, se indica qué vuelve al stock y qué se desecha.
- **Ajustes por conteo físico.**
- **Panel de administración.**

Funciona en PC y en el celular, y se publica gratis en **GitHub Pages**. La base de datos es **PostgreSQL en Supabase**, también gratis.

```
 Celular / PC  ──►  GitHub Pages (HTML + JS, sin servidor)  ──►  Supabase (PostgreSQL)
```

No necesita instalar Node ni compilar nada: son archivos estáticos.

---

## 1. Probarla en tu computador (modo demo)

Si `js/config.js` no tiene datos de Supabase, la app arranca en **modo demo**. Usa un PostgreSQL que corre dentro del navegador ([PGlite](https://pglite.dev)), ejecuta el mismo `sql/schema.sql` y carga datos de ejemplo.

```bash
cd InventoryApp
python3 -m http.server 8080
# abrir http://localhost:8080
```

> No funciona con doble clic en `index.html`: los navegadores bloquean los módulos JavaScript abiertos como archivo local. La primera vez necesita internet para descargar PGlite (unos 3 MB).

En modo demo, los datos quedan **solo en ese navegador**. Para reiniciarlos: *Configuración → Reiniciar demo*.

## 2. Crear la base de datos en Supabase (una vez)

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com). El plan gratuito alcanza.
2. En el proyecto, abre **SQL Editor** y ejecuta, en este orden, el contenido de:
   1. `sql/schema.sql`: tablas, vistas y funciones.
   2. `sql/supabase.sql`: permisos.
   3. `sql/demo.sql`: *opcional*, datos de ejemplo. Sáltalo si quieres partir vacío.
3. En **Project Settings → API** (o **API Keys**), copia la **Project URL** y la clave **anon** o **publishable**.
4. Pégalas en `js/config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';   // o sb_publishable_...
   ```

La clave anon/publishable está hecha para ir en el navegador. **Nunca** pongas la clave `service_role` ni la `secret`.

## 3. Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube esta carpeta tal cual (con `index.html` en la raíz).
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. En uno o dos minutos queda disponible en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.
4. En el celular, ábrela en el navegador y usa **"Agregar a pantalla de inicio"** para tenerla como app.

Cada vez que hagas *push*, GitHub Pages se actualiza solo.

## ⚠ Seguridad en esta etapa (sin usuarios)

Como todavía no hay inicio de sesión, `sql/supabase.sql` deja que **cualquiera que tenga el link de la app** pueda leer y modificar los datos. Mientras tanto:

- No compartas el link públicamente.
- Si el repositorio es público, considera que `js/config.js` se puede ver. Esto es normal con la clave anon, pero refuerza el punto anterior.

**Cuando se agregue autenticación**, que Supabase trae incluida, solo hay que activar Supabase Auth y reemplazar las políticas `acceso_temporal` por políticas `to authenticated`. La estructura de la base ya está preparada para eso.

---

## Cómo funciona

### El stock nunca se escribe a mano

Solo se registran **movimientos**. El stock se calcula:

```
stock de un lote   = cantidad ingresada + suma de sus movimientos
stock de un insumo = suma de sus lotes
```

| Operación | Efecto en el stock |
|---|---|
| Ingreso | Crea un lote nuevo con su vencimiento |
| Salida (despacho) | Descuenta, primero del lote que vence antes. **No usa lotes vencidos** |
| Baja por vencimiento | Descuenta solo de lotes vencidos |
| Entrega de kit | Descuenta cada insumo del kit (FEFO, sin vencidos) |
| Devolución de kit | Lo que **vuelve** se restituye a los mismos lotes; lo **desechado** queda descontado |
| Ajuste | Deja el lote con la cantidad contada y registra la diferencia |

Las operaciones que mueven stock son **funciones de PostgreSQL** (`registrar_salida`, `entregar_kit`, `devolver_kit`, etc.). Son transaccionales: se aplica todo o nada. Además bloquean los lotes mientras calculan, así que dos personas registrando al mismo tiempo desde distintos celulares no pueden dejar stock negativo.

### Kits

1. **Plantilla** (*Administración → Plantillas de kits*): qué insumos lleva y cuántos.
2. **Entrega** (*Kits → Entregar kit*): eliges la plantilla y ajustas el contenido según lo que haya. Indicas a quién se entrega. La app avisa si falta stock.
3. **Devolución** (*Kits → En préstamo → Registrar devolución*): para cada insumo indicas cuántos **vuelven al stock**. El resto queda como **usado o desechado**. Los insumos marcados como **reutilizables** en el catálogo vienen preseleccionados para volver; los demás, para desecharse.

Se puede **anular** una entrega o **revertir** una devolución si hubo un error.

### Secciones

| Operación | Administración |
|---|---|
| Inicio: resumen, alertas, kits prestados | Insumos: crear, editar, desactivar, marcar reutilizable |
| Inventario: por insumo (con lotes) y por categoría | Plantillas de kits |
| Ingresos | Categorías y unidades |
| Salidas: por fecha, con total por insumo | Ajustes de stock (conteo físico) |
| Kits: en préstamo, devueltos, entregar | Configuración: nombre, días "por vencer", exportar |
| Vencimientos: vencidos, por vencer, vigentes; dar de baja | |

Todas las listas se pueden exportar a **CSV**, que se abre directo en Excel.

## Estructura del proyecto

```
index.html                 página única
css/app.css                diseño (claro/oscuro, PC y celular)
js/config.js               ← datos de conexión a Supabase
js/db.js                   acceso a datos (Supabase o PGlite en modo demo)
js/store.js                carga de datos y cálculos (vencimientos, préstamos, alertas)
js/core.js                 estado de la interfaz, borradores de formularios
js/app.js                  navegación, menú, eventos
js/views/*.js              cada pantalla
sql/schema.sql             tablas, vista v_lotes y funciones (la lógica de stock)
sql/supabase.sql           permisos para Supabase (etapa sin usuarios)
sql/demo.sql               datos de ejemplo
```

## Próximos pasos sugeridos

1. **Usuarios y roles** con Supabase Auth (por ejemplo bodeguero, administrador y solo lectura), dejando registrado quién hizo cada movimiento.
2. Lectura de **códigos de barra / QR** con la cámara del celular.
3. **Avisos por correo** de lotes por vencer y kits no devueltos.
4. Mostrar en tiempo real los cambios que hace otra persona (Supabase Realtime).

# MAR-Z: plataforma de solicitudes de soporte

Aplicación web en Node.js, Express y PostgreSQL.

## Requisitos
- Node.js 18 o superior
- PostgreSQL con pgAdmin

## 1. Crear la base de datos
1. En pgAdmin, clic derecho en **Databases** → **Create** → **Database…**, nombre `mar_z`, owner `postgres` → **Save**.
2. Clic derecho en **mar_z** → **Query Tool**.
3. Abre y ejecuta con **F5**, en este orden:
   1. `db/init.sql` (tablas del Sprint 1)
   2. `db/sprint2.sql` (Sprint 2)
   3. `db/sprint3.sql` (Sprint 3)
4. Si aparecen avisos "ya existe, omitiendo", es normal: los scripts se pueden correr varias veces.

## 2. Configurar la conexión
Por defecto la aplicación usa: servidor `localhost`, puerto `5432`, base `mar_z`, usuario `postgres`, clave `1234`.
Si tu clave es otra, antes de arrancar escribe en Git Bash:
```
export PGPASSWORD=tu_clave
```
(En CMD de Windows: `set PGPASSWORD=tu_clave`.)

## 3. Ejecutar
```
npm install
npm start
```
Abre http://localhost:3000.

## Errores comunes
- **PostgreSQL FALLO / ECONNREFUSED:** el servidor de PostgreSQL no está encendido. Abre pgAdmin o inicia el servicio de PostgreSQL.
- **la autenticación password falló:** la clave no es `1234`; usa `PGPASSWORD` como en el paso 2.
- **no existe la relación «usuarios»:** falta ejecutar `init.sql` sobre la base `mar_z`.

## Roles
Solicitante, Agente, Coordinador y Auditor. Cada uno se registra desde la página de inicio eligiendo su rol.
Los usuarios de prueba deben ser ficticios.

# Sistema de Control de Stock

Aplicación interna para registrar inventario retirado por técnicos. Se ejecuta en una PC de la LAN y continúa aceptando movimientos cuando MongoDB Atlas no está disponible. MongoDB conserva el stock confirmado; SQLite almacena sesiones locales y una durable outbox de intenciones, nunca una copia autoritativa del inventario.

## Arquitectura

- `frontend`: React, Vite, JavaScript, Tailwind, React Router e IndexedDB como protección antes de que un request llegue al servidor.
- `backend`: monolito modular Express con Mongoose, Zod, sesiones HttpOnly, RBAC, auditoría y worker de sincronización.
- MongoDB Atlas: productos, usuarios, stock, movimientos append-only y auditoría inmutable.
- SQLite: outbox, locks/estado de sincronización y sesiones necesarias para operar durante una caída de Atlas.
- Nginx: sirve el build frontend y envía `/api` al backend dentro de Compose.

El frontend divide el JavaScript por pantalla y precarga una ruta sólo cuando el usuario apunta o
enfoca su enlace. Las tablas pesadas están aisladas de los estados de formularios para evitar
rerenders por cada tecla. Nginx comprime las respuestas y conserva durante un año únicamente los
assets versionados por hash; `index.html` nunca queda fijado en caché.

Cada operación de stock lleva un `operationId` UUID único. El servidor la persiste primero en SQLite, intenta una transacción MongoDB y responde `SYNCED` o `PENDING`. Al reconectar, el worker reclama una operación por vez, aplica backoff y evalúa la intención contra el stock actual. Los conflictos quedan visibles y sólo se resuelven explícitamente.

## Requisitos

- Desarrollo: Node.js 22 o superior, npm y MongoDB Atlas.
- Producción local: Docker Engine con Docker Compose.
- Backups: MongoDB Database Tools (`mongodump` y `mongorestore`).
- Atlas debe usar un replica set, como ocurre en los clusters administrados, para soportar transacciones.

## Configuración

Copiar `.env.example` a `.env` y reemplazar todos los ejemplos. No versionar `.env`.

Variables principales:

- `MONGODB_URI`: URI completa de Atlas con una cuenta de mínimo privilegio para esta base.
- `SESSION_SECRET`: al menos 32 caracteres aleatorios.
- `FRONTEND_ORIGIN`: origen exacto visto por el navegador, por ejemplo `http://192.168.1.20:8080`.
- `SQLITE_PATH`: archivo persistente de outbox/sesiones.
- `LOG_PATH`, `LOG_LEVEL`: ubicación y nivel del log JSON rotativo.
- `BACKUP_PATH`: carpeta del host para backups.
- `BACKEND_PORT`, `FRONTEND_PORT` y `HOST_BACKUP_PATH`: puertos y carpeta publicados por Compose. Dentro del contenedor, SQLite, logs y backups usan rutas fijas persistentes.
- `COOKIE_SECURE=true`: sólo cuando la aplicación se publica mediante HTTPS; para HTTP dentro de LAN debe quedar `false`.
- `SESSION_HOURS` y `SYNC_INTERVAL_MS`: expiración de sesión y frecuencia base del worker.

En Atlas, permitir únicamente la IP pública de salida de la empresa, crear un usuario dedicado para la base y habilitar backups administrados cuando el plan lo permita. No copiar la URI a logs o capturas.

## Desarrollo

```powershell
npm.cmd install
npm.cmd run dev
```

Vite escucha en `0.0.0.0:5173` y Express en `0.0.0.0:3000`. El seed nunca corre automáticamente:

```powershell
$env:MONGODB_URI='mongodb+srv://...'
$env:SEED_ADMIN_PASSWORD='una-clave-larga'
npm.cmd run seed -w backend
```

El seed crea el administrador `info@mialarma.com.uy`, una categoría, una ubicación y un
producto. Los técnicos se crean desde la pantalla Usuarios. La contraseña puede cambiarse desde
esa misma pantalla por un administrador y el cambio cierra las sesiones activas del usuario.

### Flujo de operación

- `Registrar entrada` conserva el flujo independiente de ingreso de mercadería existente.
- Al crear una categoría, el administrador define manualmente su prefijo en el campo `Código`, por
  ejemplo `CAM` o `DVR`. Al crear un producto, la categoría seleccionada determina el prefijo y el
  backend asigna automáticamente el siguiente correlativo de seis dígitos (`CAM-000002`, etc.),
  incluso ante altas simultáneas; el usuario nunca escribe el código interno.
- El formulario de producto incluye el conteo físico inicial. Si es mayor que cero, se registra como
  un movimiento de ajuste trazable; no se modifica stock directamente.
- `Auditoría y sincronización` reúne en una pantalla la outbox, los conflictos y el registro
  inmutable de acciones.
- El resumen operacional muestra entradas y salidas de hoy y del mes actual, además de alertas de
  stock.

## Docker y uso en LAN

### Preparar una PC nueva

Copiar o clonar el repositorio en la PC definitiva y ejecutar una vez:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

El instalador solicita elevación, habilita WSL 2 y Virtual Machine Platform, instala Docker
Desktop, MongoDB Database Tools y Git, crea `.env` solicitando la URI de Atlas sin mostrarla,
genera un secreto de sesión, propone la IP LAN y abre el puerto 8080 sólo para redes privadas.
Si Windows requiere reinicio, reiniciar y luego ejecutar `start.ps1`. Para reemplazar una
configuración existente use `-Reconfigure`; para reiniciar automáticamente cuando sea necesario,
use `-RestartNow`.

Arranque validado (comprueba WSL, Docker/Compose, `.env`, MongoDB Tools y health):

```powershell
.\scripts\start.ps1
```

Use `-NoBuild` para reutilizar las imágenes existentes. Para detener y eliminar contenedores,
red e imágenes locales conservando SQLite, logs y backups:

```powershell
.\scripts\stop.ps1
```

El borrado de volúmenes es deliberadamente explícito y no elimina los backups del host:

```powershell
.\scripts\stop.ps1 -PurgeData
```

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

Abrir `http://IP_DE_LA_PC:8080` desde otra PC de la misma red. Configurar el firewall del host para permitir sólo el puerto frontend desde el perfil de red privada. El backend se publica en 3000 para diagnóstico; si no se necesita acceso directo, quitar su sección `ports` y usar sólo Nginx. Los volúmenes `sqlite-data` y `application-logs` deben conservarse entre recreaciones y reinicios.

Para detener sin perder datos: `docker compose down`. No usar `docker compose down -v`, porque elimina los volúmenes locales de recuperación.

## Verificación

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run test:integration
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Los tests de integración levantan un replica set Mongo aislado y prueban concurrencia, idempotencia, append-only y reconexión de una outbox persistida. Playwright levanta otro entorno aislado y recorre entrada/salida y RBAC desde Chromium.

## Health, logs y operación offline

`GET /api/health` devuelve `healthy`, `degraded` o `unhealthy`, conectividad de Mongo y cantidades `pending`, `syncing`, `failed` y `conflicts`. La cabecera `x-request-id` permite correlacionar errores, logs y auditoría.

Los logs JSON rotan diariamente o al alcanzar 10 MB, comprimen archivos anteriores y conservan 14. En Compose viven en `application-logs`. Nunca incluyen passwords, cookies, tokens, secretos o la URI de Mongo.

Si Atlas cae:

1. La sesión sigue disponible en SQLite.
2. La salida se guarda en la outbox y aparece como pendiente; no se muestra como confirmada.
3. Al volver Atlas, el worker evalúa la intención contra el stock actual.
4. Si sigue siendo válida, queda `SYNCED`; si no, queda `CONFLICT` sin alterar stock.
5. Un administrador revisa `/sistema` (Auditoría y sincronización) y resuelve mediante una nueva operación o un descarte motivado. El conflicto original permanece trazable.

Tras una caída de PC o contenedor, iniciar Compose normalmente. El worker devuelve locks `SYNCING` abandonados a `PENDING`. Antes de intervenir manualmente, revisar health, logs y el `operationId`; reenviar el mismo ID es seguro, inventar otro puede duplicar la intención.

## Backups y restauración

Backup manual con retención de 7 diarios y 4 semanales:

```powershell
.\scripts\backup.ps1 -MongoUri $env:MONGODB_URI -BackupPath $env:BACKUP_PATH
```

Programar ese comando diariamente con el Programador de tareas de Windows bajo una cuenta con acceso mínimo a la carpeta. Proteger la URI mediante un secret del sistema o wrapper no versionado. Supervisar el código de salida y copiar backups a otro dispositivo protegido.

Restaurar primero en una base de validación:

```powershell
.\scripts\restore.ps1 -MongoUri $env:MONGODB_URI -ArchivePath 'D:\backups\daily_....archive.gz'
```

`-DropExisting` es destructivo y sólo debe utilizarse durante una restauración planificada. Tras restaurar, comprobar health, usuarios, productos, últimos movimientos y stock antes de habilitar la LAN.

## Troubleshooting

- `MongoDB sin conexión`: comprobar Internet, allowlist Atlas, DNS y certificados; no borrar SQLite ni reenviar con IDs nuevos.
- Operación `FAILED`: revisar `lastError` y logs; un administrador puede reintentarla cuando se resuelva la causa transitoria.
- Operación `CONFLICT`: comparar stock disponible/solicitado y resolver explícitamente; nunca editar el movimiento original.
- Cookie no persiste: confirmar que `FRONTEND_ORIGIN` coincide exactamente y que `COOKIE_SECURE` sólo está activo con HTTPS.
- SQLite bloqueado: confirmar que existe una sola instancia backend escribiendo el mismo volumen y que la carpeta es persistente.
- Build nativo falla: usar Node 22 y reinstalar dependencias; `better-sqlite3` y Argon2 requieren sus binarios compatibles.

## Invariantes operativas

No existen endpoints DELETE funcionales. Movimientos y auditorías son inmutables. Las correcciones son movimientos compensatorios. El backend decide identidad, permisos, timestamps y stock anterior/resultante. Stock nunca puede ser negativo y un `operationId` nunca puede afectarlo dos veces.

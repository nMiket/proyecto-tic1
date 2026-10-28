# UPB Food

Estructura base profesional para un proyecto web con:

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Maven
- Base de datos: PostgreSQL
- Contenedores: Docker + Docker Compose

## Estructura

- `Frontend/`: interfaz web
- `Backend/`: API REST y logica de negocio
- `DataBase/`: scripts SQL (init, migrations, seeds)
- `docker-compose.yml`: orquestacion local
- `.env.example`: plantilla de variables de entorno

## Requisitos

- Docker Desktop
- Git
- Docker Desktop debe estar abierto y ejecutándose.

## Inicializar el proyecto

1. Clonar el repositorio y entrar a la carpeta del proyecto:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd proyecto-tic1/P_upbFood
```

2. Crear las variables locales desde la plantilla:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y configura una contraseña local de PostgreSQL y un secreto JWT propio. Este archivo está ignorado por Git.

3. Construir las imágenes y levantar los tres servicios en segundo plano:

```powershell
docker compose up --build -d
```

La primera ejecución puede tardar mientras Docker descarga PostgreSQL y construye el backend y el frontend. Para comprobar que los servicios estén activos:

```powershell
docker compose ps
```

Los tres servicios deben aparecer en estado `Up`; la base de datos debe mostrar además el estado `healthy`.

Servicios:

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

## Conexión a la base de datos desde DataGrip

Con los contenedores levantados, crea una nueva conexión de tipo **PostgreSQL** en DataGrip usando:

| Campo    | Valor                                        |
| -------- | -------------------------------------------- |
| Host     | `localhost`                                |
| Port     | `5432`                                     |
| Database | `upbfood`                                  |
| User     | `upbfood`                                  |
| Password | El valor de`POSTGRES_PASSWORD` en `.env` |

La URL JDBC equivalente es:

```text
jdbc:postgresql://localhost:5432/upbfood
```

Después de ingresar los datos, pulsa **Test Connection**. El contenedor `upbfood-db` debe estar activo y en estado `healthy` al ejecutar `docker compose ps`.

El formulario de login administrativo está disponible en http://localhost:5173/admin.

### Acceso administrativo de desarrollo

Las cuentas de desarrollo se inicializan desde `DataBase/init.sql`. No se incluyen contraseñas en este paquete; configura credenciales propias para el entorno local y cámbialas antes de cualquier despliegue.

## HU implementada: login administrativo

El flujo implementado permite que un administrador de cafetería:

- Abra el formulario de inicio de sesión desde la ruta `/admin`.
- Envíe su correo y contraseña al endpoint `POST /api/admin/login`.
- Reciba un JWT de acceso con su correo, identificador y restaurante asociado.
- Sea redirigido al panel administrativo después de autenticarse.
- Mantenga la sesión al recargar la página mediante un refresh token `HttpOnly`, revocable y persistido de forma hasheada.
- Renueve automáticamente el JWT cuando expira y cierre la sesión revocando el refresh token.
- Reciba mensajes para campos obligatorios y credenciales inválidas.

La implementación está distribuida así:

- Backend: `Backend/src/main/java/com/upbfood/Backend/controller/AdminAuthController.java`
- Solicitud DTO: `Backend/src/main/java/com/upbfood/Backend/dto/AdminLoginRequest.java`
- Entidad: `Backend/src/main/java/com/upbfood/Backend/entity/AdminUser.java`
- Sesiones: `Backend/src/main/java/com/upbfood/Backend/entity/RefreshToken.java`
- JWT: `Backend/src/main/java/com/upbfood/Backend/security/JwtService.java`
- Filtro Bearer: `Backend/src/main/java/com/upbfood/Backend/security/JwtAuthenticationFilter.java`
- Repositorio: `Backend/src/main/java/com/upbfood/Backend/repository/AdminUserRepository.java`
- Seguridad y CORS: `Backend/src/main/java/com/upbfood/Backend/config/SecurityConfig.java`
- Interfaz y rutas: `Frontend/src/App.tsx`
- Pruebas: `Backend/src/test/java/com/upbfood/Backend/AdminAuthControllerTest.java`

El backend valida la contraseña con BCrypt. Las respuestas principales son `200` para credenciales válidas, `401` para credenciales inválidas o sesión expirada y `400` cuando faltan datos. Las variables `APP_JWT_SECRET`, `APP_JWT_ACCESS_TOKEN_MINUTES`, `APP_JWT_REFRESH_TOKEN_DAYS` y `APP_AUTH_COOKIE_SECURE` permiten configurar los tokens por entorno.


## Solicitudes de registro aprobadas desde el correo

El administrador global ya no tiene una cuenta ni una vista dentro de la aplicación. Al enviarse una solicitud de restaurante, UPBFood manda un correo al destinatario configurado en `APP_NOTIFICACIONES_CORREO_DESTINO`, con enlaces separados para aprobar o rechazar. Cada enlace vence en 48 horas y requiere confirmar la decisión en la página de UPBFood; abrir el enlace por sí solo no modifica la solicitud.

Para que los correos se envíen, configura `MAIL_USERNAME`, `MAIL_PASSWORD`, `APP_NOTIFICACIONES_CORREO_DESTINO` y `APP_FRONTEND_URL` en `.env`.

### Panel del encargado de la universidad (HU031)

Además del correo, la persona encargada de la UPB puede revisar todas las solicitudes en `/upb/solicitudes`. El panel pide una clave institucional que se define en `.env` con `APP_UPB_REVISOR_CLAVE` (usa un valor largo y aleatorio). Si la variable queda vacía, el panel está deshabilitado y la API responde `403`.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/upb/solicitudes?estado=PENDIENTE` | Lista solicitudes (`PENDIENTE`, `APROBADA`, `RECHAZADA` o `TODAS`). |
| `POST` | `/api/upb/solicitudes/{id}/aprobar` | Aprueba y envía al solicitante el enlace para activar su cuenta de dueño. Si el correo no está configurado, la respuesta incluye `enlaceActivacion` para entregarlo manualmente. |
| `POST` | `/api/upb/solicitudes/{id}/rechazar` | Rechaza con una observación opcional (`{ "observacion": "..." }`) y notifica al solicitante. |

Todas las peticiones envían la clave en la cabecera `X-UPB-Revisor-Clave` y tienen límite de 30 peticiones por minuto por IP.

## Historial de pedidos del cliente (HU027)

La vista `/historial` muestra los pedidos hechos desde el mismo navegador y permite buscar todos los pedidos del cliente con `GET /api/pedidos/historial?correo=...&telefono=...`. Se exigen ambos datos para que nadie pueda ver pedidos ajenos con un solo dato de contacto; el endpoint devuelve hasta 50 pedidos, del más reciente al más antiguo, con su código de seguimiento.

### Actualizar una base de datos existente

Haz un respaldo de PostgreSQL y ejecuta una sola vez el script:

```text
DataBase/migrations/20261024_remove_global_admin_add_email_review.sql
DataBase/migrations/20261024_product_adiciones_por_producto.sql
```

Ejecuta cada migración pendiente una sola vez, en ese orden. La primera elimina las cuentas marcadas como administrador global, retira la columna `es_top_global` y añade los campos para almacenar los hashes de los enlaces de decisión. La segunda crea la relación entre cada producto y los ingredientes extra que ofrece. No borra restaurantes, pedidos, productos ni las cuentas de dueño y administrador de cocina.

Si vas a crear una base de datos completamente nueva, `DataBase/init.sql` ya incluye el esquema actualizado. No ejecutes `init.sql` sobre una base con datos que quieras conservar, porque es un script de inicialización que elimina y recrea tablas.

### Ingredientes extra por producto

Cada restaurante puede crear ingredientes extra con nombre y precio propios, reutilizarlos en varios productos y seleccionar cuáles se ofrecen en cada uno. En el menú público, el cliente abre los detalles del producto, marca sus extras y ve el precio actualizado antes de agregarlo al carrito. El backend vuelve a validar que cada extra pertenezca al restaurante y esté habilitado para ese producto; el precio final se calcula desde la base de datos.

Para bases existentes, aplica `DataBase/migrations/20261024_product_adiciones_por_producto.sql` antes de volver a levantar la aplicación. En bases nuevas, la tabla ya se crea desde `DataBase/init.sql`.

## Ejecutar las pruebas

Desde `P_upbFood/Backend`:

```powershell
./mvnw test
```

Para ejecutar solo las pruebas de las últimas historias: `./mvnw -Dtest="HistorialClienteTest,RevisionUniversidadControllerTest,TransicionesPedidoTest" test`.

Desde `P_upbFood/Frontend`:

```powershell
npm run build
```

## Detener el entorno

```powershell
docker compose down
```

Para borrar volumen de datos de PostgreSQL:

```powershell
docker compose down -v
```

Usa `docker compose down -v` únicamente si necesitas reinicializar la base de datos desde cero. El archivo `DataBase/init.sql` se ejecuta automáticamente solo cuando PostgreSQL se inicializa con un volumen nuevo.

## Variables y seguridad

- No subas `.env`; solo se debe versionar `.env.example`.
- `APP_JWT_SECRET` debe ser aleatorio y tener al menos 32 bytes.
- `APP_UPB_REVISOR_CLAVE` habilita el panel del encargado UPB; cámbiala por un valor propio y no la compartas fuera de la universidad.
- Usa `APP_AUTH_COOKIE_SECURE=true` únicamente cuando el backend esté detrás de HTTPS.
- Las variables de producción deben configurarse en el proveedor de despliegue, no en archivos del repositorio.

## Notas

- El backend usa variables de entorno para conexión a base de datos.
- El script `DataBase/init.sql` se ejecuta automáticamente en la primera inicialización del contenedor de PostgreSQL.
- Si el puerto `5173`, `8080` o `5432` está ocupado, libera el proceso correspondiente antes de iniciar Docker.
- Para revisar errores de un servicio, usa `docker compose logs backend`, `docker compose logs frontend` o `docker compose logs db`.

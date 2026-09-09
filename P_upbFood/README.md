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

### Credenciales de prueba

```text
Correo: admin@upb.edu.co
Contraseña: admin123

Correo: admin2@upb.edu.co
Contraseña: admin456
```

Estas credenciales son datos de desarrollo sembrados por `DataBase/init.sql`.

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

## Ejecutar las pruebas

Desde `P_upbFood/Backend`:

```powershell
./mvnw -Dtest=AdminAuthControllerTest test -q
```

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
- Usa `APP_AUTH_COOKIE_SECURE=true` únicamente cuando el backend esté detrás de HTTPS.
- Las variables de producción deben configurarse en el proveedor de despliegue, no en archivos del repositorio.

## Notas

- El backend usa variables de entorno para conexión a base de datos.
- El script `DataBase/init.sql` se ejecuta automáticamente en la primera inicialización del contenedor de PostgreSQL.
- Si el puerto `5173`, `8080` o `5432` está ocupado, libera el proceso correspondiente antes de iniciar Docker.
- Para revisar errores de un servicio, usa `docker compose logs backend`, `docker compose logs frontend` o `docker compose logs db`.

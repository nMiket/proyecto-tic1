# Autenticación y sesión

## Resumen

El login administrativo usa BCrypt para contraseñas, un JWT de acceso de corta duración y un refresh token persistido y revocable. El JWT se utiliza para autorizar las peticiones protegidas; el refresh token permite recuperar la sesión sin guardar el token sensible en `localStorage`.

## Flujo de sesión

1. El frontend envía correo y contraseña a `POST /api/admin/login`.
2. El backend busca el administrador y valida la contraseña con `PasswordEncoder` y BCrypt.
3. El backend devuelve un JWT de acceso y establece una cookie `HttpOnly` con el refresh token.
4. El frontend mantiene el JWT en memoria y lo envía como `Authorization: Bearer <token>`.
5. Cuando el JWT expira, el frontend llama a `POST /api/admin/refresh` con la cookie.
6. El backend revoca el refresh token usado, crea uno nuevo y devuelve otro JWT.
7. `POST /api/admin/logout` revoca el refresh token y elimina la cookie.

## Persistencia

La tabla `refresh_tokens` almacena únicamente el hash SHA-256 del refresh token:

- `admin_user_id`: usuario propietario.
- `token_hash`: valor irreversible utilizado para buscar el token.
- `created_at`: fecha de creación.
- `expires_at`: fecha de expiración.
- `revoked_at`: fecha de revocación, cuando aplica.

Las contraseñas se almacenan en `usuarios_admin.password_hash` como hashes BCrypt. Nunca se debe guardar la contraseña original ni el refresh token sin hash en la base de datos.

## Endpoints

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| `POST` | `/api/admin/login` | Público | Valida credenciales y crea sesión. |
| `POST` | `/api/admin/refresh` | Cookie de sesión | Rota el refresh token y renueva el JWT. |
| `POST` | `/api/admin/logout` | Público | Revoca la sesión actual. |
| `GET` | `/api/products` | Público | Consulta el catálogo. |
| `GET` | `/api/restaurantes` | Público | Consulta las cafeterías. |
| `POST`, `PUT`, `DELETE` | `/api/products/**` | JWT requerido | Administra productos. |

## Configuración

Configura las variables en `P_upbFood/.env`, usando [`P_upbFood/.env.example`](P_upbFood/.env.example) como plantilla:

```text
APP_JWT_SECRET=una-clave-secreta-de-al-menos-32-bytes
APP_JWT_ACCESS_TOKEN_MINUTES=15
APP_JWT_REFRESH_TOKEN_DAYS=7
APP_AUTH_COOKIE_SECURE=true
```

`APP_AUTH_COOKIE_SECURE=true` requiere HTTPS. Para desarrollo local con `http://localhost`, se mantiene en `false`.
El archivo `.env` está excluido de Git; solo se debe versionar `.env.example`.

## Archivos principales

- `Backend/src/main/java/com/upbfood/Backend/controller/AdminAuthController.java`
- `Backend/src/main/java/com/upbfood/Backend/security/JwtService.java`
- `Backend/src/main/java/com/upbfood/Backend/security/JwtAuthenticationFilter.java`
- `Backend/src/main/java/com/upbfood/Backend/config/SecurityConfig.java`
- `Backend/src/main/java/com/upbfood/Backend/entity/RefreshToken.java`
- `Backend/src/main/java/com/upbfood/Backend/repository/RefreshTokenRepository.java`
- `Frontend/src/auth.ts`
- `DataBase/init.sql`

## Credenciales de desarrollo

```text
Correo: admin@upb.edu.co
Contraseña: admin123

Correo: admin2@upb.edu.co
Contraseña: admin456
```

La contraseña anterior solo es la credencial de prueba; en la base de datos se guarda su hash BCrypt.

## Consideraciones operativas

- `init.sql` se ejecuta automáticamente cuando PostgreSQL se inicializa con un volumen nuevo.
- Para reinicializar la base en desarrollo: `docker compose down -v` y luego `docker compose up --build`.
- No se debe subir `APP_JWT_SECRET` real al repositorio.
- El access token no se persiste en `localStorage`; al recargar, la aplicación intenta recuperar la sesión mediante el refresh token.

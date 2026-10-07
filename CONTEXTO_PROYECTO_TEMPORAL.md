# Contexto temporal del proyecto UPB Food

> Documento temporal para entregar contexto técnico y funcional del proyecto hasta el 30 de septiembre de 2026. No reemplaza al README oficial ni al plan del proyecto.

## 1. Objetivo del proyecto

UPB Food es una plataforma web para que estudiantes, docentes y colaboradores de la Universidad Pontificia Bolivariana puedan:

- Consultar cafeterías y sus menús.
- Ver productos, precios, disponibilidad e imágenes.
- Armar un carrito de compra.
- Registrar sus datos como cliente.
- Confirmar un pedido y avanzar al pago.
- Permitir que el personal administrativo gestione productos y que cocina consulte pedidos.

El objetivo principal es reducir las filas y el tiempo de espera en las cafeterías mediante pedidos anticipados y personalizados.

## 2. Arquitectura

El repositorio es un monorepo dividido en tres servicios:

```text
proyecto-tic1/
├── P_upbFood/
│   ├── Frontend/       React + TypeScript + Vite
│   ├── Backend/        Spring Boot + Java + JPA + Security
│   ├── DataBase/       PostgreSQL, init.sql y datos semilla
│   └── docker-compose.yml
├── README.md
├── PLAN_PROYECTO.md
└── AUTENTICACION_Y_SESION.md
```

### Frontend

- React 19, TypeScript, Vite y React Router DOM.
- URL local con Docker: `http://localhost:5173`.
- El cliente HTTP está centralizado en `Frontend/src/auth.ts`.
- `CartProvider` mantiene el carrito en memoria.
- Las rutas públicas principales son `/`, `/pedido`, `/cliente`, `/pago` y `/historial`.
- La administración usa `/admin` y `/admin/dashboard`.

### Backend

- Spring Boot 4, Java 21, Maven.
- Spring Data JPA para persistencia.
- Spring Security y JWT para el panel administrativo.
- URL local con Docker: `http://localhost:8080`.
- Las respuestas de errores se centralizan en `GlobalExceptionHandler`.

### Base de datos

- PostgreSQL 16.
- Esquema normalizado en tres formas normales.
- `DataBase/init.sql` crea tablas, restricciones, funciones y datos semilla.
- Docker persiste los datos en el volumen `postgres_data`.
- `init.sql` solo se ejecuta automáticamente cuando se crea un volumen nuevo.

## 3. Servicios Docker

`docker-compose.yml` levanta:

| Servicio | Contenedor | Puerto | Función |
|---|---|---:|---|
| PostgreSQL | `upbfood-db` | `5432` | Base de datos |
| Backend | `upbfood-backend` | `8080` | API REST |
| Frontend | `upbfood-frontend` | `5173` | Aplicación web servida por Nginx |

Comandos principales:

```powershell
cd P_upbFood
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 backend
docker compose down
```

Para reinicializar completamente la base de datos de desarrollo, eliminando el volumen:

```powershell
docker compose down -v
docker compose up --build -d
```

Esto borra los datos locales de PostgreSQL y debe usarse solo cuando sea aceptable perderlos.

## 4. Modelo de datos principal

Las tablas más importantes son:

- `restaurantes`: cafeterías, ubicación, estado y tiempo estimado.
- `categorias`: categorías de productos.
- `productos`: nombre, descripción, precio, disponibilidad, imagen y restaurante.
- `clientes`: nombre, teléfono y correo institucional.
- `pedidos`: restaurante, cliente, estado, total y fecha de creación.
- `detalle_pedidos`: productos, cantidades y precio unitario del momento de la compra.
- `usuarios_admin`: usuarios administrativos asociados a una cafetería.
- `refresh_tokens`: sesiones administrativas persistidas mediante hashes.

Estados actuales de pedido:

```text
NUEVO -> EN_PAGO -> EN_PREPARACION -> ENTREGADO
```

El valor `EN_PAGO` fue agregado a la restricción de estados para soportar HU011. El estado inicial del pedido continúa siendo `NUEVO`, compatible con el dashboard de cocina.

## 5. Funcionalidades terminadas

### Catálogo y cafeterías

- Consulta de cafeterías.
- Selección de cafetería.
- Consulta de productos por `restauranteId`.
- Tarjetas de producto con nombre, precio, disponibilidad, descripción e imagen.
- Imágenes fallback cuando `imagenUrl` es nulo. Actualmente usan URLs externas de Unsplash.

### Carrito

- Agregar productos.
- Aumentar y disminuir cantidades.
- Eliminar productos.
- Vaciar carrito.
- Calcular cantidad total y total monetario.
- Agregar observaciones por producto.

### Administración

- Login administrativo.
- Contraseñas con BCrypt.
- JWT de acceso en memoria.
- Refresh token en cookie `HttpOnly`, persistido como hash y revocable.
- Crear, editar, eliminar y cambiar disponibilidad de productos.
- Autorización por cafetería: un administrador no debe operar sobre otra cafetería.

### HU009: confirmar pedido

Implementada en el flujo actual:

1. El usuario agrega productos al carrito.
2. El botón fijo `Confirmar pedido` permanece visible.
3. El botón está deshabilitado si el carrito está vacío.
4. Al pulsarlo, React navega a `/cliente`.
5. El formulario solicita nombre, teléfono y correo institucional.
6. El backend crea o reutiliza el cliente.
7. El backend valida cafetería, productos y disponibilidad.
8. El backend calcula el total usando los precios almacenados en la base de datos.
9. El backend guarda `pedidos` y `detalle_pedidos` dentro de una transacción.

Endpoint:

```http
POST /api/pedidos
```

Ejemplo de cuerpo:

```json
{
  "restauranteId": 1,
  "clienteCorreo": "estudiante@upb.edu.co",
  "clienteNombre": "Nombre del estudiante",
  "clienteTelefono": "3001234567",
  "items": [
    {
      "productoId": 1,
      "cantidad": 2,
      "observaciones": "Sin cebolla"
    }
  ]
}
```

### HU011: continuar al pago

Implementada hasta una pantalla interna de pago:

1. El botón `Continuar al pago` aparece en la identificación del cliente.
2. Permanece deshabilitado si el carrito está vacío.
3. También permanece deshabilitado si el nombre, teléfono o correo no cumplen validación.
4. El formulario vuelve a validar al enviarse y muestra errores.
5. Después de crear el pedido, React llama al endpoint de transición.
6. El pedido cambia de `NUEVO` a `EN_PAGO`.
7. React navega a `/pago` con el identificador y total del pedido.

Endpoint:

```http
PUT /api/pedidos/{id}/pago
```

La pantalla `/pago` es actualmente un portal interno simulado. Todavía no existe integración con una pasarela externa como Wompi, PayU, Mercado Pago o Stripe.

## 6. Endpoints relevantes

### Públicos

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/admin/login` | Iniciar sesión administrativa |
| `POST` | `/api/admin/refresh` | Renovar sesión mediante cookie |
| `POST` | `/api/admin/logout` | Cerrar y revocar sesión |
| `GET` | `/api/restaurantes` | Listar cafeterías |
| `GET` | `/api/products?restauranteId=1` | Listar productos |
| `GET` | `/api/productos?restauranteId=1` | Alias para listar productos |
| `POST` | `/api/clientes` | Crear cliente, legado de HU010 |
| `POST` | `/api/pedidos` | Crear pedido |
| `PUT` | `/api/pedidos/{id}/pago` | Pasar pedido a `EN_PAGO` |

### Protegidos

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/products` | Crear producto |
| `PUT` | `/api/products/{id}` | Actualizar producto |
| `DELETE` | `/api/products/{id}` | Eliminar producto |

Las operaciones administrativas requieren JWT y validan la cafetería del usuario autenticado.

## 7. Autenticación

Credenciales de desarrollo documentadas:

```text
admin@upb.edu.co / admin123
admin2@upb.edu.co / admin456
```

Configuración en `P_upbFood/.env`:

```text
APP_JWT_SECRET=una-clave-de-al-menos-32-bytes
APP_JWT_ACCESS_TOKEN_MINUTES=15
APP_JWT_REFRESH_TOKEN_DAYS=7
APP_AUTH_COOKIE_SECURE=false
```

El `.env` real no debe subirse al repositorio. Solo se versiona `.env.example`.

## 8. Estado actual verificado

En el estado actual de la máquina:

- Los tres contenedores Docker están levantados.
- `upbfood-db` aparece saludable.
- `GET /api/productos?restauranteId=1` responde `200`.
- El backend compila con Maven usando `-DskipTests`.
- El frontend compila con `npm run build`.
- La API de HU009 fue probada creando y guardando un pedido.
- La API de HU011 fue probada cambiando un pedido a `EN_PAGO`.
- Los datos usados exclusivamente para la prueba de HU011 fueron eliminados después.

## 9. Problemas y decisiones técnicas conocidas

### Esquema persistente de Docker

El volumen existente tenía una tabla `productos` antigua sin la columna `descripcion`. Se corrigió la base activa con una migración SQL no destructiva:

```sql
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS descripcion VARCHAR(255) NOT NULL DEFAULT '';
```

La definición correcta también está en `init.sql`. En un entorno nuevo, la tabla se crea completa desde el inicio.

### Imágenes externas

Los productos actuales pueden tener `imagenUrl` nulo. El frontend asigna una URL fallback por nombre o categoría. Si el entorno no tiene acceso a Unsplash, se deben reemplazar esas URLs por imágenes locales en `Frontend/public`.

### Pruebas backend

La compilación funciona. La suite completa de Maven ha mostrado anteriormente dos errores existentes en `ProductControllerTest` porque `ProductController` ejecuta `.trim()` sobre descripciones nulas:

- `createProductRequiresAuthorizationForRequestedRestaurant`
- `updateProductReturnsUpdatedProduct`

Esos errores no pertenecen directamente a HU009/HU011, pero deben corregirse antes de considerar la suite completamente verde.

### Documentación desactualizada

`PLAN_PROYECTO.md` todavía marca el resumen del pedido y la gestión de pedidos como pendientes. Este documento temporal refleja el estado más reciente y debe usarse para actualizar posteriormente el plan oficial.

## 10. Pendientes recomendados

1. Integrar una pasarela de pago real o definir claramente el simulador de pago.
2. Crear historial real de pedidos para el cliente.
3. Añadir endpoints de consulta y gestión de pedidos para cocina.
4. Actualizar `DashboardCocina` para contemplar el flujo completo de estados.
5. Agregar pruebas unitarias e integración para `OrderController`.
6. Corregir los dos errores de `ProductControllerTest`.
7. Validar accesibilidad y corregir avisos de ESLint.
8. Actualizar `PLAN_PROYECTO.md` y el README oficial.
9. Reemplazar imágenes externas por assets locales si el despliegue no tiene internet.

## 11. Ramas y trabajo integrado

La rama actual es `Andres-Martinez`. En ella se integraron los avances de:

- `origin/Julian`, incluyendo HU010 y navegación/productos.
- `origin/valeria`, incluyendo flujo de pedidos y cocina.

El commit más reciente registrado durante este contexto es:

```text
5308a6e hu009, hu0011 y union de avances julian y valeria
```

El README contiene una modificación local previa y debe tratarse con cuidado antes de hacer un commit adicional.

## 12. Comandos útiles

```powershell
# Estado del sistema
cd P_upbFood
docker compose ps

# Logs
docker compose logs --tail=100 backend
docker compose logs --tail=100 db

# Backend
cd Backend
.\mvnw.cmd -DskipTests compile
.\mvnw.cmd test

# Frontend
cd ..\Frontend
npm.cmd run build

# Probar catálogo
curl.exe http://localhost:8080/api/productos?restauranteId=1

# Detener servicios
cd ..
docker compose down
```

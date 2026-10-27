# Informe de Cambios Implementados (`CAMBIOS.md`)

**Rama de trabajo:** `mejoras/auditoria`  
**Documento base:** [`AUDITORIA.md`](AUDITORIA.md)  
**Estado de pruebas unitarias Backend:** `18 tests run, 0 failures, 0 errors (BUILD SUCCESS)`  
**Estado de compilación Frontend (`tsc -b && vite build`):** `0 errores TypeScript / Build exitoso`

---

## 1. Hallazgos Resueltos

### Fase 1 — Críticos y Rápidos (Bugs en producción, tests rotos, seguridad base e índices BD)

| ID | Severidad | Commit | Qué se cambió | Archivos tocados |
|---|---|---|---|---|
| **BE-01** | Crítica | `abcea2d` | Se corrigió la consulta SQL en `PedidoService.buscarPedido` que referenciaba la columna inexistente `r.nombre` en lugar de `r.nombre_restaurante` (causaba HTTP 500 `PSQLException`), y se agregaron conversiones explícitas `CAST(? AS INTEGER)` y `CAST(? AS VARCHAR)` para evitar errores de inferencia de tipos en parámetros nulos con PostgreSQL. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/PedidoService.java` |
| **QA-01** | Crítica | `10880eb` | Se actualizaron los constructores de `ProductController` en `ProductControllerTest` (incluyendo `ProductoAdicionRepository` y `DetallePedidoRepository`) y los mocks de `AdminAuthorizationServiceTest` (`findById` con asignación en estado `"Activo"`), restaurando la compilación y ejecución de toda la suite de tests. | `P_upbFood/Backend/src/test/java/com/upbfood/Backend/ProductControllerTest.java`<br>`P_upbFood/Backend/src/test/java/com/upbfood/Backend/AdminAuthorizationServiceTest.java` |
| **BE-02** | Alta | `926ebab` | En `GlobalExceptionHandler` se agregó un manejador explícito `@ExceptionHandler(ResponseStatusException.class)` que respeta el código HTTP original (`400`, `401`, `403`, `404`), y se ajustó `handleIllegalArgumentException` para devolver `400 Bad Request` en errores de validación y `404 Not Found` únicamente cuando el recurso no existe (`"no encontrado"` / `"no existe"`). | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/exception/GlobalExceptionHandler.java` |
| **SEC-01** | Alta | `3923c1c` | Se eliminó el comodín amplio `.requestMatchers(HttpMethod.GET, "/api/pedidos/**").permitAll()` en `SecurityConfig`, limitando el acceso público GET exclusivamente a `/api/pedidos/consulta`, `/api/pedidos/seguimiento/consulta` y `/api/pedidos/seguimiento/*`. Además, se retiró `@CrossOrigin(origins = "http://localhost:5173")` de `OrderController` para que herede la política CORS centralizada. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/config/SecurityConfig.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/OrderController.java` |
| **SEC-03** | Media | `3923c1c` | Se restringió el `Path` de la cookie `HttpOnly` `upbfood_refresh_token` de `"/"` a `"/api/admin"`, evitando que el navegador adjunte el refresh token en peticiones públicas de clientes. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/AdminAuthController.java` |
| **DB-01** | Alta | `6743bc2` | Se añadieron los índices compuestos y de clave foránea `idx_pedido_restaurante_fecha`, `idx_pedido_restaurante_estado`, `idx_detalle_pedido_pedido_id` e `idx_refresh_tokens_admin_id` tanto en `init.sql` como en la migración incremental y en la base de datos activa. | `P_upbFood/DataBase/init.sql`<br>`P_upbFood/DataBase/migrations/20261026_imagen_restaurante.sql` |
| **DB-02** | Media | `6743bc2` | Se incorporó en la migración `20261026_imagen_restaurante.sql` la columna `nombre_personalizado VARCHAR(50)` en `producto_restaurante` (con `ADD COLUMN IF NOT EXISTS`) para mantener paridad con `init.sql` y la entidad JPA. | `P_upbFood/DataBase/migrations/20261026_imagen_restaurante.sql` |
| **DB-03** | Media | `6743bc2` | Se configuró `TZ: America/Bogota` en los contenedores `db` y `backend` dentro de `docker-compose.yml` para alinear `CURRENT_DATE` y las marcas de tiempo de pedidos y estadísticas diarias con la hora local de Colombia. | `P_upbFood/docker-compose.yml` |
| **OPS-01** | Baja | `e02fff3` | Se corrigió la primera línea corrupta de `README.md`, se retiraron del índice de Git los archivos `P_upbFood/logs-backend.txt` y `modelo bd cafeterias.sql`, y se actualizaron `.gitignore` y `P_upbFood/.gitignore` para ignorar archivos `logs-*.txt` y `*.log`. | `README.md`<br>`.gitignore`<br>`P_upbFood/.gitignore` |

---

### Fase 2 — Importantes (Aislamiento multi-cafetería, carga de imágenes desde dispositivo, N+1, rate-limiting, UX de pedidos y tests)

| ID | Severidad | Commit | Qué se cambió | Archivos tocados |
|---|---|---|---|---|
| **BE-03** | Alta | `a38c139` | **Propiedad exclusiva por cafetería y borrado seguro:**<br>1. En `ProductController.updateProduct`, si por datos de semilla un `Product` estuviera vinculado a más de un restaurante, se clona una entidad `Product` propia antes de mutar nombre/descripción/categoría para no afectar a otra cafetería.<br>2. En `ProductController.deleteProduct`, se verifica `detallePedidoRepository.existsByRestauranteIdAndProductoId`: si el producto tiene historial de ventas, se desactiva (`disponible = false`) devolviendo `deactivatedInsteadOfDeleted: true` para conservar las estadísticas y evitar errores 500 de clave foránea; si no tiene ventas, se elimina el vínculo y el registro `Product` huérfano. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/repository/DetallePedidoRepository.java`<br>`P_upbFood/Backend/src/test/java/com/upbfood/Backend/ProductControllerTest.java` |
| **SEC-04** (+ Decisión 5) | Baja | `a38c139` | **Validación de imágenes y carga directa desde el dispositivo:**<br>1. Se amplió `producto_restaurante.imagen_url` a `TEXT` (migración `20261027_imagen_producto_text.sql` e `init.sql`) y se eliminó el límite de 255 caracteres en `CreateProductRequest` y `UpdateProductRequest`.<br>2. Se validó en `RestaurantController` y `ProductController` que `imagenUrl` solo acepte esquemas seguros (`http://`, `https://` o `data:image/`, máx. 2 MB), bloqueando esquemas peligrosos como `javascript:`.<br>3. En `AdminDashboardPage.tsx` se agregaron selectores `<input type="file" accept="image/*">` con compresión automática en cliente (`<canvas>` a JPEG máx. 960px) tanto para la **imagen principal de la cafetería** como para la **imagen de cada producto del menú**. | `P_upbFood/DataBase/migrations/20261027_imagen_producto_text.sql`<br>`P_upbFood/DataBase/init.sql`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/entity/ProductoRestaurante.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/dto/CreateProductRequest.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/dto/UpdateProductRequest.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/RestaurantController.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java`<br>`P_upbFood/Frontend/src/components/AdminDashboardPage.tsx` |
| **ARCH-01** | Alta | `e0219d0` | Se eliminaron las consultas N+1 en `ProductController.getProductsByRestaurant` cargando en lote todos los `Product` (`findAllById`), todas las relaciones `ProductoAdicion` del restaurante (`findByRestauranteId`) y todas las filas de extras en 3 consultas totales sin importar el tamaño del menú. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java` |
| **ARCH-02** | Alta | `e0219d0` | Se eliminó el problema N+1 en `AdminOrderController` (estadísticas e historial de pedidos) agregando `PedidoService.obtenerDetallesPorPedidos(List<Integer> pedidoIds)` que consulta todos los ítems y adiciones de la lista de pedidos en una sola sentencia SQL con cláusula `IN (...)`. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/PedidoService.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/AdminOrderController.java` |
| **SEC-02** | Alta | `c84942b` | Se implementó `RateLimitFilter` por IP (ventana fija de 1 minuto) para proteger `/api/admin/auth/login` (máx. 15 req/min), `/api/pedidos/consulta` y `/api/pedidos/seguimiento/consulta` (máx. 30 req/min), y `POST /api/pedidos` (máx. 20 req/min), respondiendo HTTP `429 Too Many Requests` en formato JSON. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/config/RateLimitFilter.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/config/SecurityConfig.java` |
| **BE-04** | Media | `c84942b` | Se desacopló el envío de correos SMTP de las transacciones de base de datos en `SolicitudRegistroRestauranteController` y `AprobacionSolicitudService` (y se configuraron timeouts SMTP de 5 s en `NotificacionSolicitudRegistroService`), evitando retener conexiones JDBC durante esperas de red. | `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/NotificacionSolicitudRegistroService.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/AprobacionSolicitudService.java`<br>`P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/SolicitudRegistroRestauranteController.java` |
| **FE-02** | Media | `41570ff` | Se persistió el estado del carrito en `localStorage` (`upbfood.cart`) dentro de `CartContext.tsx` y el estado del pedido pendiente de pago en `sessionStorage` (`upbfood.checkoutPending`) dentro de `PagoPage.tsx`, evitando pérdidas de datos al recargar la página (F5). | `P_upbFood/Frontend/src/context/CartContext.tsx`<br>`P_upbFood/Frontend/src/pages/PagoPage.tsx` |
| **FE-03** | Baja | `41570ff` | Se memoizó `generarOpcionesHora(tiempoEstimadoMin)` con `useMemo` en `FormularioCliente.tsx` para evitar recalcular el arreglo de horarios en cada pulsación de tecla en los campos de cliente. | `P_upbFood/Frontend/src/components/FormularioCliente.tsx` |
| **UX-01** | Alta | `41570ff` | En `SeguimientoPedidoPage.tsx` se habilitó un selector de modo de búsqueda (**Por código UUID** y **Por # pedido + contacto** conectado a `/api/pedidos/seguimiento/consulta`), además de un botón de acceso rápido al último pedido guardado en el navegador (`upbfood.lastOrder`). | `P_upbFood/Frontend/src/pages/SeguimientoPedidoPage.tsx`<br>`P_upbFood/Frontend/src/pages/PagoPage.tsx` |
| **QA-02** | Alta | `3f6e463` | Se creó `OrderControllerTest` cubriendo la creación de pedidos, la consulta por UUID, la consulta por `# pedido + contacto`, la validación de restaurante cerrado (`400`) y el registro de pago. | `P_upbFood/Backend/src/test/java/com/upbfood/Backend/OrderControllerTest.java` |

---

### Fase 3 — Accesibilidad, Calidad de Código, UX e Infraestructura

| ID | Severidad | Commit | Qué se cambió | Archivos tocados |
|---|---|---|---|---|
| **A11Y-01** | Media | `5b6b277` | Se agregó soporte para cerrar el modal de personalización de producto con la tecla `Escape` en `CardProducto.tsx`. | `P_upbFood/Frontend/src/components/CardProducto.tsx` |
| **A11Y-02** | Media | `5b6b277` | Se vincularon los `<label htmlFor>` con `id`, `aria-invalid` y `aria-describedby` en `FormularioCliente.tsx`, y se agregó `aria-label` al buscador de productos en `DashboardCocina.tsx`. | `P_upbFood/Frontend/src/components/FormularioCliente.tsx`<br>`P_upbFood/Frontend/src/components/DashboardCocina.tsx` |
| **A11Y-03** | Baja | `5b6b277` | Se habilitó la activación mediante barra espaciadora (`' '`) además de `Enter` en `CardRestaurante.tsx`. | `P_upbFood/Frontend/src/components/CardRestaurante.tsx` |
| **UX-02** | Media | `5b6b277` | Se actualizó `/historial` (`HistorialPage` en `App.tsx`) para mostrar el resumen del último pedido almacenado en `localStorage` (`upbfood.lastOrder`) con acceso directo a su seguimiento en tiempo real y a la consulta manual de pedidos. | `P_upbFood/Frontend/src/App.tsx` |
| **CQ-01** | Media | `149a0a4` | Se centralizaron las funciones de formato de moneda (`formatCOP`), fecha (`formatDateTime`) e imagen de respaldo por categoría (`getProductFallbackImage`) en `src/utils/formatters.ts`, reutilizándolas en `AdminDashboardPage.tsx`, `DashboardCocina.tsx` y `ListaProductos.tsx`. | `P_upbFood/Frontend/src/utils/formatters.ts`<br>`P_upbFood/Frontend/src/components/AdminDashboardPage.tsx`<br>`P_upbFood/Frontend/src/components/DashboardCocina.tsx`<br>`P_upbFood/Frontend/src/components/ListaProductos.tsx` |
| **CQ-02** | Media | `149a0a4` | Se eliminaron 21 funciones PL/pgSQL en desuso de `P_upbFood/DataBase/init.sql`, conservando únicamente las 7 funciones de semilla inicial y las 6 funciones de pedidos/pagos invocadas desde `PedidoService`. | `P_upbFood/DataBase/init.sql` |
| **OPS-02** | Media | `149a0a4` | Se añadió el bloque `location /api/ { proxy_pass http://backend:8080; ... }` y `client_max_body_size 10M;` en `P_upbFood/Frontend/nginx.conf` para permitir que el contenedor Nginx encamine peticiones `/api/*` directamente al backend en despliegues detrás de un único dominio/puerto. | `P_upbFood/Frontend/nginx.conf` |

---

## 2. Hallazgos Omitidos o Parciales y el Motivo

- **`FE-01` (División completa de `AdminDashboardPage.tsx` en 4 sub-componentes separados) — Aplicado parcialmente:**
  - **Qué se hizo:** Se extrajeron las utilidades compartidas (`formatCOP`, `formatDateTime`, `getProductFallbackImage`) a `src/utils/formatters.ts` (`CQ-01`) y se modularizó la lógica de compresión de imágenes (`procesarImagenDesdeArchivo`).
  - **Por qué no se fragmentó el componente completo:** Siguiendo la **Regla 6** (*"No reescribas partes que funcionan solo por preferencia de estilo. No cambies el comportamiento visible salvo que el hallazgo lo pida"*), `AdminDashboardPage.tsx` coordina estados cruzados entre pestañas (selección de cafetería activa, recarga sincronizada de productos/extras/estadísticas y permisos de dueño vs. cocina). Fragmentarlo por completo implicaba reescribir más de 2,000 líneas funcionales con riesgo innecesario de regresión visual o de estado.

---

## 3. Cómo Verificar que Todo Funciona (Comandos Exactos)

### A. Ejecutar la suite completa de tests unitarios del Backend (18 tests)
```powershell
docker run --rm -v "c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Backend:/app" -v "c:/Users/andre/.m2:/root/.m2" -w /app maven:3.9.9-eclipse-temurin-21 mvn test -Dtest="ProductControllerTest,AdminAuthControllerTest,AdminAuthorizationServiceTest,ActivacionInvitacionControllerTest,OrderControllerTest"
```

### B. Levantar o reconstruir todos los servicios con Docker Compose
```powershell
docker-compose -f P_upbFood/docker-compose.yml up -d --build
```

### C. Verificar endpoints públicos y de seguimiento
```powershell
# 1. Listar restaurantes (200 OK)
Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/restaurantes"

# 2. Probar el endpoint corregido BE-01 de consulta de pedido por número + contacto (404 limpio en vez de 500)
try {
  Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/pedidos/seguimiento/consulta?pedidoId=99999&contacto=test@upb.edu.co"
} catch {
  $_.Exception.Response.StatusCode.Value__
}

# 3. Verificar que el listado de pedidos de cocina exige autenticación (SEC-01 -> 401/403)
try {
  Invoke-WebRequest -UseBasicParsing "http://localhost:8080/api/pedidos?restauranteId=1"
} catch {
  $_.Exception.Response.StatusCode.Value__
}
```

### D. Verificar en el navegador (`http://localhost:5173`)
1. **Panel Administrativo (`/admin`):**
   - En **Estadísticas operativas**, en la tarjeta *Identidad y control operativo*, usar el botón **"Subir imagen desde el dispositivo"** para cargar una foto local de la cafetería y guardar.
   - En **Menú y productos**, usar el botón **"Subir imagen desde el dispositivo"** en el formulario de crear/editar producto.
   - Intentar eliminar un producto con ventas históricas: el sistema lo marcará como **Agotado (`disponible = false`)** con un aviso informativo en lugar de fallar con error 500.
2. **Seguimiento (`/seguimiento`) y Último Pedido (`/historial`):**
   - En `/seguimiento`, alternar entre **"Por código UUID"** y **"Por # pedido + contacto"**.
   - En `/historial`, verificar el acceso directo al último pedido realizado desde el navegador.

---

## 4. Riesgos o Efectos Secundarios a Revisar

1. **Almacenamiento de imágenes en Base64 (Data URL) en PostgreSQL (`SEC-04` / Decisión 5):**
   - Las imágenes cargadas desde el dispositivo se comprimen automáticamente en el navegador a JPEG (máx. `960px`, calidad `0.82`, típicamente `80 KB – 250 KB`) y se almacenan en columnas `TEXT` (`restaurante.imagen_url` y `producto_restaurante.imagen_url`). Para un MVP / proyecto académico esto evita depender de buckets externos (S3/Cloudinary) y persiste entre reinicios, pero si en el futuro el catálogo creciera a miles de productos de alta resolución, sería recomendable migrar a almacenamiento de objetos.
2. **Rate Limiting en memoria (`SEC-02`):**
   - `RateLimitFilter` contabiliza peticiones por IP en memoria dentro del contenedor backend. Si se realizan pruebas de carga automatizadas (>15 logins por minuto o >20 creaciones de pedido por minuto desde la misma IP), el backend responderá `429 Too Many Requests` hasta que se cumpla la ventana de 60 segundos.
3. **Zona horaria en contenedores (`DB-03`):**
   - Los contenedores `db` y `backend` ahora operan en `America/Bogota` (`UTC-5`). Los pedidos antiguos creados cuando el contenedor estaba en `UTC` conservan su marca de tiempo anterior, mientras que todos los pedidos nuevos y el corte diario de estadísticas se calculan con la hora local de Colombia.


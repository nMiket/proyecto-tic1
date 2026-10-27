# Informe de Auditoría Técnica Integral — UPB Food

## Contexto del Proyecto Auditado
- **Qué hace el programa:** Plataforma web universitaria para explorar cafeterías del campus UPB, armar pedidos con adiciones y observaciones, simular pagos con seguimiento en tiempo real, y gestionar menús, pedidos en cocina (Kanban), personal y métricas operativas por restaurante.
- **Stack:** Backend en Java 21 + Spring Boot 4.0.3 (Spring Security, Spring Data JPA, JdbcTemplate, JavaMail, JJWT 0.12.6); Frontend en React 19 + TypeScript 5.9 + Vite 8 + React Router 7; Base de datos PostgreSQL 16 (DDL + funciones PL/pgSQL); Despliegue en Docker Compose + Nginx.
- **Quién lo usa:** Estudiantes/comunidad universitaria (clientes sin cuenta), personal de cocina (`Administrador de cocina`, rol 2) y propietarios de cafeterías (`Dueño de restaurante`, rol 1).
- **Nivel del proyecto:** Proyecto académico / MVP funcional.

---

## 1. Resumen Ejecutivo y Calificación por Rol

**UPB Food** cuenta con una base de datos relacional bien restringida mediante llaves foráneas compuestas y un flujo funcional completo desde el catálogo hasta el tablero Kanban de cocina. Sin embargo, el sistema presenta **fallos críticos que impiden su paso a un entorno real**: existe un error SQL en producción que rompe la búsqueda alternativa de pedidos (`r.nombre` inexistente), el endpoint de confirmación de pago es público y carece de verificación criptográfica, los tests unitarios del backend están rotos por desincronización con el controlador de productos, y la arquitectura mezcla JPA con `JdbcTemplate` provocando severos problemas de rendimiento (`N+1` de hasta 81 consultas por petición). En el frontend, la lógica administrativa se concentró en un componente monolítico de 2.094 líneas sin persistencia de carrito ni pruebas automatizadas. Corregir los hallazgos de la Fase 1 es indispensable antes de cualquier demostración exigente o despliegue productivo.

### Calificación por Rol (1 a 10)

| Rol | Calificación | Justificación resumida |
| :--- | :---: | :--- |
| **Arquitecto de software** | **5.5 / 10** | Mezcla inconsistente de JPA, SQL crudo en controladores y funciones PL/pgSQL; controladores obesos sin capa de servicio uniforme. |
| **Ingeniero backend** | **5.0 / 10** | Bug SQL en tiempo de ejecución (`r.nombre`), mapeo erróneo de `IllegalArgumentException` a HTTP 404, y mutación cruzada de productos globales. |
| **Ingeniero frontend** | **5.5 / 10** | Componente monolítico de 2.094 líneas (`AdminDashboardPage.tsx`), pérdida de estado del carrito al recargar, y ausencia de caché/cancelación en polling. |
| **Diseñador UX/UI** | **7.0 / 10** | Identidad visual limpia y coherente con el campus, pero con fricciones: enlaces muertos (`/historial`), pérdida de flujo en `/pago` al refrescar y `window.confirm`. |
| **Accesibilidad (a11y)** | **5.5 / 10** | Modales sin *focus trap* ni cierre con `Escape`, inputs sin asociación `htmlFor`/`id`, y tarjetas interactivas que no responden a la tecla `Space`. |
| **Experto en seguridad** | **4.5 / 10** | Wildcard público en `/api/pedidos/**`, pago marcable sin autenticación, falta total de *rate limiting* (riesgo de spam SMTP y fuerza bruta). |
| **DBA** | **6.5 / 10** | Excelente integridad referencial compuesta y cálculo transaccional en `fn_pedido_crear`, pero faltan índices críticos en claves foráneas y filtros de fecha/estado. |
| **QA** | **3.5 / 10** | `ProductControllerTest` falla al compilar/ejecutar por cambios en firmas de negocio; 0% de pruebas en pedidos/pagos y 0% de pruebas en Frontend. |
| **DevOps** | **5.5 / 10** | Dockerización funcional, pero con migraciones huérfanas (incluyendo un archivo `.sql` vacío), artefactos de log versionados en Git y sin proxy `/api` en Nginx. |
| **Calidad de código** | **5.5 / 10** | Duplicación de helpers de formato/imágenes, rutas y funciones PL/pgSQL muertas, y mezcla de estilos inline con CSS modular. |
| **PROMEDIO GLOBAL** | **5.4 / 10** | **MVP académico funcional en su flujo principal, pero con deuda técnica y brechas de seguridad/calidad que requieren intervención inmediata.** |

---

## 2. Hallazgos Detallados por Rol

### 2.1. Arquitecto de Software

#### `ARCH-01` — Triple paradigma de acceso a datos sin frontera clara (JPA + JdbcTemplate en Controladores + PL/pgSQL)
- **Rol:** Arquitecto de software
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java:29-48` y `:346-357` (el controlador inyecta directamente `ProductRepository`, `ProductoRestauranteRepository` y `JdbcTemplate` al mismo tiempo).
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/PedidoService.java:53-60` (invoca `SELECT * FROM fn_pedido_crear(...)` vía `JdbcTemplate`, mientras otras operaciones del mismo servicio hacen `SELECT`/`UPDATE` directos sobre las tablas en `:111-118` y `:157-179`).
- **Por qué importa:** Dificulta el mantenimiento, rompe la atomicidad transaccional cuando se combinan repositorios JPA con llamadas `JdbcTemplate` sin `@Transactional` en métodos del controlador (`ProductController.createProduct` en `:112-151` y `updateProduct` en `:250-303`), y dispersa las reglas de negocio entre Java y PostgreSQL.
- **Recomendación concreta:** Extraer toda la lógica de `ProductController`, `RestaurantController` y `AdminManagementController` a servicios anotados con `@Transactional` (`ProductService`, `RestaurantService`, `AdminStaffService`), prohibiendo la inyección de `JdbcTemplate` o `*Repository` directamente en la capa `controller`.
- **Esfuerzo estimado:** M

#### `ARCH-02` — Problema severo de consultas `N+1` en listado de catálogo e historial de pedidos
- **Rol:** Arquitecto de software
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java:79-92` y `:345-357`: Por cada fila en `producto_restaurante`, ejecuta `productRepository.findById(...)` (N+1 #1) y dentro de `toResponse()` ejecuta `jdbcTemplate.queryForList(...)` sobre `producto_adicion` (N+1 #2). Para un menú de 30 productos se disparan **61 consultas SQL** por cada carga de página.
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/AdminOrderController.java:50-53` y `:99-111`: `listarHistorial` obtiene hasta 80 pedidos y dentro de `.map(this::mapearPedido)` invoca `pedidoService.obtenerDetalle(pedidoId)` (`SELECT * FROM fn_pedido_detalle(?)`) por cada pedido, ejecutando **81 consultas SQL** en cada refresco del panel.
- **Por qué importa:** Bajo concurrencia moderada (ej. hora de almuerzo en el campus con decenas de estudiantes abriendo menús y paneles haciendo polling cada 10–15 s), agotará el pool de conexiones de HikariCP.
- **Recomendación concreta:** En `ProductController`, obtener el menú completo y sus adiciones en una o dos consultas por lote (`WHERE pr.restaurante_id = ?` con `JOIN producto` y otra consulta `WHERE pa.restaurante_id = ?` agrupada en memoria por `producto_id`). En `PedidoService`, traer los detalles de todos los `pedido_id` listados mediante `WHERE dp.pedido_id = ANY(?)`.
- **Esfuerzo estimado:** M

---

### 2.2. Ingeniero Backend

#### `BE-01` — Error SQL en tiempo de ejecución al buscar pedidos por ID + contacto (`column r.nombre does not exist`)
- **Rol:** Ingeniero backend
- **Severidad:** Crítica
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/PedidoService.java:169`:
    ```sql
    SELECT p.pedido_id, p.codigo_seguimiento, p.estado, p.total, p.fecha, p.hora_recogida,
           p.nombre_cliente, r.nombre AS nombre_restaurante
    FROM pedido p
    JOIN restaurante r ON r.restaurante_id = p.restaurante_id
    ```
  - `P_upbFood/DataBase/init.sql:105-107`: La columna en la tabla `restaurante` se llama `nombre_restaurante`, **no** `nombre`.
- **Por qué importa:** Cualquier petición a `GET /api/pedidos/consulta` o `GET /api/pedidos/seguimiento/consulta` (`OrderController.java:107-151`) lanza un `BadSqlGrammarException` (`ERROR: column r.nombre does not exist`) y devuelve HTTP 500.
- **Recomendación concreta:** Cambiar `r.nombre AS nombre_restaurante` por `r.nombre_restaurante` en `PedidoService.java:169`.
- **Esfuerzo estimado:** S

#### `BE-02` — `GlobalExceptionHandler` convierte errores de validación (`IllegalArgumentException`) en HTTP `404 Not Found` y omite `ResponseStatusException`
- **Rol:** Ingeniero backend
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/exception/GlobalExceptionHandler.java:40-47` mapea todo `IllegalArgumentException` a `HttpStatus.NOT_FOUND (404)`.
  - Sin embargo, `PedidoService.java:81,102,125` y `ProductController.java:124,130,167,170,202` lanzan `IllegalArgumentException` para errores de validación de entrada (ej. `"El precio debe ser un número válido"`, `"La hora de recogida debe ser al menos dentro de 15 minutos"`), respondiendo `404 Not Found` en lugar de `400 Bad Request`.
  - Además, `ActivacionInvitacionController.java:49-61` tuvo que implementar un `@ExceptionHandler(ResponseStatusException.class)` local porque `GlobalExceptionHandler` no lo maneja y Spring redirige a `/error`, ruta que `SecurityConfig` bloquea con `401/403`.
- **Por qué importa:** Rompe la semántica HTTP para el cliente frontend (que interpreta `404` como recurso inexistente en `SeguimientoPedidoPage.tsx:86`) y oculta los códigos `400/409/410` lanzados con `ResponseStatusException` en otros controladores como `SolicitudRegistroRestauranteController`.
- **Recomendación concreta:**
  1. Agregar `@ExceptionHandler(ResponseStatusException.class)` en `GlobalExceptionHandler` respetando `ex.getStatusCode()`.
  2. Permitir `/error` en `SecurityConfig.java` o mapear `IllegalArgumentException` a `400 Bad Request` y crear una excepción dedicada `ResourceNotFoundException` para los `404`.
- **Esfuerzo estimado:** S

#### `BE-03` — Mutación colateral del catálogo global `producto` entre restaurantes y huérfanos al eliminar
- **Rol:** Ingeniero backend
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java:263-295`: `updateProduct` modifica directamente la entidad global `Product` (`product.setNombre(...)`, `product.setDescripcion(...)`, `product.setTipoProductoId(...)`).
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java:305-326`: `deleteProduct` borra únicamente la fila de `producto_restaurante` (`menuRepository.delete(menuItem)`), dejando el registro en `producto` huérfano, o fallando con `DataIntegrityViolationException` (HTTP 500) si el producto ya fue incluido en algún `detalle_pedido` histórico (`init.sql:251-252`).
- **Por qué importa:**
  1. Si un producto del catálogo global es compartido por más de un restaurante, el dueño del Restaurante A altera el nombre/descripción para el Restaurante B.
  2. Si un dueño intenta eliminar del menú un producto que ya tuvo al menos una venta histórica, la FK `detalle_pedido (restaurante_id, producto_id) REFERENCES producto_restaurante` aborta el `DELETE` con un error 500 no controlado.
- **Recomendación concreta:** Capturar `DataIntegrityViolationException` en `deleteProduct` (o verificar si existen filas en `detalle_pedido`) para desactivar el producto o retornar `409 Conflict` con un mensaje claro al usuario, y aislar los productos por restaurante o impedir la edición global si otro restaurante referencia el mismo `producto_id`.
- **Esfuerzo estimado:** S

#### `BE-04` — Envío de correos SMTP síncrono dentro del hilo HTTP y dentro de transacciones de BD
- **Rol:** Ingeniero backend
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/service/SolicitudRegistroRestauranteService.java:93-102` y `AprobacionSolicitudService.java:105-145`: `notificacionCorreoService.enviarCorreoRevisionSolicitud(...)` y `enviarInvitacionAdministrador(...)` se ejecutan de forma síncrona dentro de métodos `@Transactional`.
- **Por qué importa:** Mantener una transacción de PostgreSQL abierta mientras se negocia TLS/SMTP con un servidor externo (`smtp.gmail.com:587`) retiene conexiones de base de datos durante segundos y bloquea los hilos del servidor web.
- **Recomendación concreta:** Publicar un evento con `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` combinado con `@Async` para despachar los correos fuera de la transacción de base de datos.
- **Esfuerzo estimado:** M

---

### 2.3. Ingeniero Frontend

#### `FE-01` — Componente monolítico `AdminDashboardPage.tsx` de 2.094 líneas con más de 35 estados locales
- **Rol:** Ingeniero frontend
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/AdminDashboardPage.tsx:1-2094` (concentra estadísticas, historial de pedidos, CRUD de productos, CRUD de ingredientes extra, CRUD de personal de cocina, configuración de identidad/operación del restaurante y modales en un único archivo).
- **Por qué importa:** Cualquier pulsación de tecla en un input de búsqueda o formulario provoca el re-renderizado de todo el árbol del dashboard; además, hace inviable escribir pruebas unitarias o mantener el código en equipo.
- **Recomendación concreta:** Dividir `AdminDashboardPage.tsx` en 4 subcomponentes por pestaña (`AdminStatsTab.tsx`, `AdminOrderHistoryTab.tsx`, `AdminMenuCatalogTab.tsx`, `AdminKitchenStaffTab.tsx`) y un componente para el encabezado operativo (`AdminRestaurantHeader.tsx`).
- **Esfuerzo estimado:** M

#### `FE-02` — Pérdida total del carrito al recargar la página y de la sesión de pago al refrescar `/pago`
- **Rol:** Ingeniero frontend
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Frontend/src/context/CartContext.tsx:45`: `const [items, setItems] = useState<CartItem[]>([])` vive únicamente en memoria RAM sin sincronización con `sessionStorage` o `localStorage`.
  - `P_upbFood/Frontend/src/components/PagoPage.tsx:23-24` y `:93-105`: Lee `pedidoId`, `codigoSeguimiento` y `total` exclusivamente de `location.state`, ignorando el objeto `upbfood.lastOrder` que `FormularioCliente.tsx:126-131` sí guardó en `localStorage`.
- **Por qué importa:** Si un estudiante recarga accidentalmente el navegador en `/pedido` o `/cliente`, pierde todo su pedido armado; y si recarga en `/pago` (o abre la URL directamente), aparece `"Sin pedido pendiente"` aunque `upbfood.lastOrder` exista en `localStorage`.
- **Recomendación concreta:** Hidratar `CartContext` desde `localStorage` (`upbfood.cart`) y en `PagoPage.tsx` usar `localStorage.getItem("upbfood.lastOrder")` como fallback cuando `location.state` sea `null`.
- **Esfuerzo estimado:** S

#### `FE-03` — Recreación innecesaria de slots de horario en cada renderizado de `FormularioCliente`
- **Rol:** Ingeniero frontend
- **Severidad:** Baja
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/FormularioCliente.tsx:45`: `const opcionesHora = crearOpcionesHora(tiempoPreparacionMin);` se ejecuta en cada pulsación de tecla de `nombre`, `telefono` o `correo` sin `useMemo`. Si el reloj cruza un múltiplo de 15 minutos mientras el usuario escribe su correo, el `horaRecogida` previamente seleccionado deja de coincidir con los botones renderizados.
- **Por qué importa:** Causa inconsistencia visual en el botón de hora seleccionado (`aria-pressed`) durante el llenado del formulario.
- **Recomendación concreta:** Envolver `crearOpcionesHora(tiempoPreparacionMin)` en `useMemo(() => crearOpcionesHora(tiempoPreparacionMin), [tiempoPreparacionMin])`.
- **Esfuerzo estimado:** S

---

### 2.4. Diseñador UX/UI

#### `UX-01` — Desconexión entre la promesa del formulario de seguimiento y los campos realmente mostrados
- **Rol:** Diseñador UX/UI
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx:131` y `:139`: El texto dice *"Usa el código que recibiste al pagar o combina el número de pedido con tus datos de contacto"* y *"Puedes usar cualquiera de las dos formas de búsqueda"*, pero el formulario (`:142-155`) **solo tiene un campo** para el UUID (`Código de seguimiento`) y no ofrece acceso al último pedido guardado en `localStorage` (`upbfood.lastOrder`).
- **Por qué importa:** Un usuario que pierde o no copia su UUID de 36 caracteres no tiene cómo buscar su pedido a pesar de que la interfaz le promete una segunda forma de búsqueda.
- **Recomendación concreta:** Añadir un acceso directo al pedido reciente almacenado en `upbfood.lastOrder` o incorporar el modo alternativo de búsqueda por `# de pedido + correo/teléfono` (una vez corregido `BE-01`), o bien ajustar el copy para no prometer una funcionalidad ausente en la vista.
- **Esfuerzo estimado:** S

#### `UX-02` — Uso de `window.confirm` nativo al cancelar pedidos en cocina y ruta `/historial` incompleta
- **Rol:** Diseñador UX/UI
- **Severidad:** Baja
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/DashboardCocina.tsx:563`: `if (window.confirm(\`¿Cancelar el pedido #\${id}?\`))` bloquea el hilo principal del navegador y rompe la estética del sistema.
  - `P_upbFood/Frontend/src/App.tsx:243` y `:643-650`: La ruta `/historial` renderiza un componente estático vacío (`"Aquí aparecerán tus pedidos anteriores"`).
- **Por qué importa:** En pantallas táctiles de cocina, los diálogos nativos del navegador son difíciles de operar y detienen los temporizadores de polling; por su parte, `/historial` deja una página sin funcionalidad expuesta en el router.
- **Recomendación concreta:** Reemplazar `window.confirm` por una confirmación inline de dos pasos en `CardPedido` (igual al patrón ya usado para eliminar productos en `AdminDashboardPage`) y eliminar `/historial` o conectarla a los pedidos guardados en `localStorage`.
- **Esfuerzo estimado:** S

---

### 2.5. Accesibilidad (a11y)

#### `A11Y-01` — Modal de detalle de producto sin soporte de tecla `Escape`, sin *focus trap* y sin retorno de foco
- **Rol:** Accesibilidad
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/CardProducto.tsx:58-102`: El diálogo `<section className="product-detail-modal" role="dialog" aria-modal="true">` no escucha el evento `keydown` para `Escape`, no mueve el foco al abrirse ni atrapa la tabulación dentro del modal (el usuario sigue tabulando por detrás del `backdrop`).
  - Lo mismo ocurre en el modal de edición de extras en `AdminDashboardPage.tsx:2010-2088`.
- **Por qué importa:** Usuarios que navegan por teclado o con lectores de pantalla quedan atrapados o pierden su posición en la página al abrir los detalles de un producto.
- **Recomendación concreta:** Usar el elemento nativo `<dialog>` de HTML5 (que gestiona `Escape`, `aria-modal` y *focus trap* de forma nativa con `.showModal()`) o agregar un `useEffect` que escuche `Escape` y gestione el foco inicial/final.
- **Esfuerzo estimado:** S

#### `A11Y-02` — Campos de formulario sin asociación programática `<label htmlFor>` + `id` ni `aria-invalid`
- **Rol:** Accesibilidad
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/FormularioCliente.tsx:169-212`: Las etiquetas `<label>Nombre completo</label>`, `<label>Teléfono</label>` y `<label>Correo</label>` son elementos hermanos de los `<input>` sin atributo `htmlFor` ni `id`, y los mensajes `<span className="error">` no están vinculados mediante `aria-describedby`.
  - `P_upbFood/Frontend/src/components/DashboardCocina.tsx:434-439`: El `<input type="search" placeholder="Buscar producto...">` carece de `<label>` o `aria-label`.
- **Por qué importa:** Los lectores de pantalla (NVDA, VoiceOver) anuncian los campos de `FormularioCliente` únicamente por su `placeholder` (o como "cuadro de edición en blanco") y no leen los errores de validación al fallar el envío.
- **Recomendación concreta:** Envolver cada `<input>` dentro de su `<label>` (como ya se hace en `App.tsx:440-462`) o añadir pares `htmlFor`/`id`, `aria-invalid={Boolean(errores.campo)}` y `aria-describedby`.
- **Esfuerzo estimado:** S

#### `A11Y-03` — Tarjetas de restaurante con `role="button"` que ignoran la tecla `Space`
- **Rol:** Accesibilidad
- **Severidad:** Baja
- **Evidencia:**
  - `P_upbFood/Frontend/src/components/CardRestaurante.tsx:37-43`:
    ```tsx
    <article
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick && onClick()}
    >
    ```
- **Por qué importa:** En el estándar WAI-ARIA, todo elemento con `role="button"` debe activarse tanto con `Enter` como con la barra espaciadora (` ` / `Space`).
- **Recomendación concreta:** Soportar `(e.key === 'Enter' || e.key === ' ')` llamando a `e.preventDefault()` para evitar el scroll de la página, o usar un `<button type="button">` / `<Link to={...}>` real dentro de la tarjeta.
- **Esfuerzo estimado:** S

---

### 2.6. Experto en Seguridad

#### `SEC-01` — Endpoint de confirmación de pago sin autenticación ni verificación y wildcard público en `/api/pedidos/**`
- **Rol:** Experto en seguridad
- **Severidad:** Crítica
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/security/SecurityConfig.java:60-68`:
    ```java
    .requestMatchers(HttpMethod.PUT, "/api/pedidos/seguimiento/*/pago").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/pedidos/seguimiento/consulta", "/api/pedidos/**").permitAll()
    ```
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/OrderController.java:52-79`: Cualquier cliente que invoque `PUT /api/pedidos/seguimiento/{codigo}/pago` con el monto del pedido lo marca inmediatamente como `PAGADO` y lo inyecta en la cola de cocina del restaurante.
- **Por qué importa:**
  1. Aunque el pago sea académico/simulado, exponer `GET /api/pedidos/**` con comodín `**` deja abierta cualquier subruta futura bajo `/api/pedidos/` y expone PII parcial (`nombre_cliente`, historial de productos) a cualquiera que obtenga el código o consulte `/api/pedidos/consulta`.
  2. En `OrderController.java:21`, además, existe un `@CrossOrigin(origins = "http://localhost:5173")` fijo que contradice la política CORS dinámica configurada en `SecurityConfig.java:103-126`.
- **Recomendación concreta:**
  1. Restringir el matcher GET en `SecurityConfig.java` exclusivamente a `"/api/pedidos/seguimiento/*"` (sin `/**` general).
  2. Eliminar `@CrossOrigin(origins = "http://localhost:5173")` de `OrderController.java:21`.
  3. Documentar explícitamente o proteger el endpoint de simulación de pago con un flag de configuración (`app.payment.simulation-enabled=true`) para que nunca pueda habilitarse por accidente en un entorno real sin firma de pasarela (ej. Wompi/MercadoPago webhook).
- **Esfuerzo estimado:** S

#### `SEC-02` — Ausencia total de *Rate Limiting* en login, activación de invitaciones y solicitud de registro (riesgo de fuerza bruta y *Email Bombing*)
- **Rol:** Experto en seguridad
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/AdminAuthController.java:73-95` (`POST /api/admin/login`).
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/SolicitudRegistroRestauranteController.java:50-71` (`POST /api/solicitudes-registro`).
- **Por qué importa:**
  1. Un atacante puede ejecutar ataques de diccionario ilimitados contra `/api/admin/login`.
  2. Como `POST /api/solicitudes-registro` es público y dispara un correo SMTP en cada petición (`SolicitudRegistroRestauranteService.java:93`), un script automatizado puede insertar miles de solicitudes y agotar la cuota SMTP de Gmail o bloquear la cuenta de correo institucional en minutos.
- **Recomendación concreta:** Implementar un filtro de *rate limiting* por IP (usando Bucket4j o un `ConcurrentHashMap` con ventana deslizante en un `OncePerRequestFilter`) limitando `/api/admin/login` a 5 intentos/minuto y `/api/solicitudes-registro` a 3 envíos cada 15 minutos por IP.
- **Esfuerzo estimado:** M

#### `SEC-03` — Alcance excesivo (`Path=/`) en la cookie de `refresh_token` y acumulación infinita de tokens en BD
- **Rol:** Experto en seguridad
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/AdminAuthController.java:252-260`:
    ```java
    return ResponseCookie.from(REFRESH_COOKIE_NAME, value)
            .httpOnly(true)
            .secure(refreshCookieSecure)
            .sameSite("Lax")
            .path("/")
    ```
- **Por qué importa:** Configurar `.path("/")` hace que el navegador adjunte la cookie `upbfood_refresh_token` en **todas** las peticiones hacia el backend (incluyendo llamadas públicas a `/api/restaurantes` o `/api/productos` porque `apiFetch` en `auth.ts:96` usa `credentials: 'include'` siempre).
- **Recomendación concreta:** Cambiar `.path("/")` a `.path("/api/admin")` en `AdminAuthController.java:257`, de modo que el refresh token solo viaje en las rutas de autenticación (`/api/admin/refresh` y `/api/admin/logout`).
- **Esfuerzo estimado:** S

#### `SEC-04` — Validación ausente de esquemas URL en imágenes (`javascript:` / `data:` arbitrarios o SSRF cliente)
- **Rol:** Experto en seguridad
- **Severidad:** Baja
- **Evidencia:**
  - `P_upbFood/Backend/src/main/java/com/upbfood/Backend/controller/ProductController.java:140` y `RestaurantController.java:104`: Aceptan cualquier cadena de texto en `imagenUrl` sin validar que comience por `https://` o `http://` (o `data:image/` controlado).
- **Por qué importa:** Aunque React escapa `src` en `<img>` previniendo `javascript:` directo en la mayoría de navegadores modernos, almacenar cadenas arbitrarias sin límite en `restaurante.imagen_url` (`TEXT` sin límite de tamaño en `RestaurantController.java:104`) permite payloads de varios megabytes en cada `GET /api/restaurantes`.
- **Recomendación concreta:** Validar en backend que `imagenUrl` tenga una longitud máxima razonable (ej. `<= 2048` caracteres para URLs `http/https`) y esquema válido.
- **Esfuerzo estimado:** S

---

### 2.7. Administrador de Base de Datos (DBA)

#### `DB-01` — Ausencia de índices en columnas críticas de filtrado, ordenamiento y claves foráneas
- **Rol:** DBA
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/DataBase/init.sql:124-281`: Solo se declara **un** índice manual en todo el esquema (`idx_invitacion_expiracion` en la línea 189). PostgreSQL **no** crea índices automáticamente en las columnas de claves foráneas.
  - Consultas frecuentes sin índice que hacen *Sequential Scan*:
    1. `pedido (restaurante_id, estado, fecha)` — usada cada 10 s por cocina (`fn_pedido_obtener_activos` en `init.sql:826-830`) y cada 15 s por estadísticas (`PedidoService.java:234-280`).
    2. `detalle_pedido (pedido_id)` — la FK en `init.sql:248` es `(pedido_id, restaurante_id)` sin índice propio, por lo que `fn_pedido_detalle(p_pedido_id)` (`init.sql:814`) hace *Seq Scan* sobre toda la tabla `detalle_pedido`.
    3. `refresh_tokens (administrador_id)` y `solicitud_registro_restaurante (token_aprobacion_hash)` / `(token_rechazo_hash)` (`AprobacionSolicitudService.java:65-66`).
- **Por qué importa:** A medida que crezca el volumen histórico de pedidos y detalles, cada consulta del tablero de cocina y del panel administrativo degradará linealmente su tiempo de respuesta ($O(N)$).
- **Recomendación concreta:** Añadir en `init.sql` (y en una migración):
  ```sql
  CREATE INDEX IF NOT EXISTS idx_pedido_restaurante_fecha ON pedido (restaurante_id, fecha DESC);
  CREATE INDEX IF NOT EXISTS idx_pedido_restaurante_estado ON pedido (restaurante_id, estado);
  CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido_id ON detalle_pedido (pedido_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_id ON refresh_tokens (administrador_id);
  ```
- **Esfuerzo estimado:** S

#### `DB-02` — Uso de `TIMESTAMP` sin zona horaria (`TIMESTAMP WITHOUT TIME ZONE`) en todas las tablas
- **Rol:** DBA
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/DataBase/init.sql:128,138,139,140,159,160,164,176,177,178,231,232,280`: Todas las columnas temporales usan `TIMESTAMP` en vez de `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`).
  - Esto ya obligó a aplicar conversiones manuales `(fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')` en `PedidoService.java:232`.
- **Por qué importa:** Cuando el contenedor de PostgreSQL corre en `UTC` y el cliente envía `LocalDateTime` en hora de Colombia (`America/Bogota`, UTC-5), se mezclan marcas de tiempo en distintas zonas horarias en la misma tabla (`fecha` en UTC vs. `hora_recogida` en hora local en `pedido`).
- **Recomendación concreta:** Migrar las columnas temporales a `TIMESTAMPTZ` o configurar explícitamente `TZ: America/Bogota` tanto en el servicio `postgres` como en `backend` dentro de `docker-compose.yml`.
- **Esfuerzo estimado:** S

#### `DB-03` — Desincronización de migraciones y archivo de migración vacío (`0 bytes`)
- **Rol:** DBA / DevOps
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/DataBase/migrations/20261026_imagen_restaurante.sql`: El archivo está **completamente vacío (`0 bytes`)**.
  - `P_upbFood/docker-compose.yml:14`: Solo monta `./DataBase/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro`, sin gestor de migraciones (Flyway/Liquibase).
  - En la raíz del repositorio además existe un script legado `modelo bd cafeterias.sql` versionado en Git.
- **Por qué importa:** Cualquier desarrollador que aplique las migraciones de `P_upbFood/DataBase/migrations/` sobre una base existente no recibirá la columna `imagen_url` de `restaurante` porque `20261026_imagen_restaurante.sql` está vacío.
- **Recomendación concreta:** Escribir `ALTER TABLE restaurante ADD COLUMN IF NOT EXISTS imagen_url TEXT;` en `20261026_imagen_restaurante.sql`, eliminar el archivo duplicado `modelo bd cafeterias.sql` de la raíz, e integrar Flyway en Spring Boot.
- **Esfuerzo estimado:** S

---

### 2.8. Aseguramiento de Calidad (QA)

#### `QA-01` — Suite de pruebas unitarias del Backend rota (`ProductControllerTest` desactualizado respecto a `ProductController`)
- **Rol:** QA
- **Severidad:** Crítica
- **Evidencia:**
  - `P_upbFood/Backend/src/test/java/com/upbfood/Backend/ProductControllerTest.java:107` y `:163`: Verifica `verify(authorizationService).requireAdminForRestaurant(1);`, pero `ProductController.java:118` y `:257` fueron cambiados para invocar `authorizationService.requireOwnerForRestaurant(...)`.
  - `P_upbFood/Backend/src/test/java/com/upbfood/Backend/ProductControllerTest.java:167-198` (`deleteProductDeactivatesProductInRestaurantMenu`): Espera que `deleteProduct` ponga `disponible = false`, llame a `menuRepository.save(menuItem)` y devuelva `"Producto desactivado en el menú correctamente."`, pero `ProductController.java:319-325` ahora llama a `menuRepository.delete(menuItem)` y devuelve `"Producto eliminado del menú correctamente."`.
  - `ProductControllerTest.java:39`: Pasa un `mock(JdbcTemplate.class)` sin configurar `queryForList`, y el método `listProducts` fue renombrado/dividido en `getProductsByRestaurant` y `listAdminProducts`.
- **Por qué importa:** La suite de pruebas del backend **no pasa ni compila limpiamente**, lo que significa que los cambios recientes se hicieron sin ejecutar `mvnw test`, dejando un riesgo alto de regresiones silenciosas.
- **Recomendación concreta:** Actualizar `ProductControllerTest.java` para reflejar `getProductsByRestaurant`, `requireOwnerForRestaurant` y el borrado de `menuRepository.delete(menuItem)`, y agregar un paso de CI (GitHub Actions) que ejecute `./mvnw test` en cada commit.
- **Esfuerzo estimado:** S

#### `QA-02` — Cobertura nula (0%) en flujos críticos de Pedidos, Pagos, Solicitudes y en todo el Frontend
- **Rol:** QA
- **Severidad:** Alta
- **Evidencia:**
  - `P_upbFood/Backend/src/test/java/com/upbfood/Backend/`: Solo existen 5 archivos de test (`ActivacionInvitacionControllerTest`, `AdminAuthControllerTest`, `AdminAuthorizationServiceTest`, `BackendApplicationTests`, `ProductControllerTest`). No existe **ningún** test para `PedidoService`, `OrderController`, `AdminOrderController`, `RestaurantController` ni `AprobacionSolicitudService` (por eso el bug SQL `BE-01` pasó desapercibido).
  - `P_upbFood/Frontend/package.json:6-11`: No existe script `"test"` ni dependencia de Vitest/Testing Library.
- **Por qué importa:** El flujo central de negocio (creación de pedidos, cálculo de totales con adiciones, cambios de estado en cocina y estadísticas) carece por completo de red de seguridad automatizada.
- **Recomendación concreta:** Añadir pruebas unitarias para `PedidoService` y `OrderController`, e instalar `vitest` + `@testing-library/react` en `P_upbFood/Frontend` para probar al menos `CartContext` y `FormularioCliente`.
- **Esfuerzo estimado:** M

---

### 2.9. DevOps

#### `OPS-01` — Archivos basura y logs de ejecución versionados en el repositorio Git y error tipográfico en `README.md`
- **Rol:** DevOps
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/logs-backend.txt` y `modelo bd cafeterias.sql` están rastreados en el árbol de Git.
  - `README.md:1`: Empieza con un texto accidental `bu# UPB Food — Plataforma de Gestión de Pedidos Universitarios`.
  - `README.md:155`: Documenta `mvnw.cmd spring-boot:run`, pero en la carpeta local no están instaladas las dependencias de Node (`node_modules`) ni se documenta cómo correr los tests.
- **Por qué importa:** Versionar archivos de log (`logs-backend.txt`) ensucia el historial de commits y puede filtrar tokens o trazas internas accidentally; el typo en la línea 1 del `README.md` rompe el encabezado principal del repositorio en GitHub.
- **Recomendación concreta:** Ejecutar `git rm --cached P_upbFood/logs-backend.txt "modelo bd cafeterias.sql"`, agregarlos a `.gitignore` (`*.log`, `logs-*.txt`), y corregir la línea 1 de `README.md`.
- **Esfuerzo estimado:** S

#### `OPS-02` — Acoplamiento a `http://localhost:8080` en tiempo de compilación del contenedor Frontend y falta de reverse proxy en Nginx
- **Rol:** DevOps
- **Severidad:** Media
- **Evidencia:**
  - `P_upbFood/Frontend/Dockerfile:6-7`: Inyecta `ARG VITE_API_URL=http://localhost:8080` en el bundle estático durante `npm run build`.
  - `P_upbFood/Frontend/nginx.conf:1-16`: Solo sirve archivos estáticos (`try_files $uri $uri/ /index.html;`) sin bloque `location /api/` que haga `proxy_pass http://backend:8080`.
- **Por qué importa:** Si se despliega el contenedor en cualquier servidor o se accede desde otro dispositivo en la red local (ej. celular de prueba en el campus), el navegador intentará conectarse al `localhost:8080` del dispositivo cliente y fallará por red/CORS.
- **Recomendación concreta:** Agregar en `P_upbFood/Frontend/nginx.conf` un bloque `location /api/ { proxy_pass http://backend:8080; }` y usar rutas relativas (`VITE_API_URL=""`) por defecto en producción.
- **Esfuerzo estimado:** S

---

### 2.10. Calidad de Código

#### `CQ-01` — Duplicación de heurísticas de imágenes por palabras clave y formateadores de moneda en múltiples componentes
- **Rol:** Calidad de código
- **Severidad:** Media
- **Evidencia:**
  - Heurística `getImagenPorCategoria` / `imagenFallback` triplicada en:
    1. `P_upbFood/Frontend/src/components/AdminDashboardPage.tsx:129-165`
    2. `P_upbFood/Frontend/src/components/DashboardCocina.tsx:35-52`
    3. `P_upbFood/Frontend/src/components/ListaProductos.tsx:12-24`
  - Formateo de pesos colombianos triplicado (`formatMoney` en `AdminDashboardPage.tsx:99`, `formatearCOP` en `CardProducto.tsx:10`, `precioCOP` en `ResumenPedido.tsx:25`).
  - Tipos `Restaurante`, `Producto` y `Pedido` redeclarados localmente en `RestaurantMenuPage.tsx:9`, `DashboardCocina.tsx:6-21` y `AdminDashboardPage.tsx:19-39` en lugar de importar desde `src/types/`.
- **Por qué importa:** Cualquier cambio en las imágenes por defecto, categorías o campos de los DTOs obliga a editar 3 o 4 archivos distintos, generando inconsistencias visuales entre lo que ve el cliente y lo que ve cocina.
- **Recomendación concreta:** Centralizar `formatCOP()`, `formatDateTime()` y `getProductFallbackImage()` en `P_upbFood/Frontend/src/utils/formatters.ts` y unificar las interfaces en `P_upbFood/Frontend/src/types/`.
- **Esfuerzo estimado:** S

#### `CQ-02` — Código muerto: 20+ funciones PL/pgSQL en `init.sql` que el Backend jamás invoca
- **Rol:** Calidad de código
- **Severidad:** Baja
- **Evidencia:**
  - `P_upbFood/DataBase/init.sql:307-641`: Funciones como `fn_restaurante_obtener_todos`, `fn_restaurante_actualizar`, `fn_restaurante_eliminar`, `fn_producto_obtener_todos`, `fn_producto_actualizar`, `fn_menu_obtener_por_restaurante`, `fn_administrador_login`, `fn_refresh_token_crear`, `fn_refresh_token_validar`, `fn_refresh_token_revocar` fueron reemplazadas por repositorios JPA en el backend, pero siguen declaradas en `init.sql` con firmas desactualizadas (por ejemplo, `fn_restaurante_obtener_todos` en `:307` ni siquiera incluye `imagen_url`, y `fn_menu_obtener_por_restaurante` en `:475` no incluye `nombre_personalizado`).
- **Por qué importa:** Confunde a los desarrolladores sobre cuál es la fuente de verdad de la lógica de negocio (si las funciones PL/pgSQL o las entidades JPA).
- **Recomendación concreta:** Conservar en `init.sql` únicamente las funciones realmente usadas por el backend o por el script de semilla inicial (`fn_pedido_crear`, `fn_pedido_obtener_por_codigo`, `fn_pedido_detalle`, `fn_pedido_obtener_activos`, `fn_pedido_cambiar_estado`, `fn_pago_registrar` y las de seed) y eliminar las funciones CRUD huérfanas.
- **Esfuerzo estimado:** S

---

### 2.11. Lo que está BIEN hecho (Preservar al mejorar)

1. **Integridad referencial compuesta en Base de Datos (`P_upbFood/DataBase/init.sql:207-270`):** Las llaves foráneas compuestas en `producto_adicion`, `detalle_pedido` y `detalle_pedido_adicion` garantizan a nivel de motor PostgreSQL que un pedido jamás pueda incluir productos o adiciones que no pertenezcan al mismo restaurante del pedido.
2. **Cálculo de precios del lado del servidor e historial inmutable (`init.sql:687-773`):** `fn_pedido_crear` ignora cualquier precio enviado por el cliente, calcula el total leyendo `producto_restaurante.precio` en el servidor y congela `precio_unitario` y `precio_adicion` en las tablas de detalle para que cambios futuros de precios no alteren pedidos históricos.
3. **Almacenamiento de tokens mediante hashes SHA-256 (`AdminAuthController.java:263-279`, `AprobacionSolicitudService.java:242-254`):** Ningún *refresh token*, token de invitación ni token de aprobación por correo se almacena en texto plano en la base de datos; todos se guardan como hashes SHA-256 y el *access token* en el frontend reside en memoria RAM (`auth.ts:22`) y no en `localStorage`.
4. **Separación de tokens de aprobación y rechazo de un solo uso (`init.sql:162-164`, `RevisarSolicitudPage.tsx:28-65`):** La validación previa por `GET` no consume el token (evitando que los escáneres de enlaces de clientes de correo aprueben o rechacen solicitudes automáticamente), y la confirmación real exige `POST`.
5. **Autorización granular por restaurante y rol (`AdminAuthorizationService.java:36-119`):** La separación entre `requireOwnerForRestaurant` (rol 1) y `requireOwnerOrKitchenForRestaurant` (roles 1 y 2) verificando además que la asignación esté en estado `'Activo'` es clara y segura.

---

## 3. Top 10 de Mejoras Priorizadas (Impacto vs. Esfuerzo)

| Prioridad | ID | Mejora | Impacto | Esfuerzo |
| :---: | :--- | :--- | :---: | :---: |
| **1** | `BE-01` | Corregir `r.nombre` por `r.nombre_restaurante` en `PedidoService.java:169` para reparar el error 500 en consulta de pedidos. | Crítico | **S** |
| **2** | `QA-01` | Reparar `ProductControllerTest.java` para que coincida con las firmas actuales de `ProductController` y todos los tests pasen. | Crítico | **S** |
| **3** | `BE-02` | Corregir `GlobalExceptionHandler.java` para devolver `400 Bad Request` en validaciones y soportar `ResponseStatusException`. | Alto | **S** |
| **4** | `SEC-01` | Cerrar el comodín público `GET /api/pedidos/**` a `/api/pedidos/seguimiento/*` y eliminar `@CrossOrigin` fijo en `OrderController.java`. | Crítico | **S** |
| **5** | `DB-01` | Crear los 4 índices faltantes en `pedido`, `detalle_pedido` y `refresh_tokens` + poblar `20261026_imagen_restaurante.sql` (`DB-03`). | Alto | **S** |
| **6** | `BE-03` | Manejar `DataIntegrityViolationException` al eliminar productos con ventas históricas y evitar mutación cruzada del catálogo global. | Alto | **S** |
| **7** | `FE-02` | Persistir el carrito en `localStorage` y usar `upbfood.lastOrder` como respaldo en `PagoPage.tsx` y `SeguimientoPedidoPage.tsx` (`UX-01`). | Alto | **S** |
| **8** | `ARCH-02` | Eliminar las consultas `N+1` en `ProductController` (menú + extras) y `AdminOrderController` (historial de pedidos). | Alto | **M** |
| **9** | `SEC-02` | Añadir *rate limiting* por IP en `/api/admin/login` y `/api/solicitudes-registro` + restringir cookie de refresh a `/api/admin` (`SEC-03`). | Alto | **M** |
| **10** | `FE-01` | Refactorizar `AdminDashboardPage.tsx` (2.094 líneas) en subcomponentes por pestaña y corregir accesibilidad de modales/formularios (`A11Y-01`, `A11Y-02`). | Medio | **M** |

---

## 4. Plan de Implementación Sugerido en Fases

### Fase 1: Críticos y Rápidos (*Quick Wins* — 1 a 2 días)
Objetivo: Eliminar errores 500 en tiempo de ejecución, reparar la suite de pruebas y cerrar brechas de seguridad/base de datos de bajo esfuerzo.
1. **`BE-01`:** Cambiar `r.nombre AS nombre_restaurante` a `r.nombre_restaurante` en `PedidoService.java:169`.
2. **`QA-01`:** Actualizar `ProductControllerTest.java` a las firmas vigentes y verificar ejecución limpia de `./mvnw test`.
3. **`BE-02`:** Ajustar `GlobalExceptionHandler.java` (soportar `ResponseStatusException`, separar `400` de `404`).
4. **`SEC-01` y `SEC-03`:** Ajustar matchers en `SecurityConfig.java`, quitar `@CrossOrigin` de `OrderController.java` y restringir el `path` de la cookie `upbfood_refresh_token` a `/api/admin`.
5. **`DB-01`, `DB-02` y `DB-03`:** Rellenar la migración vacía `20261026_imagen_restaurante.sql`, añadir índices de rendimiento en `init.sql` y fijar `TZ: America/Bogota` en `docker-compose.yml`.
6. **`OPS-01`:** Limpiar `README.md:1` y retirar `P_upbFood/logs-backend.txt` y `modelo bd cafeterias.sql` del control de versiones.

### Fase 2: Estructurales e Importantes (3 a 5 días)
Objetivo: Resolver cuellos de botella de rendimiento (`N+1`), proteger endpoints públicos contra abuso, asegurar experiencia de usuario resiliente y ampliar cobertura de pruebas.
1. **`ARCH-01` y `ARCH-02`:** Extraer `ProductService` con `@Transactional` y resolver los `N+1` de catálogo de productos e historial de pedidos mediante consultas por lote.
2. **`BE-03`:** Proteger `deleteProduct` frente a productos con pedidos históricos (devolviendo `409` o desactivando el ítem) y aislar la edición de `Product` por restaurante.
3. **`SEC-02` y `BE-04`:** Incorporar *rate limiting* en login/solicitudes de registro y mover el envío de correos SMTP a eventos asíncronos post-commit (`@TransactionalEventListener` + `@Async`).
4. **`FE-02`, `FE-03` y `UX-01`:** Persistir `CartContext` en `localStorage`, recuperar `upbfood.lastOrder` en `PagoPage.tsx` y `SeguimientoPedidoPage.tsx`, y memoizar `opcionesHora`.
5. **`QA-02`:** Añadir tests unitarios para `PedidoService` / `OrderController` y configurar Vitest en el Frontend.

### Fase 3: Mejoras Opcionales y Pulido de Calidad (3 a 5 días)
Objetivo: Mejorar mantenibilidad a largo plazo, accesibilidad completa y portabilidad del despliegue.
1. **`FE-01` y `CQ-01`:** Modularizar `AdminDashboardPage.tsx` en componentes por pestaña y centralizar utilidades de formato/imágenes/tipos en `src/utils/` y `src/types/`.
2. **`A11Y-01`, `A11Y-02`, `A11Y-03` y `UX-02`:** Migrar modales a `<dialog>` (o añadir *focus trap* + tecla `Escape`), vincular `<label htmlFor>` en `FormularioCliente.tsx`, habilitar tecla `Space` en `CardRestaurante.tsx` y reemplazar `window.confirm` en `DashboardCocina.tsx`.
3. **`OPS-02` y `CQ-02`:** Configurar proxy reverso `/api/` en `nginx.conf`, integrar Flyway para migraciones automáticas y depurar las funciones PL/pgSQL no utilizadas en `init.sql`.

---

## 5. Preguntas o Supuestos que Necesitan tu Decisión

1. **Catálogo de productos compartido vs. independiente por restaurante (`BE-03`):**
   - *Contexto:* La base de datos modela `producto` como catálogo global y `producto_restaurante` como tabla intermedia, pero la UI administrativa crea un `producto` nuevo por cada plato y al editarlo muta la tabla global `producto`.
   - *Decisión requerida:* ¿Cada cafetería debe ser dueña exclusiva de sus productos (1 a 1), o deseas mantener un catálogo maestro compartido donde cada restaurante pueda personalizar nombre y descripción en `producto_restaurante` (como ya se hizo parcialmente con `nombre_personalizado` para los extras)?
2. **Comportamiento al eliminar un producto que ya tiene pedidos históricos (`BE-03`):**
   - *Contexto:* Actualmente `DELETE /api/productos/{id}` intenta borrar la fila de `producto_restaurante`, lo cual falla en PostgreSQL si el plato aparece en algún `detalle_pedido` antiguo.
   - *Decisión requerida:* Cuando un producto ya tenga historial de ventas, ¿prefieres que el botón "Eliminar" realice un **borrado lógico** (`activo = false` / `oculto_del_catalogo = true` en `producto_restaurante`) para no perder las estadísticas históricas de productos más vendidos, o que bloquee el borrado pidiendo marcarlo como "No disponible"?
3. **Búsqueda alternativa de pedidos en `/seguimiento` (`UX-01` / `SEC-01`):**
   - *Contexto:* El backend tiene el endpoint `GET /api/pedidos/consulta?pedidoId=...&contacto=...` (actualmente roto por `BE-01`), y el texto de `SeguimientoPedidoPage.tsx` menciona esa segunda forma de búsqueda, pero el formulario en pantalla solo pide el UUID.
   - *Decisión requerida:* ¿Quieres que habilitemos en la UI de `/seguimiento` las dos pestañas de búsqueda (**Por código UUID** y **Por # de pedido + correo/teléfono**), o prefieres dejar únicamente la búsqueda por UUID por privacidad y ajustar los textos de la página?
4. **Ruta `/historial` en el cliente (`UX-02`):**
   - *Contexto:* En `App.tsx:243` existe la ruta `/historial` con un texto placeholder sin lógica.
   - *Decisión requerida:* ¿Eliminamos la ruta `/historial`, o deseas que muestre los últimos pedidos realizados desde ese navegador guardando una lista en `localStorage`?


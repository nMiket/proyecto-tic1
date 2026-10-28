# Plan General de UPB Food

## Objetivo

UPB Food es una plataforma web para consultar cafeterías, explorar sus productos y gestionar pedidos dentro de la Universidad Pontificia Bolivariana. El objetivo es reducir filas y tiempos de espera mediante un catálogo digital, checkout en tres pasos y paneles especializados para cocina y administración.

## Alcance Actual y Estado del Repositorio (Sprint 1 a 4 Extendido)

| Área | Historia / Módulo | Estado | Resultado |
|---|---|---|---|
| Infraestructura | Docker Compose | **Completado** | PostgreSQL 16, backend Spring Boot y frontend React contenerizados y orquestados. |
| Modelo de datos | Tablas y Funciones 3FN | **Completado** | Scripts `init.sql`, tablas relacionales y funciones plpgsql para restaurantes, productos, pedidos y clientes. |
| Catálogo y Restaurantes | HU001, HU002, HU003 | **Completado** | Lista responsive, CardRestaurante (estados y tiempos), buscador y barra de navegación dinámica. |
| Productos y Carrito | HU004, HU005, HU006, HU007, HU008 | **Completado** | Catálogo con fotos automáticas, selector de adiciones con precio, CartContext de una sola cafetería, cantidades, observaciones y edición de ingredientes extra desde la revisión del pedido. |
| Autenticación | HU012, HU013, HU023 | **Completado** | Login con BCrypt, emisión de tokens JWT, Refresh Tokens revocables en cookie HttpOnly y cierre de sesión. |
| Pedidos y Cocina | HU009, HU010, HU011, HU014, HU015 | **Completado** | POST `/api/pedidos`, checkout en frontend y Dashboard de Cocina (`/admin/cocina`) con tablero de 3 columnas, refresco cada 10 s y tarjetas que solo permiten iniciar pedidos con pago confirmado (misma regla que la máquina de estados del backend). |
| Administración | HU016, HU017, HU018, HU019, HU026 | **Completado** | Panel administrativo, filtro por categoría, alta de productos con fotos/tamaños, edición y aislamiento por cafetería. |
| Seguridad y Roles | HU024, HU025 | **Completado** | Control de acceso por rol (Dueño, Cocina y Encargado UPB), autorización por cafetería, páginas 403/404 en el frontend y gestión de personal operativo. |
| Trazabilidad y Pagos | HU020, HU021, HU022 | **Completado** | Código de seguimiento UUID, consulta por número + teléfono/correo y portal de pago (Stripe sandbox y pago simulado validando el monto exacto). |
| Métricas e Historial | HU027, HU028, HU029 | **Completado** | Historial del cliente en `/historial` (pedidos del dispositivo y búsqueda por correo + teléfono con `GET /api/pedidos/historial`), métricas reales del día y del mes con acciones rápidas conectadas, y cambio de estado/tiempo de la cafetería. |
| Registro y Aprobación | HU030, HU031 | **Completado** | Solicitud pública de registro de cafetería (`POST /api/solicitudes-registro`), revisión por enlace de correo y panel del encargado UPB en `/upb/solicitudes` (`/api/upb/solicitudes`) para aprobar o rechazar. |

## Resumen del Cumplimiento de Sprints

* **Sprint 1 (16 PH):** Finalizado (100%) — HU001, HU002, HU003, HU012, HU013.
* **Sprint 2 (19 PH):** Finalizado (100%) — HU004, HU005, HU006, HU007, HU008.
* **Sprint 3 (19 PH):** Finalizado (100%) — HU009, HU010, HU011, HU014, HU015.
* **Sprint 4 (18 PH):** Finalizado (100%) — HU016, HU017, HU018, HU019.
* **Sprint 4 Extendido (51 PH):** Finalizado (100%) — HU020 a HU031. Backlog completo: 31 historias, 123 PH.

## Comandos de Verificación

Desde `P_upbFood/Backend`:
```powershell
.\mvnw.cmd test
```

Desde `P_upbFood/Frontend`:
```powershell
npm.cmd run build
```

Para levantar el sistema completo:
```powershell
cd P_upbFood
docker compose up --build
```

## Equipo y Metodología

El proyecto se desarrolla para Proyecto Aplicado en TIC 1 con un enfoque híbrido **Scrumban** (Scrum + Kanban en GitHub Projects).

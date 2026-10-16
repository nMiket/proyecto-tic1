# Plan General de UPB Food

## Objetivo

UPB Food es una plataforma web para consultar cafeterías, explorar sus productos y gestionar pedidos dentro de la Universidad Pontificia Bolivariana. El objetivo es reducir filas y tiempos de espera mediante un catálogo digital, checkout en tres pasos y paneles especializados para cocina y administración.

## Alcance Actual y Estado del Repositorio (Sprint 1 a 4)

| Área | Historia / Módulo | Estado | Resultado |
|---|---|---|---|
| Infraestructura | Docker Compose | **Completado** | PostgreSQL 16, backend Spring Boot y frontend React contenerizados y orquestados. |
| Modelo de datos | Tablas y Funciones 3FN | **Completado** | Scripts `init.sql`, tablas relacionales y funciones plpgsql para restaurantes, productos, pedidos y clientes. |
| Catálogo y Restaurantes | HU001, HU002, HU003 | **Completado** | Lista responsive, CardRestaurante (estados y tiempos), buscador y barra de navegación dinámica. |
| Productos y Carrito | HU004, HU005, HU006, HU007, HU008 | **Completado** | Catálogo con fotos automáticas, selector de productos, CartContext de una sola cafetería, cantidades y observaciones. |
| Autenticación | HU012, HU013, HU023 | **Completado** | Login con BCrypt, emisión de tokens JWT, Refresh Tokens revocables en cookie HttpOnly y cierre de sesión. |
| Pedidos y Cocina | HU009, HU010, HU011, HU014, HU015 | **Completado** | POST `/api/pedidos`, checkout en frontend, y Dashboard de Cocina (`/cocina`) con tablero Kanban y refresco en tiempo real. |
| Administración | HU016, HU017, HU018, HU019, HU026 | **Completado** | Panel administrativo, filtro por categoría, alta de productos con fotos/tamaños, edición y aislamiento por cafetería. |
| Seguridad y Roles | HU024, HU025 | **Completado** | Control de acceso por rol (Dueño vs. Cocina), autorización por cafetería y gestión de personal operativo. |
| Trazabilidad y Pagos | HU020, HU021, HU022 | **En Progreso** | Código de seguimiento UUID, consulta por teléfono/correo y portal de simulación de pago. |
| Métricas e Historial | HU027, HU028, HU029 | **Planificado** | Historial del cliente en `/historial`, métricas dinámicas del dashboard y cambio de estado de la cafetería. |

## Resumen del Cumplimiento de Sprints

* **Sprint 1 (16 PH):** Finalizado (100%) — HU001, HU002, HU003, HU012, HU013.
* **Sprint 2 (19 PH):** Finalizado (100%) — HU004, HU005, HU006, HU007, HU008.
* **Sprint 3 (19 PH):** Finalizado (100%) — HU009, HU010, HU011, HU014, HU015.
* **Sprint 4 (18 PH):** Finalizado (100%) — HU016, HU017, HU018, HU019.
* **Sprint 4 Extendido (42 PH):** En Ejecución (HU023, HU024, HU025, HU026 completadas en backend; HU020-HU022 en integración).

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

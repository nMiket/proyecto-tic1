# UPB Food — Plan de mejora

**Corte:** 30 de septiembre de 2026 (mitad del sprint 3)
**Fuente:** `CONTEXTO_PROYECTO_TEMPORAL.md` + backlog de historias de usuario (Excel, HU001–HU019)
**Autor del contexto:** Andrés (Tech Lead)

> **Límite importante:** este plan se basa en el documento de contexto, no en el código. Cada hallazgo marcado como "verificar" debe comprobarse contra el repositorio antes de implementarlo. Los esfuerzos son estimaciones gruesas: **S** = menos de medio día, **M** = entre medio día y 2 días, **L** = más de 2 días.

---

## 0. Resumen ejecutivo

El proyecto tiene una base sólida: monorepo con Docker, backend con BCrypt + JWT + refresh token revocable, total calculado en servidor, autorización por cafetería y catálogo/carrito/confirmación funcionando. Lo que hoy impide que sea un producto **funcional de punta a punta** es el flujo del pedido después de confirmarlo.

**Los 6 problemas que más pesan:**

1. **Los pedidos sin pagar aparecen en cocina.** El estado inicial es `NUEVO` (lo que cocina lista como "Nuevos"), y solo después pasa a `EN_PAGO`. Un pedido abandonado queda en `NUEVO` y cocina lo vería como real. Además no existe ninguna transición que salga de `EN_PAGO`, así que un pedido pagado nunca llega a cocina por el camino correcto.
2. **No hay endpoints de cocina** (pendientes 3 y 4 del contexto). Es exactamente el trabajo pendiente de HU014.
3. **`PUT /api/pedidos/{id}/pago` es público y usa un ID secuencial.** Cualquiera puede cambiar el estado del pedido de otra persona probando números.
4. **Falta la hora de recogida**, que cocina necesita y ninguna tabla ni formulario captura.
5. **`DELETE /api/products/{id}` probablemente rompe o destruye el historial**, porque `detalle_pedidos` referencia productos (verificar).
6. **El esquema de BD depende de que cada quien tenga el volumen correcto** (`init.sql` solo corre en volumen nuevo). Ya les pasó con `descripcion`, y las mejoras de este plan agregan más columnas.

**Oportunidad:** según el contexto, el CRUD de productos y el cambio de disponibilidad del admin ya están hechos, lo que adelanta parte de HU016–HU019 (sprint 4). Eso libera capacidad en el sprint 4 para pago, seguimiento y endurecimiento.

---

## 1. Cómo leer este plan

| Prioridad | Significado | Cuándo |
|---|---|---|
| **P0** | Bloquea el flujo principal o es un riesgo de seguridad/datos | Resto del sprint 3 |
| **P1** | Necesario para considerar el MVP funcional y defendible | Sprint 4 |
| **P2** | Mejora importante, no bloqueante | Sprint 4 si hay holgura, si no, después |
| **P3** | Ideal a futuro | Después de la entrega |

**Supuesto:** el Excel planea 4 sprints, así que el sprint 4 es el último planeado. La Parte C es opcional según cuánto dure el curso o cuánto continúe el proyecto.

**Línea de corte del sprint 3:** el tiempo que queda es corto. Si no cabe todo lo P0, el orden de sacrificio (de lo último que se cae a lo primero) es: A1 → A9 → A3 → A2 → A5 → A6 → A7 → A8 → A4. Lo que nunca debería quedar fuera: **A1, A9 y A3**.

---

## 2. Decisiones que el equipo debe tomar esta semana

Varias mejoras dependen de estas decisiones. Se deja una recomendación, pero deben confirmarla ustedes (y el profesor si aplica).

| # | Decisión | Recomendación | Afecta |
|---|---|---|---|
| D1 | Modelo de estados del pedido | Adoptar el de la sección A1 (incluye `LISTO` y `CANCELADO`) | A1, A3, A4, B1, B2 |
| D2 | ¿Cómo se identifica el estudiante? | MVP: pedido anónimo con **código de seguimiento** guardado en el navegador. Futuro: login institucional o código por correo | A2, B2 |
| D3 | ¿Pago real o simulado? | Simulado detrás de una interfaz (`PagoService`), diseñado para cambiar a Wompi sandbox luego | B1, C1 |
| D4 | ¿"Encargado de pedidos" y "Administrador" son el mismo usuario? | Dos roles, `ADMIN` y `COCINA`, en la misma pantalla de login | B3 |
| D5 | ¿Cuántos restaurantes habrá en el piloto y quién los crea? | Semilla por SQL para el piloto, sin CRUD de restaurantes | B4 |
| D6 | ¿Cómo se elige la hora de recogida? | Franjas cada 10 min dentro de las próximas 2–3 horas, o "lo antes posible" | A6 |

---

## Parte A — Necesario ahora (resto del sprint 3)

### A1 · Máquina de estados del pedido · P0 · M · Resp. sugerido: Andrés

**Problema.** Estados actuales: `NUEVO → EN_PAGO → EN_PREPARACION → ENTREGADO`. El pedido nace en `NUEVO` sin pagar, cocina lo ve, y no hay salida de `EN_PAGO`. Tampoco existe "listo para recoger" (el estudiante no puede enterarse de que su pedido está listo, que es el valor central del proyecto) ni cancelación.

**Especificación.**

Estados propuestos:

| Estado | Significado | ¿Lo ve cocina? |
|---|---|---|
| `PENDIENTE` | Creado, no pagado (reemplaza al `NUEVO` actual) | No |
| `EN_PAGO` | El estudiante está en el portal de pago | No |
| `PAGADO` | Pago confirmado. Cocina lo muestra como "Nuevo" | Sí |
| `EN_PREPARACION` | Cocina aceptó el pedido | Sí |
| `LISTO` | Listo para recoger | Sí |
| `ENTREGADO` | Entregado al estudiante | No (historial) |
| `CANCELADO` | Cancelado por el estudiante, por expiración o por cocina | No |

Transiciones permitidas (todo lo demás devuelve `409 Conflict`):

| Desde | Hacia | Quién |
|---|---|---|
| `PENDIENTE` | `EN_PAGO` | Estudiante (código de seguimiento) |
| `PENDIENTE` | `CANCELADO` | Estudiante, o expiración automática |
| `EN_PAGO` | `PAGADO` | Pasarela / simulador |
| `EN_PAGO` | `PENDIENTE` | Pago fallido o cancelado por el usuario (permite reintentar) |
| `EN_PAGO` | `CANCELADO` | Expiración automática |
| `PAGADO` | `EN_PREPARACION` | Cocina ("Aceptar pedido") |
| `PAGADO` | `CANCELADO` | Cocina (rechazo, con motivo) |
| `EN_PREPARACION` | `LISTO` | Cocina |
| `LISTO` | `ENTREGADO` | Cocina ("Marcar como entregado") |

Implementación:

- Enum `EstadoPedido` con un mapa de transiciones válidas y un único método `cambiarEstado(pedido, nuevoEstado, actor)` en un `PedidoService`. **Ningún controlador cambia el estado directamente.**
- Tabla append-only `pedido_eventos (id, pedido_id, estado_anterior, estado_nuevo, actor, created_at)`. Se escribe en cada transición. Sirve para auditoría y para las métricas de tiempos (B8), y **debe estar desde ahora aunque el dashboard de métricas no exista todavía**: los datos que no se guardan hoy no se pueden recuperar.
- Migración de la restricción `CHECK` (verificar el nombre real de la restricción con `\d pedidos` en `psql`):

```sql
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
UPDATE pedidos SET estado = 'PENDIENTE' WHERE estado = 'NUEVO';
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('PENDIENTE','EN_PAGO','PAGADO','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO'));
```

- Estado inicial de `POST /api/pedidos`: `PENDIENTE`.

**Criterios de aceptación.**

- Un pedido recién creado **no** aparece en ningún listado de cocina.
- Una transición no permitida devuelve `409` con mensaje claro y no modifica el pedido.
- Cada transición válida crea una fila en `pedido_eventos`.
- Hay pruebas unitarias para cada transición válida y al menos tres inválidas.

**Dependencias.** D1, A9. Desbloquea A3, A4, B1.

---

### A9 · Migraciones versionadas con Flyway · P0 · M · Resp. sugerido: Andrés

**Problema.** `init.sql` solo se ejecuta al crear un volumen. Ya hubo un desfase (`productos.descripcion`) que se corrigió a mano. A1, A5, A6 y B3 agregan columnas y tablas, y cada integrante tendría un esquema distinto según cuándo creó su volumen. Esto también explica por qué integrar `Julian` y `valeria` fue trabajoso.

**Especificación.**

- Agregar Flyway al backend (verificar la dependencia compatible con Spring Boot 4 y PostgreSQL 16).
- Convertir el esquema actual en `V1__esquema_base.sql` (el contenido de `init.sql`) y los datos semilla en un script separado, solo para el perfil de desarrollo.
- Para el volumen ya existente: usar `baseline-on-migrate=true` con `baseline-version=1`, **con backup previo** (`pg_dump`).
- Cada cambio de esquema desde ahora es un archivo nuevo `V2__…`, `V3__…`. **Nadie edita una migración ya mergeada.**
- Quitar `init.sql` de `docker-entrypoint-initdb.d` una vez migrado.
- Documentar en el README el procedimiento para cuando alguien tenga el esquema desfasado.

**Criterios de aceptación.**

- `docker compose down -v && docker compose up --build -d` deja un esquema idéntico al del volumen antiguo migrado.
- Dos personas con volúmenes de fechas distintas terminan con el mismo esquema tras `git pull` y reinicio.

---

### A3 · Endpoints de cocina (HU014) · P0 · M · Resp. sugerido: Ismael

**Problema.** Pendiente explícito del contexto (puntos 3 y 4). Es el trabajo de Ismael en el sprint 3 y hoy bloquea que el flujo funcione.

**Especificación.**

- Usar el prefijo `/api/admin/**` para todo lo de cocina, igual que `/api/admin/login`. Así una sola regla de seguridad (`/api/admin/** → autenticado`) cubre todo y se evita que un `permitAll` sobre `/api/pedidos/**` deje algo público por accidente. (Esto ajusta la ruta `GET /api/pedidos/cocina` que aparece en el Excel; actualizar la historia.)
- `GET /api/admin/pedidos?estado=PAGADO,EN_PREPARACION,LISTO`
  - La cafetería **sale del JWT**, nunca de un parámetro.
  - Orden: `horaRecogida` ascendente y luego `created_at`.
  - Respuesta por pedido: `id`, `codigoCorto`, `clienteNombre`, `horaRecogida`, `estado`, `total`, `items[{nombre, cantidad, observaciones}]`.
  - Incluir contadores por estado (o endpoint aparte `GET /api/admin/pedidos/resumen`) para las columnas "Nuevos (n)".
- `PATCH /api/admin/pedidos/{id}/estado` con cuerpo `{ "estado": "EN_PREPARACION" }`
  - Delega en `PedidoService.cambiarEstado` (A1).
  - `403` si el pedido es de otra cafetería, `404` si no existe, `409` si la transición no es válida.
- Esto reemplaza el `PUT /api/pedidos/{id}` del Excel, que mezclaba actualizar cualquier campo con cambiar estado.

**Criterios de aceptación.**

- Con el admin de la cafetería 1 no se puede ver ni modificar un pedido de la cafetería 2 (probado con `admin2@upb.edu.co`).
- Sin JWT, ambos endpoints devuelven `401`.
- `PENDIENTE` y `EN_PAGO` nunca aparecen en el listado.
- Un pedido `PAGADO` aceptado pasa a `EN_PREPARACION` y crea su evento.

**Nota para el equipo.** Ismael no debería empezar esto hasta que Andrés publique la tabla de estados y el contrato de API de A1 y A3 (un documento corto es suficiente). Es el camino crítico y conviene desbloquearlo hoy.

---

### A4 · Conectar el DashboardCocina · P0 · M · Resp. sugerido: Ismael + Valeria

**Problema.** `DashboardCocina` existe (avance de Valeria) pero no refleja el flujo completo ni está conectado a endpoints reales.

**Especificación.**

- Tres columnas: **Nuevos** (`PAGADO`), **En preparación**, **Listos**. Botones: "Aceptar pedido", "Marcar como listo", "Marcar como entregado".
- Actualización por **polling cada 5–10 s**, pausado cuando la pestaña no está visible (`document.visibilityState`). Mostrar "Última actualización: hh:mm:ss" y una alerta visual cuando llegue un pedido nuevo.
- Manejo de errores `409` (alguien más ya cambió el estado): refrescar la lista y avisar.
- Estados de carga, vacío y error visibles.
- La hora de recogida destacada (depende de A6).

**Criterios de aceptación.**

- Un pedido pagado aparece en "Nuevos" sin recargar la página en menos de 10 s.
- Al pulsar un botón, la tarjeta cambia de columna y los contadores se actualizan.
- Con el backend caído se muestra un mensaje, no una pantalla en blanco.

**Nota.** El polling es la opción correcta para este sprint por costo/beneficio. SSE queda en la Parte C.

---

### A2 · Proteger los endpoints del flujo del estudiante · P0 · M · Resp. sugerido: Andrés

**Problema.**

- `PUT /api/pedidos/{id}/pago` es público con ID secuencial (enumerable).
- `POST /api/clientes` es público y "legado" de HU010, aunque `POST /api/pedidos` ya crea o reutiliza el cliente.
- Se "crea o reutiliza" el cliente por correo: si alguien pide con el correo de otra persona y otro nombre o teléfono, se pisan datos (verificar).
- Nadie verifica que el correo `@upb.edu.co` sea realmente de quien pide.

**Especificación.**

- Agregar `pedidos.codigo_seguimiento` (UUID único, no secuencial). `POST /api/pedidos` lo devuelve en la respuesta.
- Los endpoints del estudiante pasan a usar el código en vez del ID:
  - `GET /api/pedidos/seguimiento/{codigo}`
  - `PUT /api/pedidos/seguimiento/{codigo}/pago`
  - `PUT /api/pedidos/seguimiento/{codigo}/cancelar`
- Eliminar `PUT /api/pedidos/{id}/pago` y `POST /api/clientes`.
- Guardar `cliente_nombre` y `cliente_telefono` **en el pedido** (snapshot) y no sobrescribir los datos de un cliente existente. Cocina muestra el nombre que se dio en ese pedido.
- Validar en el backend el dominio `@upb.edu.co` (hoy solo se asegura en el formulario, según HU010).
- Verificación real del correo (código por correo o SSO): queda como **riesgo aceptado** en el MVP y se documenta. Ver C2.

**Criterios de aceptación.**

- Probar con IDs `1, 2, 3…` contra los endpoints de estudiante devuelve `404`.
- Un segundo pedido con el mismo correo pero otro nombre no altera los pedidos anteriores.
- Un correo que no sea `@upb.edu.co` es rechazado por el backend aunque se salte el formulario (probar con `curl`).

**Dependencias.** D2, A9.

---

### A5 · Borrado lógico de productos · P0 · S · Resp. sugerido: Julián

**Problema.** `DELETE /api/products/{id}` probablemente falla por la llave foránea de `detalle_pedidos`, o peor, si se configuró en cascada, destruye el historial de ventas (verificar).

**Especificación.**

- Agregar `productos.activo BOOLEAN NOT NULL DEFAULT TRUE` (migración `V_n`).
- `DELETE` marca `activo = false` (responde `204`).
- Todos los listados (públicos y admin) filtran `activo = true`.
- Recomendado: guardar `nombre_producto` en `detalle_pedidos` (snapshot), para que renombrar un producto no cambie el historial.

**Criterios de aceptación.**

- Borrar un producto con pedidos asociados no falla ni altera esos pedidos.
- El producto borrado ya no aparece en el catálogo ni en el panel.

---

### A6 · Hora de recogida · P0 · M · Resp. sugerido: Julián (front) + Andrés (back)

**Problema.** La cocina la necesita (HU014/015) y ninguna parte del flujo la captura. `pedidos` hoy tiene restaurante, cliente, estado, total y fecha.

**Especificación.**

- Columna `pedidos.hora_recogida TIMESTAMP NOT NULL`.
- En `/cliente`: selector de franjas cada 10 min, desde `ahora + restaurante.tiempo_estimado` hasta unas 2–3 horas adelante, más la opción "lo antes posible" (que calcula `ahora + tiempo_estimado`). Decisión D6.
- Backend: `horaRecogida` opcional en `POST /api/pedidos`. Si falta, se asigna el valor por defecto. Se valida que sea **posterior a `ahora + tiempo_estimado`** y no más lejana que el máximo permitido.
- Mostrarla en el resumen del estudiante y destacada en las tarjetas de cocina.

**Criterios de aceptación.**

- No se puede crear un pedido con hora de recogida en el pasado (probado vía API).
- Cocina ordena por hora de recogida.

**Dependencias.** A9.

---

### A7 · Pruebas: corregir las rojas y cubrir pedidos · P0 · M · Resp. sugerido: Ismael

**Problema.** Hay dos pruebas fallando en `ProductControllerTest` (`.trim()` sobre `descripcion` nula) y `OrderController` no tiene pruebas. Con el flujo de pedidos cambiando, sin pruebas cualquier ajuste puede romper lo que ya funciona.

**Especificación.**

- Corregir el `.trim()`: tratar `descripcion == null` como cadena vacía (o exigirla con `@NotNull` si así lo define el negocio) y **decidir una sola vez** qué pasa con la nula.
- Pruebas de `OrderController` y `PedidoService`:
  - Crear pedido correcto.
  - El total usa el precio de la BD y **ignora cualquier precio enviado por el cliente**.
  - Producto agotado → error.
  - Producto de otra cafetería → `400`.
  - Carrito vacío → `400`.
  - Cantidad negativa o cero → `400`.
  - Cafetería cerrada → `409` (A8).
  - Transiciones válidas e inválidas (A1).
  - Acceso cruzado entre cafeterías → `403` (A3).
- Recomendado: Testcontainers con PostgreSQL 16 en vez de H2, para que el comportamiento coincida con producción (los `CHECK` y las transacciones son del motor real).

**Criterios de aceptación.**

- `./mvnw test` pasa en verde en una máquina limpia.
- Toda regla de negocio de esta parte tiene al menos una prueba.

---

### A8 · Validaciones de `POST /api/pedidos` · P0 · S · Resp. sugerido: Andrés

**Problema.** El contexto dice que se valida cafetería, productos y disponibilidad, pero no menciona estado de la cafetería, límites ni formato (verificar cada punto).

**Especificación.**

- Rechazar con `409` si `restaurante.estado` es "Cerrado".
- Bean Validation en los DTO (`@Valid`). Límites sugeridos (confirmar con el negocio): máximo 30 ítems por pedido, cantidad entre 1 y 20, observaciones máximo 200 caracteres, teléfono con formato colombiano de celular (10 dígitos que empiezan por 3).
- Rechazar ítems repetidos del mismo producto con las mismas observaciones o consolidarlos.
- Mensajes de error coherentes con `GlobalExceptionHandler`.

**Criterios de aceptación.**

- Cada regla tiene una prueba de la A7.
- Un pedido a una cafetería cerrada no se crea aunque el frontend lo permita.

---

### A10 · Persistir el carrito y evitar mezclar cafeterías · P1 (si sobra tiempo, P0) · S · Resp. sugerido: Julián

**Problema.** `CartProvider` guarda el carrito solo en memoria: recargar `/cliente` o `/pago` lo borra. Tampoco queda claro qué pasa si el estudiante agrega productos de dos cafeterías.

**Especificación.**

- Guardar el carrito y el `restauranteId` en `localStorage` (con `try/catch` y validación al leer: si los datos no coinciden con el esquema esperado, se descartan).
- Si se intenta agregar un producto de otra cafetería, mostrar confirmación: "Tu carrito tiene productos de X. ¿Vaciarlo?".
- Al crear el pedido correctamente, limpiar el carrito.

**Criterios de aceptación.**

- Recargar la página en cualquier pantalla del flujo conserva el carrito.
- No es posible crear un pedido con productos de dos cafeterías.

---

## Parte B — Sprint 4 (cierra el MVP)

Orden recomendado: B1 → B2 → B3 → B4 → (B7 y B10 en paralelo durante todo el sprint) → B5 → B6 → B8 → B9 → B11.

### B1 · Pago (simulado con interfaz real) · P1 · L · Andrés (back) + Julián (front)

**Problema.** La pantalla `/pago` es simulada y solo existe la transición a `EN_PAGO`. Nadie confirma el pago.

**Especificación.**

- Interfaz `PagoService` con dos implementaciones: `PagoSimuladoService` (por defecto) y, a futuro, `WompiService` (C1). Cambiar de una a otra debe requerir solo configuración.
- `POST /api/pedidos/seguimiento/{codigo}/pago/iniciar` → `EN_PAGO`. Devuelve una referencia de pago.
- `POST /api/pagos/callback` (equivalente al webhook): recibe `{referencia, resultado: APROBADO|RECHAZADO}`. Valida una firma/secreto compartido incluso en el simulador, para que el diseño sea el mismo que el real. `APROBADO → PAGADO`, `RECHAZADO → PENDIENTE`.
- Pantalla `/pago` simulada con botones "Aprobar" y "Rechazar" que llaman al callback (visibles solo en perfil de desarrollo).
- **Expiración:** tarea `@Scheduled` que cancela pedidos en `PENDIENTE` o `EN_PAGO` con más de 15 minutos (valor sugerido). Registra el evento.
- Idempotencia: un callback repetido no debe duplicar la transición.

**Criterios de aceptación.**

- Flujo feliz: pedido `PENDIENTE → EN_PAGO → PAGADO` y aparece en cocina.
- Pago rechazado: vuelve a `PENDIENTE`, puede reintentar.
- Pedido abandonado: a los 15 min pasa a `CANCELADO` y nunca se ve en cocina.
- Un callback con firma inválida devuelve `401` y no cambia nada.

**Dependencias.** D3, A1, A2.

### B2 · Seguimiento e historial del estudiante · P1 · M · Julián

**Problema.** `/historial` existe como ruta pero no hay historial real (pendiente 2 del contexto), y el estudiante no ve el estado de su pedido (incluido "Listo para recoger").

**Especificación.**

- Al crear el pedido, el navegador guarda el `codigoSeguimiento` en una lista local (máx. 20 pedidos).
- Pantalla "Pedido" (la del nav inferior): estado actual con línea de tiempo (`PAGADO → EN_PREPARACION → LISTO → ENTREGADO`), hora de recogida y detalle. Polling cada 10 s contra `GET /api/pedidos/seguimiento/{codigo}`.
- Pantalla "Historial": lista los pedidos locales consultando cada código.
- Limitación conocida y aceptada del MVP: el historial vive en ese navegador. Se resuelve en C2.

**Criterios de aceptación.**

- Cuando cocina marca `LISTO`, el estudiante lo ve en menos de 10 s sin recargar.
- El historial sobrevive a recargar la página.

### B3 · Roles `ADMIN` y `COCINA` · P1 · M · Andrés

**Problema.** El Excel define dos actores ("Administrador de cafetería" y "Encargado de pedidos"), pero `usuarios_admin` no distingue roles.

**Especificación.**

- Columna `usuarios_admin.rol` (`ADMIN` | `COCINA`) y claim `rol` en el JWT.
- `COCINA`: ver y gestionar pedidos, y cambiar disponibilidad de productos (HU016/017).
- `ADMIN`: todo lo anterior más crear, editar y borrar productos y gestionar la cafetería.
- `@PreAuthorize` por endpoint y prueba de autorización para cada rol.
- Semilla de desarrollo con un usuario de cada rol.

**Criterios de aceptación.** Un usuario `COCINA` recibe `403` al intentar crear o borrar un producto.

### B4 · Gestión de la cafetería (estado y tiempo estimado) · P1 · S · Valeria (front) + Andrés (back)

**Problema.** La card muestra "Abierto / Cerrado / Alta demanda" y tiempo estimado, pero nadie puede cambiarlos desde la app.

**Especificación.**

- `PATCH /api/admin/restaurante` con `{estado, tiempoEstimado}` para **su propia** cafetería (tomada del JWT).
- Control en el dashboard admin: selector de estado y campo de tiempo estimado.
- Con estado "Cerrado", el catálogo del estudiante deshabilita "Confirmar pedido" (el backend ya lo rechaza en A8).

### B5 · Tamaños y extras (HU018/019) · P2 · L · Andrés + Julián

**Problema.** El Excel pide configurar tamaños e ingredientes extra, pero el modelo de datos no los incluye y el carrito no sabe elegirlos. Es la parte más costosa del backlog restante.

**Especificación.**

- Tablas: `producto_tamanos (id, producto_id, nombre, precio_adicional)`, `producto_extras (id, producto_id, nombre, precio_adicional, activo)` y `detalle_pedido_extras (detalle_id, extra_id, nombre, precio)`. Columna `detalle_pedidos.tamano_id` (nullable).
- El precio se calcula **en el servidor**: `(precio_base + adicional_tamaño + suma(extras)) × cantidad`.
- `POST /api/pedidos` acepta `tamanoId` y `extraIds[]` por ítem y valida que pertenezcan al producto.
- En el carrito, la clave de una línea incluye las opciones: el mismo producto con extras distintos son líneas distintas.
- Si el tiempo no alcanza, **recortar primero los tamaños** y entregar solo extras.

### B6 · Imágenes: assets locales y subida desde admin · P2 · M · Julián

**Problema.** Las imágenes dependen de URLs externas de Unsplash (falla sin internet) y HU019 pide subir imagen, sin definir dónde se guarda.

**Especificación.**

- Mover las imágenes de la semilla a `Frontend/public/img/…` y dejar un fallback local.
- `POST /api/admin/productos/{id}/imagen` (multipart). Validar tipo (`jpeg`, `png`, `webp`) y tamaño (sugerido ≤ 2 MB), nombre aleatorio, almacenamiento en un volumen Docker `uploads` servido por Nginx o Spring, ruta guardada en `imagenUrl`.

### B7 · Endurecimiento de seguridad · P1 · M · Andrés

| Punto | Acción |
|---|---|
| Credenciales de desarrollo documentadas (`admin123`, `admin456`) | Semilla solo en perfil `dev`. En cualquier despliegue real, usuarios creados con variables de entorno. Sacar las contraseñas del documento |
| `APP_AUTH_COOKIE_SECURE=false` | Debe ser `true` bajo HTTPS. Revisar `SameSite` de la cookie del refresh token (`Strict` o `Lax`), ya que `/api/admin/refresh` depende de esa cookie y es candidato a CSRF |
| CORS | Lista blanca con el origen exacto del frontend, nunca `*` |
| Login | Límite de intentos por IP/usuario (por ejemplo 5 en 10 min) y mensaje genérico de error |
| `APP_JWT_SECRET` | Generar aleatorio (≥ 32 bytes), nunca en el repositorio. Confirmar que `.env` está en `.gitignore` y que no hubo commits históricos con secretos |
| Rutas | Unificar: hoy hay `/api/products` y `/api/productos` (alias) y los protegidos viven en `/api/products`. Elegir un solo nombre (recomendado: español, como el Excel) y mover lo administrativo bajo `/api/admin/**` |
| Errores | No exponer trazas de pila ni mensajes internos de JPA en las respuestas |
| Dependencias | Activar Dependabot o un escaneo equivalente |

### B8 · Métricas de tiempos · P2 · M · Ismael

**Problema.** El objetivo del proyecto es reducir tiempos de espera, y hoy no hay cómo demostrarlo. Además, el rol de Data Scientist no tiene tareas de datos en el backlog.

**Especificación.**

- Con `pedido_eventos` (A1), calcular: tiempo `PAGADO → EN_PREPARACION`, `EN_PREPARACION → LISTO`, `LISTO → ENTREGADO`, y total pago → entrega.
- `GET /api/admin/metricas/resumen?desde=&hasta=` (solo `ADMIN`): pedidos por estado, promedio y percentil 90 por fase, pedidos por hora del día.
- Vista simple en el dashboard admin (tabla y un gráfico).
- **Línea base:** cronometrar entre 20 y 30 clientes reales en la fila de una cafetería antes del piloto. Sin ese número no hay comparación posible con los tiempos de la app.
- Script para sembrar pedidos de prueba y poder mostrar el dashboard con datos en la sustentación.

### B9 · Consentimiento de datos personales · P2 · S · Valeria

- Checkbox obligatorio "Autorizo el tratamiento de mis datos personales" en `/cliente`, con enlace a una política breve. Guardar `pedidos.acepto_datos_at` o el equivalente en el cliente.
- Contexto: la app recoge nombre, teléfono y correo (Ley 1581 de 2012, Habeas Data, en Colombia). Esto es una medida mínima, no asesoría legal: confirmar con la UPB qué política de tratamiento de datos aplica.
- Definir cuánto tiempo se conservan los datos personales y cómo se anonimizan después.

### B10 · CI, flujo de ramas y documentación · P1 · M · Valeria (docs) + Andrés (CI)

- **CI (GitHub Actions):** backend `./mvnw test` y frontend `npm ci && npm run lint && npm run build` en cada pull request. Bloquear el merge si falla.
- **Ramas:** hoy cada quien trabaja en su rama personal y la integración fue "unión de avances". Pasar a una rama `develop` con pull requests pequeños y revisión cruzada, para que no vuelva a acumularse una integración grande.
- **Documentación:**
  - Actualizar `PLAN_PROYECTO.md` (hoy marca como pendientes cosas ya hechas) y el README.
  - Agregar especificación de API (OpenAPI con springdoc; verificar la versión compatible con Spring Boot 4) o, como mínimo, una tabla de endpoints mantenida.
  - Actualizar el Excel: corregir los criterios de HU005 (son copia de HU003), fusionar historias duplicadas, añadir las nuevas (sección 6) y corregir los typos de la columna Sprint ("sprin1", "sprin3", "sprint3").
  - Documentar el diagrama de estados (A1) en el README.

### B11 · QA de punta a punta y requisitos no funcionales · P1 · M · Ismael

- Ejecutar el escenario de aceptación de la sección 8 completo y registrar el resultado.
- Medir los requisitos no funcionales del Excel: carga de listas ≤ 3 s, confirmación ≤ 2 s, login ≤ 2 s. Anotar condiciones de medición (cantidad de datos, red, máquina), porque sin ellas el número no es comparable.
- Revisar responsive en al menos tres anchos (móvil, tablet, escritorio) y accesibilidad básica: etiquetas en formularios, contraste, navegación por teclado y los avisos de ESLint pendientes.
- Pruebas manuales de concurrencia: producto que se agota con el carrito armado; dos personas de cocina aceptando el mismo pedido.

---

## Parte C — Ideal a futuro (después del MVP)

| # | Mejora | Prioridad | Qué aporta | Nota |
|---|---|---|---|---|
| C1 | Pasarela real (Wompi, PayU o similar) | P2 | Pagos reales | Si B1 respeta `PagoService` y el callback firmado, es cambiar la implementación y configurar sandbox. Requiere HTTPS público para el webhook |
| C2 | Identidad real del estudiante (SSO con cuenta institucional, o código de un solo uso por correo) | P2 | Historial entre dispositivos, verificación del correo, menos datos por pedido | Elimina el riesgo aceptado en A2 y la limitación de B2 |
| C3 | Notificaciones (correo, push web o WhatsApp) cuando el pedido esté `LISTO` | P2 | Evita que el estudiante tenga que mirar la pantalla | Empezar por correo |
| C4 | Tiempo real con SSE o WebSocket | P3 | Reemplaza el polling de A4/B2 | Solo si el polling resulta insuficiente |
| C5 | Tiempo estimado y "Alta demanda" calculados automáticamente | P3 | Usa `pedido_eventos` para estimar según la cola actual | Buen trabajo de datos para el rol de Data Scientist |
| C6 | Horarios de apertura por cafetería y franjas con capacidad máxima | P3 | Evita saturar cocina a la hora pico | Requiere columnas de horario y de capacidad |
| C7 | Reembolsos y conciliación de pagos | P3 | Necesario solo con pagos reales | Depende de C1 |
| C8 | Observabilidad (Actuator, logs estructurados, alertas) y despliegue en la nube con backups automáticos de PostgreSQL | P3 | Operación real del piloto | |
| C9 | PWA (instalable, funciona mejor con red inestable) | P3 | Experiencia móvil | |
| C10 | Gestión de restaurantes y categorías desde la interfaz | P3 | Hoy van por semilla SQL | Solo si crece el número de cafeterías |

---

## 3. Distribución sugerida por persona

Es una propuesta: Andrés, como Tech Lead, puede ajustarla. Busca equilibrar la carga y reducir el riesgo de que todo el backend dependa de una sola persona.

| Persona | Sprint 3 (resto) | Sprint 4 |
|---|---|---|
| **Andrés** | A1, A9, A2, A8; publicar contrato de API para desbloquear a Ismael | B1 (back), B3, B4 (back), B7, B10 (CI) |
| **Ismael** | A3, A4 (con Valeria), A7 | B8, B11 |
| **Julián** | A5, A6 (front), A10 | B1 (front), B2, B5 (front), B6 |
| **Valeria** | A4 (tarjetas y botón "Listo"), apoyo en A6 (destacar hora en cocina) | B4 (front), B9, B10 (docs y Excel), apoyo en accesibilidad |

**Riesgo principal:** A1 y A9 están en una sola persona y todo lo demás depende de ellas. Si Andrés se atrasa, Ismael sigue bloqueado. Por eso la primera entrega de A1 debe ser **solo el contrato** (estados, transiciones, endpoints) el primer día, y la implementación después.

---

## 4. Orden de ejecución y dependencias

```text
D1, D2, D6 (decisiones)
   └─> A9 Flyway ─> A1 Máquina de estados ─┬─> A3 Endpoints cocina ─> A4 Dashboard cocina
                                            ├─> A2 Seguridad del estudiante
                                            └─> A6 Hora de recogida
A5 Borrado lógico, A8 Validaciones, A10 Carrito ─ independientes (paralelo)
A7 Pruebas ─ avanza junto con cada ítem anterior

Sprint 4:
A1 + A2 ─> B1 Pago ─> B2 Seguimiento
A1 ─> B8 Métricas
B3 Roles ─> B4 Gestión cafetería
B5 Tamaños/extras, B6 Imágenes ─ independientes
B7, B10 ─ continuos
B11 QA final ─ cierra el sprint
```

---

## 5. Definición de "hecho"

Un ítem se considera terminado solo si:

1. Cumple sus criterios de aceptación.
2. Tiene pruebas automáticas (backend) o evidencia de prueba manual documentada (frontend).
3. Pasa `./mvnw test` y `npm run build` sin errores nuevos.
4. La migración de esquema (si hay) es un archivo nuevo de Flyway.
5. Fue revisado por otra persona mediante pull request.
6. La documentación afectada (README, tabla de endpoints, Excel) está actualizada.

---

## 6. Cambios sugeridos al backlog (Excel)

| Acción | Detalle |
|---|---|
| Corregir | HU005: los criterios de aceptación son copia de HU003 |
| Renombrar | HU007 → "Resumen del pedido" (hoy se llama igual que HU014). HU016 → "Gestión de disponibilidad (admin)" (hoy se llama igual que HU004) |
| Fusionar | HU014+HU015, HU016+HU017, HU012+HU013, HU010+HU011, HU002 dentro de HU001, HU005 dentro de HU004 |
| Actualizar ruta | HU014: de `/api/pedidos/cocina` a `/api/admin/pedidos` (A3) |
| Nuevas historias | Seguimiento del pedido (B2), Pago y expiración (B1), Hora de recogida (A6), Roles (B3), Estado de la cafetería (B4), Métricas de tiempos (B8), Consentimiento de datos (B9) |
| Nuevas columnas | Prioridad, Estimación (S/M/L o puntos), Dependencias |
| Corregir | Typos en Sprint: "sprin1", "sprin3", "sprint3" |

---

## 7. Riesgos y qué recortar si falta tiempo

| Riesgo | Señal de alerta | Mitigación |
|---|---|---|
| Ismael no termina HU014 en el sprint 3 | A3 sin contrato de API el segundo día | Publicar el contrato primero. Hacer A3 en pareja con Andrés o Julián |
| Pérdida de datos al migrar a Flyway | Volúmenes con esquemas distintos entre integrantes | Backup con `pg_dump` antes de migrar. Un solo integrante baselinea y los demás recrean el volumen |
| Sprint 4 sobrecargado | B1 + B5 + B8 en paralelo con poca holgura | Recortar en este orden: tamaños (B5), dashboard de métricas (B8, pero manteniendo `pedido_eventos`), subida de imágenes (B6) |
| Se decide usar pago real tarde | Decisión D3 sin cerrar al iniciar el sprint 4 | Mantener `PagoService` desacoplado. El simulador debe entregar el mismo flujo de estados |

**Lo que no se debe recortar:** A1, A2, A3, A9, B1 (aunque sea simulado), B2 y `pedido_eventos`.

---

## 8. Escenario de aceptación del MVP (punta a punta)

Cuando todo esto funcione de corrido, el MVP es funcional:

1. El estudiante abre la app, ve las cafeterías con su estado y tiempo estimado, y elige una abierta.
2. Agrega productos (con observaciones) al carrito, recarga la página y el carrito sigue ahí.
3. Confirma el pedido, llena nombre, teléfono y correo `@upb.edu.co`, acepta el tratamiento de datos y elige una hora de recogida.
4. El pedido se crea como `PENDIENTE` y **no** aparece en cocina.
5. Pasa al pago simulado y lo aprueba: el pedido pasa a `PAGADO`.
6. En menos de 10 s, el pedido aparece en "Nuevos" en el dashboard de cocina de esa cafetería (y no en el de otra).
7. Cocina lo acepta (`EN_PREPARACION`) y lo marca `LISTO`.
8. El estudiante ve "Listo para recoger" en su pantalla de seguimiento sin recargar.
9. Cocina marca `ENTREGADO` y el pedido aparece en el historial del estudiante.
10. Las métricas muestran los tiempos de ese pedido.
11. Variantes: un pago rechazado permite reintentar. Un pedido abandonado pasa a `CANCELADO` a los 15 min. Un producto que se agota con el carrito armado produce un error claro al confirmar. Una cafetería cerrada no recibe pedidos.

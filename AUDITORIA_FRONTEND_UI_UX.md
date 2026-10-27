# Auditoría de Frontend UI/UX Pro Max — UPB Food

**Fecha:** 27 de octubre de 2026  
**Alcance:** Exclusivamente Frontend (`P_upbFood/Frontend/src/`)  
**Metodología:** Skill **UI/UX Pro Max** (`ui-reasoning`, `ux-guidelines`, `web-interface`, `stacks/react`) contrastada con la especificación visual del proyecto ([DESIGN.md](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/DESIGN.md) — *Academic Neo-Vibrant*).

---

## 1. Resumen Ejecutivo y Diagnóstico del Sistema de Diseño

La interfaz de **UPB Food** cuenta con una dirección visual sólida basada en el sistema **Academic Neo-Vibrant** ([DESIGN.md](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/DESIGN.md)): tipografía expresiva (`Plus Jakarta Sans` + `Inter`), acento institucional de alto contraste (`#c0d901` sobre `#121212` / `#1b1c1a`) y superficies cálidas (`#fbf9f5` y `#ffffff`).

Al evaluar los componentes React y hojas de estilo frente a las reglas de **UI/UX Pro Max**, el frontend aprueba aspectos clave como la ausencia de emojis como íconos, el uso de logos vectoriales oficiales ([UPBFood.svg](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/public/assets/branding/UPBFood.svg) y [campana.svg](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/public/assets/branding/campana.svg)) y la adaptabilidad móvil base. Sin embargo, existen **10 oportunidades concretas de mejora** en coherencia cromática, estados de carga (*skeletons*), ergonomía de scroll, accesibilidad de modales/formularios y rendimiento de renderizado en React.

### Matriz de Evaluación Pre-Delivery Checklist (UI/UX Pro Max)

| Dimensión UI/UX Pro Max | Estado Actual | Resumen del Diagnóstico |
| :--- | :---: | :--- |
| **Iconografía y Activos SVG** | Cumple | Sin emojis decorativos; logos vectoriales oficiales integrados en barra superior, hero y pie de página. |
| **Coherencia de Paleta y Tokens** | Parcial | Coexisten reglas antiguas en verde azulado (`#0f766e`, `#123e36`, `#f0fdfa`) con la paleta oficial `#c0d901` / `#121212`. |
| **Estados de Carga (Loading UX)** | Por mejorar | Se usa texto plano (`Cargando...`) sin *skeleton screens*, generando saltos de diseño (*CLS*) al recibir datos. |
| **Ergonomía de Layout y Scroll** | Parcial | El catálogo de productos tiene un contenedor con `maxHeight: 600px` y `overflowY: auto` que genera doble scroll. |
| **Accesibilidad Web (WCAG / ARIA)** | Parcial | Falta *focus trap* en el modal de producto, atributos `autocomplete`/`type="tel"` en datos del cliente y `prefers-reduced-motion`. |
| **Rendimiento React y Activos** | Parcial | Imágenes de catálogo sin `loading="lazy"` y lecturas sincrónicas de `localStorage` en el cuerpo de renderizado. |

---

## 2. Hallazgos Prioritarios (Severidad Crítica y Alta)

### H-01 · Fuga de colores heredados (*Legacy Teal*) frente al sistema *Academic Neo-Vibrant*
- **Categoría UI/UX Pro Max:** `Style & Color Consistency` · **Severidad:** Alta
- **Archivos afectados:**
  - [App.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.css#L11-L245) (reglas iniciales de `.topbar`, `.nav-actions`, `.hero-card`, `.metric-card` con `#0f766e`, `#123e36`, `#edf5f2` que luego son sobreescritas más abajo en el mismo archivo).
  - [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx#L211-L244) (botones de pestaña «Por código UUID» y «Por # pedido + contacto» con bordes y fondos inline `#0f766e` y `#f0fdfa`).
  - [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx#L54-L93) (estado vacío y texto de carga con colores inline `#557571`, `#0f3d3e` y `#b2ded6`).
  - [PagoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/PagoPage.tsx#L211-L220) (recuadro de tarjeta de prueba con `#f8faf9`, `#b2d8d0`, `#1d433d`).
- **Problema:** Rompe la unidad cromática definida en [DESIGN.md](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/DESIGN.md) y duplica reglas CSS en [App.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.css) (~240 líneas iniciales obsoletas).
- **Recomendación:**
  1. Declarar variables CSS globales en [index.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/index.css) con los tokens de [DESIGN.md](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/DESIGN.md) (`--color-surface: #fbf9f5`, `--color-primary: #c0d901`, `--color-dark: #121212`, `--color-text: #1b1c1a`, `--color-muted: #767961`, `--color-border: #e5e5e7`).
  2. Depurar el bloque duplicado de las líneas 1–245 en [App.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.css) y reemplazar los colores inline de seguimiento, catálogo y pago por clases alineadas con la paleta institucional.

---

### H-02 · Ausencia de *Skeleton Screens* durante la carga asíncrona
- **Categoría UI/UX Pro Max:** `UX Guidelines · Loading States` · **Severidad:** Alta
- **Archivos afectados:**
  - [ListaRestaurantes.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaRestaurantes.tsx#L36-L38) (`if (cargando) return <p>Cargando restaurantes...</p>`)
  - [RestaurantMenuPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/RestaurantMenuPage.tsx#L47) (`if (cargando) return <div className="restaurant-menu-state">Cargando menú...</div>`)
  - [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx#L52-L58) (`Cargando menú de la cafetería...`)
- **Problema:** Mostrar una sola línea de texto mientras responde la API deja la pantalla casi vacía y provoca un salto brusco de layout (*CLS*) cuando se renderizan las cuadrículas de cafeterías o productos, además de empujar el `SiteFooter` hacia arriba y luego hacia abajo.
- **Recomendación:** Implementar tarjetas esqueleto (`.skeleton-card`) con animación de pulso suave (`background: linear-gradient(90deg, #efeeea 25%, #e4e2de 50%, #efeeea 75%)`) que respeten la altura de `CardRestaurante` y `CardProducto`.

---

### H-03 · Contenedor con scroll interno fijo (`maxHeight: 600px`) en el catálogo de productos
- **Categoría UI/UX Pro Max:** `Layout & Mobile Interaction` · **Severidad:** Alta
- **Archivo afectado:** [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx#L116-L127)
- **Problema:** El contenedor `.product-catalog__grid` define en línea `maxHeight: "600px"` y `overflowY: "auto"`. En escritorio produce dos barras de scroll paralelas (la del navegador y la interna del catálogo), mientras que en dispositivos móviles atrapa el gesto táctil vertical e impide desplazarse con naturalidad hacia el resumen del pedido.
- **Recomendación:** Eliminar `maxHeight: "600px"` y `overflowY: "auto"` del estilo inline en [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx#L118-L126) y delegar la grilla a `RestaurantMenuPage.css` / `CardProducto.css`, permitiendo que el scroll principal de la página fluya mientras el panel lateral `ResumenPedido` permanece fijo con `position: sticky; top: 24px` en escritorio.

---

### H-04 · Gestión de foco y bloqueo de scroll de fondo en el modal de detalle de producto
- **Categoría UI/UX Pro Max:** `Web Interface · Focus & Keyboard Handlers` · **Severidad:** Alta
- **Archivo afectado:** [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx#L31-L40) y [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx#L80-L124)
- **Problema:** Cuando se abre `.product-detail-modal`:
  1. El fondo (`document.body`) sigue siendo desplazable detrás del modal.
  2. El foco del teclado permanece en la tarjeta de fondo en lugar de trasladarse al modal (por ejemplo, al botón de cierre o al contenedor del diálogo), y al presionar `Tab` el usuario puede salir del modal hacia elementos ocultos detrás del `backdrop`.
- **Recomendación:** En el `useEffect` de `modalAbierto` en [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx#L31-L40), bloquear temporalmente `document.body.style.overflow = 'hidden'`, enfocar el primer elemento interactivo del modal al abrirse y devolver el foco al botón «Ver detalles» al cerrarse.

---

### H-05 · Semántica de entradas y autocompletado en el checkout del cliente
- **Categoría UI/UX Pro Max:** `Web Interface · Semantic Input Types & Autocomplete` · **Severidad:** Alta
- **Archivo afectado:** [FormularioCliente.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/FormularioCliente.tsx#L172-L224)
- **Problema:**
  - El input `#cliente-telefono` usa `type="text"` en vez de `type="tel"` e `inputMode="numeric"`, lo que en móviles abre el teclado alfabético completo en lugar del teclado numérico telefónico.
  - Ninguno de los tres campos (`#cliente-nombre`, `#cliente-telefono`, `#cliente-correo`) incluye el atributo `autoComplete` (`name`, `tel`, `email`), obligando al estudiante a teclear manualmente sus datos en cada compra.
- **Recomendación:** Añadir `autoComplete="name"`, `type="tel" inputMode="numeric" autoComplete="tel"` y `autoComplete="email"` en [FormularioCliente.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/FormularioCliente.tsx#L174-L218).

---

## 3. Hallazgos de Prioridad Media y Pulido Visual

### H-06 · Reemplazo de estilos `style={{ ... }}` por clases CSS reutilizables
- **Categoría UI/UX Pro Max:** `Maintainability & Hover/Focus States` · **Severidad:** Media
- **Archivos afectados:**
  - [PagoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/PagoPage.tsx#L191-L263) (tarjetas de resumen de pago, bloque sandbox de Stripe y botón de pago tienen estilos inline, por lo que el botón «Pagar con Stripe» carece de estado `:hover` y `:focus-visible` propios).
  - [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx#L204-L245) (selector segmentado de modo de búsqueda estilizado en línea).
  - [ConfigurarInvitacionPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ConfigurarInvitacionPage.tsx#L84-L99) y [RevisarSolicitudPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/RevisarSolicitudPage.tsx#L125).
- **Recomendación:** Extraer estos bloques a clases semánticas en [FormularioCliente.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/FormularioCliente.css) y [SeguimientoPedidoPage.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.css) con transiciones suaves (`180ms ease`) y estados `:hover` / `:focus-visible`.

---

### H-07 · Carga diferida (`loading="lazy"`) y manejo de fallo de imagen (`onError`)
- **Categoría UI/UX Pro Max:** `Web Performance · Lazy Load Images` · **Severidad:** Media
- **Archivos afectados:**
  - [CardRestaurante.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardRestaurante.tsx#L56-L60)
  - [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx#L53)
- **Problema:** Todas las imágenes de cafeterías y productos se descargan de forma ansiosa (*eager*) al montar la vista, y si una URL externa o imagen cargada falla, el navegador muestra el ícono de imagen rota.
- **Recomendación:** Añadir `loading="lazy"` y `decoding="async"` en las tarjetas de catálogo, junto con un manejador `onError` que asigne la imagen de respaldo (`DEFAULT_IMAGE` o `getProductFallbackImage`).

---

### H-08 · Accesibilidad de movimiento (`prefers-reduced-motion`) y anillo `:focus-visible` unificado
- **Categoría UI/UX Pro Max:** `Accessibility · Motion & Focus Ring` · **Severidad:** Media
- **Archivos afectados:** [index.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/index.css) y [App.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.css)
- **Problema:** No existe una regla global `@media (prefers-reduced-motion: reduce)` para usuarios con sensibilidad vestibular, y algunos botones/tarjetas interactivas (`CardRestaurante` con `role="button"`) no muestran un anillo de foco de alto contraste al navegar con teclado (`Tab`).
- **Recomendación:** Agregar en [index.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/index.css):
  ```css
  :focus-visible {
    outline: 2px solid #c0d901;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

---

### H-09 · Inicialización perezosa de `localStorage` durante el render en React
- **Categoría UI/UX Pro Max:** `React Stack · Initialize state lazily` · **Severidad:** Media
- **Archivos afectados:**
  - [App.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.tsx#L636-L648) (`HistorialPage`)
  - [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx#L59-L68) (`ultimoPedidoGuardado`)
- **Problema:** Se invoca una IIFE `(() => { localStorage.getItem(...) })()` directamente en el cuerpo de la función del componente, ejecutando `JSON.parse` y lectura de disco en cada re-renderizado (por ejemplo, cada vez que el usuario escribe una letra en el input de seguimiento).
- **Recomendación:** Envolver la lectura en `useMemo(..., [])` o `useState(() => ...)` para que solo se evalúe al montar el componente.

---

### H-10 · Anuncios `aria-live="polite"` e indicador de sincronización en vistas de tiempo real
- **Categoría UI/UX Pro Max:** `Web Interface · Aria Live & Real-Time Feedback` · **Severidad:** Media
- **Archivos afectados:**
  - [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx#L280-L365)
  - [DashboardCocina.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/DashboardCocina.tsx#L340-L435)
- **Problema:** Ambas vistas consultan el servidor cada 10 segundos (`setInterval`), pero el contenedor del estado del pedido no declara `aria-live="polite"` para lectores de pantalla ni muestra la hora de última sincronización o un botón de actualización manual inmediata.
- **Recomendación:** Añadir `aria-live="polite"` en la tarjeta de estado de seguimiento y en los contadores de columnas de cocina, junto con un indicador discreto de sincronización activa.

---

## 4. Plan de Implementación Recomendado

| Fase | Objetivo | Archivos a intervenir |
| :--- | :--- | :--- |
| **Fase 1 · Sistema de Diseño y Limpieza CSS** | Unificar variables CSS según `DESIGN.md`, eliminar el bloque legacy teal (`#0f766e`) de `App.css` y migrar estilos inline de `PagoPage`, `SeguimientoPedidoPage` y `ListaProductos` a clases CSS. | [index.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/index.css), [App.css](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.css), [PagoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/PagoPage.tsx), [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx), [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx) |
| **Fase 2 · UX de Catálogo, Skeletons y Flujo de Compra** | Eliminar el scroll interno de `600px` en `ListaProductos`, incorporar *skeletons* de carga en directorio y menú, y agregar `loading="lazy"` + fallback `onError` en imágenes. | [ListaRestaurantes.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaRestaurantes.tsx), [RestaurantMenuPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/RestaurantMenuPage.tsx), [ListaProductos.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/ListaProductos.tsx), [CardRestaurante.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardRestaurante.tsx), [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx) |
| **Fase 3 · Accesibilidad, Formularios y Rendimiento React** | Bloqueo de scroll y gestión de foco en el modal de `CardProducto`, `type="tel"` + `autoComplete` en `FormularioCliente`, `prefers-reduced-motion` + `:focus-visible` global, `aria-live="polite"` y lectura perezosa de `localStorage`. | [CardProducto.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/CardProducto.tsx), [FormularioCliente.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/FormularioCliente.tsx), [SeguimientoPedidoPage.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/SeguimientoPedidoPage.tsx), [DashboardCocina.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/components/DashboardCocina.tsx), [App.tsx](file:///c:/Users/andre/OneDrive/Escritorio/universidad/proyecto-tic1/P_upbFood/Frontend/src/App.tsx) |


// Ejecuta los criterios del plan de pruebas de UPB Food que estaban en estado
// PENDIENTE (198 criterios, HU001–HU031) contra la aplicación levantada con Docker.
//
// Uso (desde P_upbFood/QA):  npm install  →  npm test
// Resultado: resultados/Plan_de_Pruebas_UPB_resultados.xlsx y resultados/reporte.md
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import {
  QA_DIR, config, api, login, conectarBd, sha256, dormir, registrarPeticionNavegador,
} from './lib/entorno.mjs'
import { caso, ok, error, pendiente, verificar, escribirResultados } from './lib/resultados.mjs'

const INICIO = new Date()
const R1 = config.restaurante1
const R2 = config.restaurante2
const TS = Date.now().toString(36)
const CAPTURAS = path.join(QA_DIR, 'resultados', 'capturas')
fs.mkdirSync(CAPTURAS, { recursive: true })

const CLIENTE = {
  clienteNombre: 'QA Automatizado',
  clienteTelefono: `31${String(Date.now()).slice(-8)}`,
  clienteCorreo: `qa.${TS}@upb.edu.co`,
}
// PNG de 2x2 px usado como imagen de producto.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PRECIO_8500 = /\$\s?8\.500/

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------
const limpieza = []
let db = null
let browser = null
const s = {} // estado compartido entre pruebas

const espera = async (fn, { timeout = 15_000, intervalo = 500 } = {}) => {
  const fin = Date.now() + timeout
  let ultimo
  while (Date.now() < fin) {
    ultimo = await fn()
    if (ultimo) return ultimo
    await dormir(intervalo)
  }
  return ultimo
}

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje)
}

function horaBogota(minutosAdelante) {
  const fecha = new Date(Date.now() + minutosAdelante * 60_000)
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(fecha).map((p) => [p.type, p.value]),
  )
  const minutos = Math.ceil(Number(partes.minute) / 15) * 15
  const base = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), Number(partes.hour), minutos))
  return base.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm (hora de Bogotá)
}

async function crearPedido({ restauranteId = R1, items, horaRecogida } = {}) {
  const r = await api('POST', '/api/pedidos', {
    body: { restauranteId, ...CLIENTE, horaRecogida: horaRecogida ?? null, items },
  })
  return r
}

async function pedidoNuevo(items, opciones = {}) {
  const r = await crearPedido({ items, ...opciones })
  exigir(r.status === 201, `No se pudo crear el pedido de prueba: HTTP ${r.status} ${r.data?.message ?? ''}`)
  return r.data
}

async function pagar(pedido, tipoPagoId = 1) {
  const r = await api('PUT', `/api/pedidos/seguimiento/${pedido.codigoSeguimiento}/pago`, {
    body: { tipoPagoId, monto: Number(pedido.total) },
  })
  exigir(r.status === 200, `No se pudo pagar el pedido #${pedido.id}: HTTP ${r.status} ${r.data?.message ?? ''}`)
  return r.data
}

const cambiarEstado = (token, id, estado) =>
  api('PATCH', `/api/admin/pedidos/${id}/estado`, { token, body: { estado } })

const consultarPedido = (codigo) => api('GET', `/api/pedidos/seguimiento/${codigo}`)

async function productosPublicos(restauranteId) {
  const r = await api('GET', `/api/productos?restauranteId=${restauranteId}`)
  return Array.isArray(r.data) ? r.data : []
}

async function restaurantes() {
  const r = await api('GET', '/api/restaurantes')
  return Array.isArray(r.data) ? r.data : []
}

async function configurarRestaurante(token, id, cambios) {
  return api('PATCH', `/api/admin/restaurantes/${id}`, { token, body: cambios })
}

async function crearProducto(token, datos) {
  const r = await api('POST', '/api/products', {
    token,
    body: {
      descripcion: 'Producto creado por el plan de pruebas automático',
      disponible: true,
      restauranteId: R1,
      imagenUrl: null,
      ...datos,
    },
  })
  exigir(r.status === 201, `No se pudo crear ${datos.nombre}: HTTP ${r.status} ${r.data?.message ?? ''}`)
  return r.data
}

const actualizarDisponibilidad = (token, id, disponible, restauranteId = R1) =>
  api('PATCH', `/api/productos/${id}/disponibilidad?restauranteId=${restauranteId}`, { token, body: { disponible } })

function itemCarrito(producto, { adiciones = [], cantidad = 1, observaciones = '' } = {}) {
  const extras = [...adiciones].map((e) => Number(e.id)).sort((a, b) => a - b)
  return {
    id: Number(producto.id),
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: Number(producto.precio),
    restauranteId: R1,
    tiempoEstimadoMin: 15,
    imagenUrl: producto.imagenUrl ?? undefined,
    adiciones,
    ingredientesExtra: producto.ingredientesExtra ?? [],
    cantidad,
    observaciones,
    cartKey: `${producto.id}:${extras.join(',')}`,
  }
}

async function nuevaPagina({ viewport = { width: 1366, height: 900 }, sesion, almacenamiento } = {}) {
  const contexto = await browser.newContext({ viewport, locale: 'es-CO', timezoneId: 'America/Bogota' })
  if (sesion?.refresh) {
    await contexto.addCookies([{ name: 'upbfood_refresh_token', value: sesion.refresh, url: `${config.frontUrl}/api/admin` }])
  }
  if (almacenamiento) {
    await contexto.addInitScript((datos) => {
      if (sessionStorage.getItem('__qa_init')) return
      for (const [clave, valor] of Object.entries(datos)) localStorage.setItem(clave, JSON.stringify(valor))
      sessionStorage.setItem('__qa_init', '1')
    }, almacenamiento)
  }
  const page = await contexto.newPage()
  page.setDefaultTimeout(12_000)
  const erroresJs = []
  page.on('pageerror', (e) => erroresJs.push(e.message))
  page.on('dialog', (d) => void d.accept())
  page.on('request', (req) => {
    try {
      const u = new URL(req.url())
      if (u.pathname.startsWith('/api/')) registrarPeticionNavegador(req.method(), u.pathname)
    } catch { /* ignorar */ }
  })
  return { contexto, page, erroresJs }
}

async function captura(page, nombre) {
  try {
    await page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true })
  } catch { /* la captura es solo evidencia */ }
}

async function sinDesbordeHorizontal(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
}

async function probarResponsive(page, nombre) {
  const tamanos = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 900 }]
  const fallos = []
  for (const t of tamanos) {
    await page.setViewportSize(t)
    await dormir(350)
    if (!(await sinDesbordeHorizontal(page))) fallos.push(`${t.width}px`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await captura(page, `${nombre}-movil`)
  await page.setViewportSize({ width: 1366, height: 900 })
  return fallos
}

const reTexto = (texto) => new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
const tarjetaPedido = (page, id) => page.locator('.pedido-card').filter({ hasText: new RegExp(`Pedido #${id}(?!\\d)`) })
const columna = (page, nombre) => page.locator('.kanban-column').filter({ has: page.locator('h2', { hasText: nombre }) })

// ----------------------------------------------------------------------------
// Preparación
// ----------------------------------------------------------------------------
async function preparar() {
  console.log(`Frontend: ${config.frontUrl}  ·  API: ${config.apiUrl}`)
  const salud = await api('GET', '/api/restaurantes').catch((e) => ({ status: 0, data: e.message }))
  if (salud.status !== 200) {
    throw new Error(`El backend no responde en ${config.apiUrl} (HTTP ${salud.status}). Levanta la aplicación con "docker compose up --build -d" desde P_upbFood.`)
  }
  const front = await fetch(config.frontUrl).then((r) => r.status).catch(() => 0)
  if (front !== 200) {
    throw new Error(`El frontend no responde en ${config.frontUrl}. Revisa FRONTEND_PORT o define QA_FRONT_URL.`)
  }

  try {
    db = await conectarBd()
  } catch (e) {
    console.log(`⚠ No hay conexión directa a PostgreSQL (${e.message}). Los criterios que revisan la base quedarán PENDIENTE.`)
  }

  s.dueno1 = await login(config.dueno1)
  s.dueno2 = await login(config.dueno2)

  const lista = await restaurantes()
  s.r1Original = lista.find((r) => Number(r.id) === R1)
  s.r2Original = lista.find((r) => Number(r.id) === R2)
  exigir(s.r1Original && s.r2Original, `No existen los restaurantes ${R1} y ${R2}.`)
  limpieza.push(async () => {
    const o = s.r1Original
    await configurarRestaurante(s.dueno1.token, R1, {
      nombre: o.nombre, ubicacion: o.ubicacion, estado: o.estado, tiempoEstimadoMin: o.tiempoEstimadoMin,
      imagenUrl: o.imagenUrl ?? '', horario: o.horario ?? '',
    })
  })
  if (s.r1Original.estado !== 'Abierto') await configurarRestaurante(s.dueno1.token, R1, { estado: 'Abierto' })

  // Productos y extras de prueba en el restaurante 1.
  s.extra1 = await crearProducto(s.dueno1.token, { nombre: `QA Queso ${TS}`, precio: 1500, categoriaId: 4 })
  s.extra2 = await crearProducto(s.dueno1.token, { nombre: `QA Tocineta ${TS}`, precio: 2000, categoriaId: 4 })
  s.prodA = await crearProducto(s.dueno1.token, {
    nombre: `QA Sándwich ${TS}`, descripcion: 'Sándwich de prueba con queso y tomate', precio: 8500, categoriaId: 3, imagenUrl: PNG_DATA_URL,
  })
  s.prodB = await crearProducto(s.dueno1.token, { nombre: `QA Jugo ${TS}`, descripcion: 'Jugo de prueba', precio: 4000, categoriaId: 2 })
  const extras = await api('PUT', `/api/productos/${s.prodA.id}/extras?restauranteId=${R1}`, {
    token: s.dueno1.token, body: { adiciones: [s.extra1.id, s.extra2.id] },
  })
  exigir(extras.status === 200, `No se pudieron asignar los extras de prueba: HTTP ${extras.status}`)
  s.prodAPublico = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
  s.prodBPublico = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodB.id))
  exigir(s.prodAPublico && s.prodBPublico, 'Los productos de prueba no aparecen en el menú público.')
  limpieza.push(async () => {
    for (const p of [s.prodA, s.prodB, s.extra1, s.extra2]) {
      await actualizarDisponibilidad(s.dueno1.token, p.id, false).catch(() => null)
      await api('DELETE', `/api/products/${p.id}?restauranteId=${R1}`, { token: s.dueno1.token }).catch(() => null)
    }
  })

  // Administrador de cocina de prueba.
  s.cocinaCredenciales = { email: `qa.cocina.${TS}@upb.edu.co`, password: 'QaCocina123' }
  const cocina = await api('POST', `/api/admin/restaurantes/${R1}/administradores-cocina`, {
    token: s.dueno1.token,
    body: { nombre: 'QA Cocina', telefono: '3000000099', correo: s.cocinaCredenciales.email, password: s.cocinaCredenciales.password },
  })
  s.cocinaCreacion = cocina
  exigir(cocina.status === 200, `No se pudo crear el administrador de cocina de prueba: HTTP ${cocina.status} ${cocina.data?.message ?? ''}`)
  s.cocinaId = cocina.data.administradorId
  limpieza.push(() => api('DELETE', `/api/admin/restaurantes/${R1}/administradores-cocina/${s.cocinaId}`, { token: s.dueno1.token }))
  s.cocina = await login(s.cocinaCredenciales)

  s.productoR2 = (await productosPublicos(R2)).find((p) => p.disponible !== false)
  browser = await chromium.launch({ headless: config.headless })
}

// ----------------------------------------------------------------------------
// Pruebas
// ----------------------------------------------------------------------------
async function pruebasCatalogoCliente() {
  await caso('HU001 · Buscador de cafeterías', [5, 6, 7], async () => {
    const { contexto, page } = await nuevaPagina()
    await page.goto(config.frontUrl + '/')
    await page.locator('.restaurant-card').first().waitFor()
    const buscador = page.getByLabel('Buscar cafetería por nombre o ubicación')
    const totalInicial = await page.locator('.restaurant-card').count()

    const fragmento = s.r1Original.nombre.slice(0, 6)
    await buscador.fill(fragmento.toLowerCase())
    const textos = await page.locator('.restaurant-card').allInnerTexts()
    verificar(5, textos.length > 0 && textos.every((t) => t.toLowerCase().includes(fragmento.toLowerCase())),
      `Con "${fragmento.toLowerCase()}" se muestran ${textos.length} de ${totalInicial} cafeterías y todas coinciden por nombre.`,
      `El filtro por nombre no funcionó: ${textos.length} tarjetas visibles.`)

    await buscador.fill(s.r1Original.ubicacion)
    const porUbicacion = await page.locator('.restaurant-card').allInnerTexts()
    await buscador.fill('Abierto')
    const porEstado = await page.locator('.restaurant-card .restaurant-card__status').allInnerTexts()
    verificar(6,
      porUbicacion.some((t) => t.includes(s.r1Original.nombre)) && porEstado.length > 0 && porEstado.every((t) => /abierto/i.test(t)),
      `Ubicación "${s.r1Original.ubicacion}": ${porUbicacion.length} resultado(s). Estado "Abierto": ${porEstado.length} resultado(s), todos abiertos.`,
      `Filtro por ubicación/estado incorrecto (ubicación: ${porUbicacion.length}, estado: ${porEstado.join(', ')}).`)

    await buscador.fill('zzzz')
    const vacio = page.locator('.restaurant-empty')
    verificar(7, await vacio.isVisible(), `Mensaje mostrado: "${await vacio.innerText()}"`, 'No aparece mensaje sin resultados.')
    await captura(page, 'HU001-buscador')
    await contexto.close()
  })

  await caso('HU004 / HU005 · Menú, buscador y card de producto', [32, 33, 41, 42, 43, 44], async () => {
    const { contexto, page } = await nuevaPagina()
    await page.goto(`${config.frontUrl}/restaurante/${R1}`)
    await page.locator('.product-card').first().waitFor()
    const buscador = page.getByPlaceholder('Busca un plato, bebida o extra')
    await buscador.fill('sándwich ' + TS)
    const visibles = await page.locator('.product-card h3').allInnerTexts()
    verificar(32, visibles.length === 1 && visibles[0] === s.prodA.nombre,
      `Búsqueda "sándwich ${TS}": solo aparece "${visibles[0]}".`, `Resultados inesperados: ${visibles.join(', ')}`)
    await buscador.fill('zzzz')
    const vacio = page.locator('.product-search__empty')
    verificar(33, await vacio.isVisible(), `Mensaje: "${await vacio.innerText()}"`, 'No aparece mensaje sin resultados.')
    await buscador.fill(s.prodA.nombre)

    const card = page.locator('.product-card').filter({ hasText: s.prodA.nombre })
    const imgOk = await card.locator('img.product-card__image').evaluate((img) => img.complete && img.naturalWidth > 0)
    const desc = await card.locator('.product-card__content p').first().innerText()
    verificar(41, imgOk && desc.includes('Sándwich de prueba'),
      'La card muestra imagen cargada, nombre y descripción del producto.', `Imagen cargada: ${imgOk}; descripción: "${desc}"`)
    const precio = await card.locator('.product-card__price').innerText()
    verificar(42, PRECIO_8500.test(precio), `Precio mostrado: "${precio}" (formato COP).`, `Precio con formato inesperado: "${precio}"`)

    await card.getByRole('button', { name: 'Ver detalles' }).click()
    const extra = page.locator('.product-detail-extra').filter({ hasText: s.extra1.nombre })
    const textoExtra = await extra.innerText()
    verificar(43, /\$\s?1\.500/.test(textoExtra), `Selector de adiciones: "${textoExtra.replace(/\s+/g, ' ')}"`, `Adición sin precio: "${textoExtra}"`)
    await extra.locator('input[type=checkbox]').check()
    await page.locator('.product-detail-add').click()
    const carrito = await page.evaluate(() => JSON.parse(localStorage.getItem('upbfood.cart') ?? '[]'))
    const linea = carrito.find((i) => Number(i.id) === Number(s.prodA.id))
    verificar(44, linea && linea.adiciones?.some((a) => Number(a.id) === Number(s.extra1.id)),
      `El carrito guarda el producto con la adición "${s.extra1.nombre}".`, 'La adición no quedó asociada al producto del carrito.')
    await captura(page, 'HU005-card-producto')

    // HU006: mezcla de cafeterías (el carrito ya tiene un producto del restaurante 1).
    s.contextoCarrito = { contexto, page }
  })

  await caso('HU006 · Carrito de una sola cafetería', [49, 50], async () => {
    exigir(s.contextoCarrito, 'La prueba anterior no dejó un carrito con productos de la primera cafetería.')
    const { contexto, page } = s.contextoCarrito
    if (!s.productoR2) {
      pendiente(49, `El restaurante ${R2} no tiene productos disponibles para intentar la mezcla.`)
      pendiente(50, `El restaurante ${R2} no tiene productos disponibles para intentar la mezcla.`)
      await contexto.close()
      return
    }
    const r2 = await restaurantes()
    if (r2.find((r) => Number(r.id) === R2)?.estado === 'Cerrado') {
      await configurarRestaurante(s.dueno2.token, R2, { estado: 'Abierto' })
      limpieza.push(() => configurarRestaurante(s.dueno2.token, R2, { estado: 'Cerrado' }))
    }
    await page.goto(`${config.frontUrl}/restaurante/${R2}`)
    const card = page.locator('.product-card').filter({ hasText: s.productoR2.nombre })
    await card.getByRole('button', { name: 'Ver detalles' }).click()
    await page.locator('.product-detail-add').click()
    const carrito = await page.evaluate(() => JSON.parse(localStorage.getItem('upbfood.cart') ?? '[]'))
    verificar(49, carrito.every((i) => Number(i.restauranteId) === R1),
      `El carrito conserva solo productos de la cafetería ${R1}; el producto de la cafetería ${R2} no se agregó.`,
      'El carrito permitió mezclar productos de dos cafeterías.')
    const alerta = page.locator('.cart-error')
    verificar(50, await alerta.isVisible(), `Mensaje mostrado: "${await alerta.innerText()}"`, 'No se mostró mensaje de error al mezclar cafeterías.')
    await captura(page, 'HU006-mezcla-cafeterias')
    await contexto.close()
  })

  await caso('HU007 / HU008 · Revisión del pedido en tres pasos', [53, 54, 55, 64, 65], async () => {
    const cart = [
      itemCarrito(s.prodAPublico, { adiciones: [{ id: s.extra1.id, nombre: s.extra1.nombre, precio: 1500 }] }),
      itemCarrito(s.prodBPublico),
    ]
    const { contexto, page } = await nuevaPagina({ almacenamiento: { 'upbfood.cart': cart } })
    await page.goto(config.frontUrl + '/pedido')
    await page.locator('.order-item').first().waitFor()
    const pasos = await page.locator('.order-steps').innerText()
    verificar(53, /Pedido/.test(pasos) && /Datos/.test(pasos) && /Pago/.test(pasos),
      `Indicador visible: ${pasos.replace(/\s+/g, ' ')}`, `Indicador incompleto: ${pasos}`)

    const carrito = () => page.evaluate(() => JSON.parse(localStorage.getItem('upbfood.cart') ?? '[]'))
    await page.getByRole('button', { name: `Agregar una unidad de ${s.prodB.nombre}` }).click()
    const tras1 = (await carrito()).find((i) => Number(i.id) === Number(s.prodB.id))?.cantidad
    await page.getByRole('button', { name: `Quitar una unidad de ${s.prodB.nombre}` }).click()
    const tras2 = (await carrito()).find((i) => Number(i.id) === Number(s.prodB.id))?.cantidad
    const itemA = page.locator('.order-item').filter({ hasText: s.prodA.nombre })
    await itemA.locator('.order-item__notes textarea').fill('Nota QA para cocina')
    const nota = (await carrito()).find((i) => Number(i.id) === Number(s.prodA.id))?.observaciones ?? ''
    await page.getByRole('button', { name: `Eliminar ${s.prodB.nombre}` }).click()
    const quedan = await carrito()
    verificar(54, tras1 === 2 && tras2 === 1 && nota.includes('Nota QA') && !quedan.some((i) => Number(i.id) === Number(s.prodB.id)),
      'Se aumentó a 2, se redujo a 1, se guardó la observación y se eliminó el producto.',
      `Cantidad tras +: ${tras1}, tras −: ${tras2}, nota: "${nota}", eliminado: ${!quedan.some((i) => Number(i.id) === Number(s.prodB.id))}`)

    const seguir = page.getByRole('button', { name: 'Seguir explorando cafeterías' })
    verificar(55, (await seguir.isVisible()) && (await page.locator('.order-checklist').isVisible()),
      'Se muestran el botón "Seguir explorando cafeterías" y las notas informativas.', 'Falta el botón o las notas informativas.')

    // HU008: editar extras e ingredientes desde la revisión.
    const editor = itemA.locator('.order-item__extras-editor')
    const marcado1 = await editor.getByLabel(new RegExp(s.extra1.nombre)).isChecked()
    await editor.getByLabel(new RegExp(s.extra2.nombre)).check()
    const tras = (await carrito()).find((i) => Number(i.id) === Number(s.prodA.id))
    const totalLinea = await page.locator('.order-item').filter({ hasText: s.prodA.nombre }).locator('.order-item__title-row span').innerText()
    verificar(64, marcado1 && tras?.adiciones?.length === 2 && /12\.000/.test(totalLinea),
      `Se muestra la adición elegida y se añadió "${s.extra2.nombre}"; el precio pasó a ${totalLinea}.`,
      `Adición inicial marcada: ${marcado1}; adiciones tras añadir: ${tras?.adiciones?.length}; precio: ${totalLinea}`)

    const itemA2 = page.locator('.order-item').filter({ hasText: s.prodA.nombre })
    await itemA2.locator('.order-item__extras-editor').getByLabel(new RegExp(s.extra1.nombre)).uncheck()
    await itemA2.getByLabel('Sin tomate').check()
    const final = (await carrito()).find((i) => Number(i.id) === Number(s.prodA.id))
    verificar(65, final?.adiciones?.length === 1 && final.observaciones.includes('Sin tomate'),
      `Se quitó "${s.extra1.nombre}" y se marcó "Sin tomate" (observación: "${final?.observaciones}").`,
      `Adiciones: ${final?.adiciones?.length}; observaciones: "${final?.observaciones}"`)
    await captura(page, 'HU008-revision-pedido')
    await contexto.close()
  })
}

async function pruebasPedidoYCliente() {
  await caso('HU009 / HU029 · Restricciones al crear pedidos', [72, 73, 74, 262], async () => {
    const item = [{ productoId: s.prodB.id, cantidad: 1 }]
    const cerrar = await configurarRestaurante(s.dueno1.token, R1, { estado: 'Cerrado' })
    exigir(cerrar.status === 200, `No se pudo cerrar la cafetería: HTTP ${cerrar.status}`)
    const r = await crearPedido({ items: item })
    const msg = String(r.data?.message ?? '')
    verificar(72, r.status === 400 && /cerrad/i.test(msg), `HTTP ${r.status}: "${msg}"`, `Se esperaba 400; se obtuvo HTTP ${r.status} "${msg}"`)
    verificar(262, r.status === 400 && /cerrad/i.test(msg), `Con estado Cerrado el backend rechaza el pedido (HTTP ${r.status}).`, `HTTP ${r.status}: "${msg}"`)

    const { contexto, page } = await nuevaPagina({ almacenamiento: { 'upbfood.cart': [itemCarrito(s.prodBPublico)] } })
    await page.goto(config.frontUrl + '/cliente')
    await page.locator('#cliente-nombre').fill(CLIENTE.clienteNombre)
    await page.locator('#cliente-telefono').fill(CLIENTE.clienteTelefono)
    await page.locator('#cliente-correo').fill(CLIENTE.clienteCorreo)
    await page.getByRole('button', { name: 'Continuar al pago' }).click()
    const aviso = page.locator('.mensaje-exito')
    await aviso.waitFor()
    const textoAviso = await aviso.innerText()
    verificar(74, /cerrad/i.test(textoAviso), `El cliente ve: "${textoAviso}"`, `Mensaje mostrado: "${textoAviso}"`)
    await captura(page, 'HU009-cafeteria-cerrada')
    await contexto.close()
    await configurarRestaurante(s.dueno1.token, R1, { estado: 'Abierto' })

    const otraCafeteria = await crearPedido({ restauranteId: R2, items: [{ productoId: s.prodA.id, cantidad: 1 }] })
    await actualizarDisponibilidad(s.dueno1.token, s.prodB.id, false)
    const agotado = await crearPedido({ items: item })
    await actualizarDisponibilidad(s.dueno1.token, s.prodB.id, true)
    verificar(73, otraCafeteria.status === 400 && agotado.status === 400,
      `Producto de otra cafetería: HTTP ${otraCafeteria.status}; producto agotado: HTTP ${agotado.status} ("${agotado.data?.message}").`,
      `Producto de otra cafetería: HTTP ${otraCafeteria.status}; agotado: HTTP ${agotado.status}`)
  })

  await caso('HU010 / HU011 · Datos del cliente, hora de recogida y paso al pago', [79, 82, 83, 84, 87, 88, 89, 90, 91, 92], async () => {
    const { contexto, page } = await nuevaPagina({ almacenamiento: { 'upbfood.cart': [itemCarrito(s.prodBPublico)] } })
    await page.goto(config.frontUrl + '/cliente')
    const boton = page.getByRole('button', { name: 'Continuar al pago' })
    const deshabilitadoVacio = await boton.isDisabled()

    await page.locator('#cliente-nombre').focus()
    await page.locator('#cliente-telefono').fill('123')
    await page.locator('#cliente-correo').fill('correo-invalido')
    await page.locator('.cliente-header').click()
    const mensajes = await page.locator('.campo .error').allInnerTexts()
    verificar(79, mensajes.length === 3,
      `Mensajes mostrados: ${mensajes.join(' · ')}`, `Se esperaban 3 mensajes; aparecieron ${mensajes.length}: ${mensajes.join(' · ')}`)
    const deshabilitadoInvalido = await boton.isDisabled()
    verificar(88, mensajes.some((m) => /correo/i.test(m)) && mensajes.some((m) => /celular/i.test(m)),
      'La información se valida al diligenciar los campos (celular y correo).', `Mensajes: ${mensajes.join(' · ')}`)
    verificar(90, deshabilitadoInvalido && page.url().endsWith('/cliente'),
      'Con errores el botón queda deshabilitado, no se avanza y se muestran los mensajes.', 'Se permitió avanzar con datos inválidos.')

    const horas = await page.locator('.pickup-time').allInnerTexts()
    const minutos = horas.map((h) => {
      const m = h.match(/(\d{1,2}):(\d{2})(?:\s*([ap]))?/i)
      if (!m) return NaN
      let hh = Number(m[1])
      if (m[3]) hh = (hh % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0)
      return hh * 60 + Number(m[2])
    })
    const difs = minutos.slice(1).map((v, i) => (v - minutos[i] + 1440) % 1440)
    verificar(82, horas.length > 1 && difs.every((d) => d === 15), `Opciones: ${horas.join(', ')} (cada 15 min).`, `Opciones: ${horas.join(', ')}`)
    verificar(83, difs.every((d) => d > 0 && d < 720), 'Las horas están en orden ascendente.', `Orden incorrecto: ${horas.join(', ')}`)

    await page.locator('#cliente-nombre').fill(CLIENTE.clienteNombre)
    await page.locator('#cliente-telefono').fill(CLIENTE.clienteTelefono)
    await page.locator('#cliente-correo').fill(CLIENTE.clienteCorreo)
    const habilitado = await boton.isEnabled()
    verificar(87, deshabilitadoVacio && deshabilitadoInvalido && habilitado,
      'Deshabilitado con campos vacíos o inválidos y habilitado con todos los datos correctos.',
      `Vacío: ${deshabilitadoVacio ? 'deshabilitado' : 'habilitado'}, inválido: ${deshabilitadoInvalido ? 'deshabilitado' : 'habilitado'}, válido: ${habilitado ? 'habilitado' : 'deshabilitado'}`)

    const t0 = Date.now()
    await boton.click()
    await page.waitForURL(/\/pago/, { timeout: 10_000 })
    const ms = Date.now() - t0
    verificar(89, page.url().includes('/pago'), `Redirigió a ${new URL(page.url()).pathname}.`, 'No redirigió al portal de pago.')
    verificar(91, ms <= 2000, `Navegación al pago en ${ms} ms.`, `La navegación tardó ${ms} ms (> 2 s).`)
    const ultimo = await page.evaluate(() => JSON.parse(localStorage.getItem('upbfood.lastOrder') ?? 'null'))
    const estado = ultimo ? (await consultarPedido(ultimo.codigoSeguimiento)).data?.estado : null
    verificar(92, estado === 'EN_PAGO', `El pedido #${ultimo?.id} quedó en estado ${estado}.`, `Estado del pedido: ${estado}`)
    s.pedidoUi = ultimo
    await captura(page, 'HU011-portal-pago')
    await contexto.close()

    const hora = horaBogota(90)
    const conHora = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }], { horaRecogida: hora })
    const sinHora = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    const consultaCon = (await consultarPedido(conHora.codigoSeguimiento)).data
    const consultaSin = (await consultarPedido(sinHora.codigoSeguimiento)).data
    // La API puede devolver la hora en UTC (con "Z"); se compara el instante, no el texto.
    const instante = (v) => {
      const t = String(v ?? '')
      return Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t.slice(0, 19)}-05:00`)
    }
    verificar(84, instante(consultaCon?.horaRecogida) === Date.parse(`${hora}:00-05:00`) && Boolean(consultaSin?.horaRecogida),
      `Con hora ${hora} se guardó ${consultaCon?.horaRecogida}; sin hora el sistema asignó ${consultaSin?.horaRecogida}.`,
      `Con hora: ${consultaCon?.horaRecogida}; sin hora: ${consultaSin?.horaRecogida}`)
    s.pedidoConHora = { ...conHora, hora }
  })
}

async function pruebasCocina() {
  await caso('HU014 / HU015 · Tablero y tarjetas de cocina', [
    66, 110, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133,
    134, 135, 136, 137, 138, 139, 140, 141, 142,
  ], async () => {
    const t = s.cocina.token
    const nuevo = await pedidoNuevo([{ productoId: s.prodA.id, cantidad: 1, adiciones: [s.extra1.id], observaciones: 'Sin tomate' }], { horaRecogida: horaBogota(60) })
    await pagar(nuevo)
    const prep = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 2 }])
    await pagar(prep)
    await cambiarEstado(t, prep.id, 'EN_PREPARACION')
    const listo = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    await pagar(listo)
    await cambiarEstado(t, listo.id, 'EN_PREPARACION')
    await cambiarEstado(t, listo.id, 'LISTO')
    const sinPago = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    s.pedidoAdiciones = nuevo

    // HU008: el detalle de cocina muestra lo añadido y lo quitado.
    const lista = await api('GET', `/api/admin/pedidos?restauranteId=${R1}`, { token: t })
    const det = (lista.data ?? []).find((p) => p.id === nuevo.id)?.details?.[0]
    const apiOk = det && String(det.adiciones).includes(s.extra1.nombre) && String(det.observaciones).includes('Sin tomate')

    const { contexto, page } = await nuevaPagina({ sesion: s.cocina })
    s.cocinaUiRefresh = true
    await page.goto(config.frontUrl + '/admin/cocina')
    await page.locator('.kanban-board').waitFor({ timeout: 20_000 })
    await tarjetaPedido(page, nuevo.id).waitFor({ timeout: 15_000 })
    await page.mouse.move(0, 0)
    const cardNuevo = tarjetaPedido(page, nuevo.id)

    const extraUi = await cardNuevo.locator('.pedido-card__extra').innerText().catch(() => '')
    const notaUi = await cardNuevo.locator('.pedido-card__nota').innerText().catch(() => '')
    verificar(66, apiOk && extraUi.includes(s.extra1.nombre) && notaUi.includes('Sin tomate'),
      `La tarjeta muestra "${extraUi}" y "${notaUi}".`, `API: ${JSON.stringify(det)}; tarjeta: "${extraUi}" / "${notaUi}"`)

    const titulos = await page.locator('.kanban-column h2').allInnerTexts()
    verificar(123, titulos.length === 3 && /Nuevos/.test(titulos[0]) && /preparaci/i.test(titulos[1]) && /Listos/.test(titulos[2]),
      `Columnas: ${titulos.join(' | ')}`, `Columnas encontradas: ${titulos.join(' | ')}`)
    const conteos = []
    for (const nombre of ['Nuevos', 'En preparación', 'Listos']) {
      const col = columna(page, nombre)
      const h2 = await col.locator('h2').innerText()
      const n = await col.locator('.pedido-card').count()
      conteos.push({ h2, n, ok: h2.includes(`(${n})`) })
    }
    verificar(110, conteos.every((c) => c.ok), conteos.map((c) => c.h2).join(' · '), conteos.map((c) => `${c.h2} vs ${c.n} tarjetas`).join(' · '))

    const notaDebajo = await cardNuevo.locator('li').first().evaluate((li) => {
      const p = li.querySelector('.pedido-card__producto')
      const n = li.querySelector('.pedido-card__nota')
      return Boolean(p && n && p.getBoundingClientRect().bottom <= n.getBoundingClientRect().top + 1)
    })
    verificar(115, notaDebajo, 'La observación aparece en una línea debajo del producto.', 'La observación no aparece debajo del producto.')
    verificar(129, notaDebajo, 'La observación aparece debajo del producto en la tarjeta.', 'La observación no aparece debajo del producto.')

    const enNuevos = columna(page, 'Nuevos').locator('.pedido-card').filter({ hasText: new RegExp(`Pedido #${nuevo.id}(?!\\d)`) })
    const btnAceptar = enNuevos.getByRole('button', { name: 'Aceptar pedido e iniciar preparación' })
    const textoSinPago = await tarjetaPedido(page, sinPago.id).locator('.pedido-card__acciones button').first().innerText().catch(() => '')
    const aceptarVisible = await btnAceptar.isVisible()
    verificar(116, aceptarVisible, `Pedido nuevo pagado: botón "Aceptar pedido e iniciar preparación". Pedido sin pago: "${textoSinPago}".`, 'El pedido nuevo no muestra el botón Aceptar.')
    verificar(131, aceptarVisible, 'La tarjeta del pedido nuevo muestra "Aceptar pedido e iniciar preparación".', 'No se muestra el botón Aceptar.')
    const btnListo = tarjetaPedido(page, prep.id).getByRole('button', { name: 'Marcar como listo' })
    const btnEntregar = tarjetaPedido(page, listo.id).getByRole('button', { name: 'Marcar como entregado' })
    const flujo = (await btnListo.isVisible()) && (await btnEntregar.isVisible())
    const notaFlujo = 'El tablero tiene 3 columnas: "En preparación" muestra "Marcar como listo" y "Listos" muestra "Marcar como entregado".'
    verificar(117, flujo, notaFlujo, 'Faltan botones de avance en preparación/listos.')
    verificar(132, flujo, notaFlujo, 'Faltan botones de avance en preparación/listos.')

    const colores = [await btnAceptar.evaluate((b) => getComputedStyle(b).backgroundColor), await btnListo.evaluate((b) => getComputedStyle(b).backgroundColor)]
    verificar(118, colores[0] !== colores[1], `Colores: aceptar ${colores[0]}, avanzar ${colores[1]}.`, `Mismo color en ambos botones: ${colores[0]}`)
    verificar(133, colores[0] !== colores[1], `Colores distintos: ${colores.join(' / ')}.`, `Mismo color: ${colores[0]}`)

    const nombre = await cardNuevo.locator('h3').innerText()
    const badge = await cardNuevo.locator('.pedido-card__badge').innerText()
    const meta = await cardNuevo.locator('.pedido-card__meta').innerText()
    const horaVisible = /Hora de recogida:\s*\d{1,2}:\d{2}/.test(meta)
    const horaDestacada = await cardNuevo.locator('.pedido-card__meta strong').first().innerText()
    verificar(125, nombre === CLIENTE.clienteNombre, `Cliente: ${nombre}`, `Nombre mostrado: ${nombre}`)
    verificar(126, /PAGADO/.test(badge), `Estado mostrado: ${badge}`, `Estado mostrado: ${badge}`)
    verificar(127, horaVisible && /Hora de recogida/.test(horaDestacada), `${meta.split('\n')[0]} (etiqueta en negrita).`, `Meta: ${meta}`)
    verificar(141, nombre === CLIENTE.clienteNombre && horaVisible, `Muestra "${nombre}" y la hora de recogida.`, `Nombre: ${nombre}; meta: ${meta}`)
    const horaEsperada = s.pedidoConHora?.hora?.slice(11, 16)
    const cardConHora = tarjetaPedido(page, s.pedidoConHora?.id ?? -1)
    const metaConHora = (await cardConHora.count()) ? await cardConHora.locator('.pedido-card__meta').innerText() : ''
    const prodLinea = await cardNuevo.locator('li').first().innerText()
    verificar(128, /1\s*×/.test(prodLinea) && prodLinea.includes(s.prodA.nombre), `Producto: ${prodLinea.split('\n')[0]}`, `Línea: ${prodLinea}`)
    const accionesTodas = await page.locator('.pedido-card').evaluateAll((cards) => cards.every((c) => c.querySelector('.pedido-card__acciones button')))
    verificar(130, accionesTodas, 'Cada tarjeta tiene un botón de acción según su estado.', 'Hay tarjetas sin botón de acción.')
    const orden = await cardNuevo.evaluate((c) => ['.pedido-card__header', '.pedido-card__meta', '.pedido-card__productos', '.pedido-card__acciones']
      .map((sel) => c.querySelector(sel)?.getBoundingClientRect().top ?? -1))
    verificar(136, orden.every((v, i) => v >= 0 && (i === 0 || v >= orden[i - 1])), 'Estructura: encabezado → datos → productos → acciones.', `Posiciones: ${orden.join(', ')}`)

    await cardNuevo.getByRole('button', { name: 'Ver detalle de productos' }).click()
    const detalle = await cardNuevo.locator('.pedido-card__detalle').first().innerText().catch(() => '')
    verificar(142, /Precio unitario/.test(detalle), `Detalle desplegado: "${detalle}"`, 'No se pudo abrir el detalle de productos.')

    const overflow = await page.evaluate(() => {
      const col = document.querySelector('.kanban-column')
      return { col: col ? getComputedStyle(col).overflowY : 'n/a', body: getComputedStyle(document.body).overflowY, alto: document.documentElement.scrollHeight }
    })
    verificar(121, overflow.col !== 'hidden' && overflow.body !== 'hidden',
      `La lista se desplaza verticalmente (overflow columna: ${overflow.col}, página: ${overflow.body}).`, `Desplazamiento bloqueado: ${JSON.stringify(overflow)}`)

    // Cambio de estado desde la tarjeta.
    await btnAceptar.click()
    const movido = await espera(async () => (await columna(page, 'En preparación').locator('.pedido-card').filter({ hasText: new RegExp(`Pedido #${nuevo.id}(?!\\d)`) }).count()) > 0, { timeout: 12_000 })
    const estadoApi = (await consultarPedido(nuevo.codigoSeguimiento)).data?.estado
    verificar(119, estadoApi === 'EN_PREPARACION', `Desde la tarjeta el pedido pasó a ${estadoApi}.`, `Estado tras aceptar: ${estadoApi}`)
    verificar(140, estadoApi === 'EN_PREPARACION', 'El botón "Aceptar pedido" completó el cambio de estado.', `Estado: ${estadoApi}`)
    verificar(120, movido, 'La tarjeta se movió a "En preparación".', 'La tarjeta no se movió de columna.')
    verificar(137, movido && estadoApi === 'EN_PREPARACION', 'El cambio válido actualizó el pedido y refrescó el tablero.', 'No se refrescó el tablero.')
    await captura(page, 'HU014-tablero-cocina')

    // Actualización en tiempo real (polling cada 10 s).
    await cambiarEstado(t, prep.id, 'LISTO')
    const tiempoReal = await espera(async () => (await columna(page, 'Listos').locator('.pedido-card').filter({ hasText: new RegExp(`Pedido #${prep.id}(?!\\d)`) }).count()) > 0, { timeout: 16_000 })
    verificar(134, tiempoReal, 'Un cambio hecho desde otra sesión apareció en la tarjeta sin recargar.', 'La tarjeta no se actualizó en 16 s.')
    const masNuevo = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    await pagar(masNuevo)
    const t0 = Date.now()
    const llego = await espera(async () => (await tarjetaPedido(page, masNuevo.id).count()) > 0, { timeout: 16_000 })
    verificar(124, llego, `El pedido #${masNuevo.id} apareció solo, en ${Math.round((Date.now() - t0) / 1000)} s.`, 'El pedido nuevo no apareció en 16 s.')

    if (horaEsperada && metaConHora) {
      const [hh, mm] = horaEsperada.split(':').map(Number)
      const texto12 = `${String(hh % 12 || 12).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      s.horaCocinaOk = metaConHora.includes(texto12) || metaConHora.includes(horaEsperada)
      s.horaCocinaTexto = metaConHora.split('\n')[0]
    }

    const fallosResp = await probarResponsive(page, 'HU014-cocina')
    verificar(122, fallosResp.length === 0, 'Sin desborde horizontal en 390, 768 y 1366 px.', `Desborde en: ${fallosResp.join(', ')}`)
    verificar(135, fallosResp.length === 0, 'Las tarjetas se ven completas en móvil, tablet y escritorio.', `Desborde en: ${fallosResp.join(', ')}`)
    await contexto.close()

    await cambiarEstado(t, listo.id, 'ENTREGADO')
    const invalida = await cambiarEstado(t, listo.id, 'LISTO')
    verificar(138, invalida.status === 409, `ENTREGADO → LISTO rechazado con HTTP ${invalida.status}: "${invalida.data?.message}"`, `HTTP ${invalida.status}`)
    const ajeno = await cambiarEstado(s.dueno2.token, sinPago.id, 'CANCELADO')
    verificar(139, ajeno.status === 403, `Usuario de otra cafetería: HTTP ${ajeno.status}.`, `HTTP ${ajeno.status}`)
  })

  await caso('HU010 · Hora de recogida en cocina y seguimiento', [85], async () => {
    const { contexto, page } = await nuevaPagina()
    await page.goto(`${config.frontUrl}/seguimiento/${s.pedidoConHora.codigoSeguimiento}`)
    const resumen = await page.locator('.tracking-summary').innerText()
    await contexto.close()
    verificar(85, s.horaCocinaOk && /Recogida/.test(resumen),
      `Cocina: "${s.horaCocinaTexto}". Seguimiento: "${resumen.replace(/\s+/g, ' ')}".`,
      `Cocina: "${s.horaCocinaTexto ?? 'sin tarjeta'}"; seguimiento: "${resumen}"`)
  })
}

async function pruebasPanelDueno() {
  const nums = [143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
    172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187,
    192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 255, 256, 257]
  await caso('HU016–HU019 / HU028 · Panel del dueño', nums, async () => {
    await actualizarDisponibilidad(s.dueno1.token, s.prodB.id, false)
    try {
      await panelDueno()
    } finally {
      await actualizarDisponibilidad(s.dueno1.token, s.prodB.id, true)
    }
  })
}

async function panelDueno() {
  {
    const { contexto, page, erroresJs } = await nuevaPagina({ sesion: s.dueno1Ui })
    s.paginaDueno = { contexto, page }
    await page.goto(config.frontUrl + '/admin/dashboard')
    await page.getByText('Bienvenido').waitFor({ timeout: 20_000 })

    // HU028: acciones rápidas, calificación y pestañas.
    const acciones = page.locator('.admin-quick-actions')
    await acciones.waitFor()
    const resultadosAcciones = []
    await acciones.getByRole('button', { name: /Pedidos en curso/ }).click()
    resultadosAcciones.push(['Pedidos en curso', await page.locator('.admin-tab-btn.is-active').innerText()])
    await page.getByRole('button', { name: /Estadísticas y Métricas/ }).click()
    await acciones.getByRole('button', { name: /Agregar producto/ }).click()
    resultadosAcciones.push(['Agregar producto', await page.locator('.admin-tab-btn.is-active').innerText()])
    const foco = await page.evaluate(() => document.activeElement?.id)
    verificar(193, foco === 'prod-nombre', 'La acción "Agregar producto" abre el formulario de creación con el foco en el nombre.', `Elemento con foco: ${foco}`)
    await page.getByRole('button', { name: /Estadísticas y Métricas/ }).click()
    await acciones.getByRole('button', { name: /Personal de cocina/ }).click()
    resultadosAcciones.push(['Personal de cocina', await page.locator('.admin-tab-btn.is-active').innerText()])
    await page.getByRole('button', { name: /Estadísticas y Métricas/ }).click()
    await acciones.getByRole('link', { name: /Ver pedidos en cocina/ }).click()
    await page.waitForURL(/\/admin\/cocina/)
    resultadosAcciones.push(['Ver pedidos en cocina', new URL(page.url()).pathname])
    verificar(255,
      /Historial/.test(resultadosAcciones[0][1]) && /Menú/.test(resultadosAcciones[1][1]) && /Personal/.test(resultadosAcciones[2][1]) && resultadosAcciones[3][1] === '/admin/cocina',
      `Cada acción abre su vista: ${resultadosAcciones.map(([a, b]) => `${a} → ${b.replace(/\s+\d+$/, '')}`).join('; ')}.`,
      `Resultados: ${JSON.stringify(resultadosAcciones)}`)
    await page.goto(config.frontUrl + '/admin/dashboard')
    await page.getByText('Bienvenido').waitFor()
    const textoPanel = await page.locator('body').innerText()
    verificar(256, !/calificaci/i.test(textoPanel), 'Se decidió retirar la calificación promedio: el panel no muestra datos ficticios de calificación.', 'El panel aún muestra una calificación.')

    const pestañas = ['Estadísticas y Métricas', 'Historial de Pedidos', 'Menú y Catálogo', 'Personal de Cocina']
    const fallasPestañas = []
    for (const p of pestañas) {
      await page.getByRole('button', { name: new RegExp(p) }).click()
      await dormir(800)
      const alertas = await page.locator('.admin-alert-banner.error, .error-message').allInnerTexts()
      if (alertas.length) fallasPestañas.push(`${p}: ${alertas.join(' ')}`)
    }
    verificar(257, fallasPestañas.length === 0 && erroresJs.length === 0,
      `Las 4 pestañas cargan sin errores (${pestañas.join(', ')}).`, `Errores: ${[...fallasPestañas, ...erroresJs].join(' | ')}`)

    // HU016 / HU017: catálogo administrativo.
    await page.getByRole('button', { name: /Menú y Catálogo/ }).click()
    const pillsCatalogo = page.locator('.admin-catalog-toolbar .admin-category-pill-btn')
    await pillsCatalogo.first().waitFor()
    const nombresPills = await pillsCatalogo.allInnerTexts()
    verificar(143, nombresPills.some((t) => /^Tod/i.test(t.trim())) && nombresPills.some((t) => /Almuerzos/.test(t)) && nombresPills.some((t) => /Bebidas/.test(t)),
      `Categorías: ${nombresPills.map((t) => t.replace(/\s+/g, ' ')).join(' · ')}`, `Categorías: ${nombresPills.join(' · ')}`)
    const pillBebidas = pillsCatalogo.filter({ hasText: 'Bebidas' })
    await pillBebidas.click()
    verificar(144, /is-selected/.test(await pillBebidas.getAttribute('class')), 'La categoría seleccionada se resalta.', 'La categoría seleccionada no se resalta.')
    await pillsCatalogo.first().click()

    const cardA = page.locator('.admin-product-card-row').filter({ hasText: s.prodA.nombre })
    const cardB = page.locator('.admin-product-card-row').filter({ hasText: s.prodB.nombre })
    await cardA.waitFor()
    await page.mouse.move(0, 0)
    const imgA = await cardA.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0)
    const nombreA = await cardA.locator('h4').innerText()
    const precioA = await cardA.locator('.admin-product-price').innerText()
    const pillA = cardA.locator('.admin-avail-pill')
    const pillB = cardB.locator('.admin-avail-pill')
    const estadoA = await pillA.innerText()
    const estadoB = await pillB.innerText()
    const colorA = await pillA.evaluate((b) => getComputedStyle(b).backgroundColor)
    const colorB = await pillB.evaluate((b) => getComputedStyle(b).backgroundColor)
    const tarjetas = await page.locator('.admin-product-card-row').count()
    for (const [n, cond, si, no] of [
      [145, tarjetas > 0, `${tarjetas} productos en formato tarjeta.`, 'No hay tarjetas.'],
      [146, imgA, 'La tarjeta muestra la imagen del producto.', 'La imagen no cargó.'],
      [159, imgA, 'La card muestra la imagen del producto.', 'La imagen no cargó.'],
      [147, nombreA === s.prodA.nombre, `Nombre: ${nombreA}`, `Nombre: ${nombreA}`],
      [160, nombreA === s.prodA.nombre, `Nombre: ${nombreA}`, `Nombre: ${nombreA}`],
      [148, PRECIO_8500.test(precioA), `Precio: ${precioA}`, `Precio: ${precioA}`],
      [161, PRECIO_8500.test(precioA), `Precio: ${precioA}`, `Precio: ${precioA}`],
      [149, /Disponible/.test(estadoA) && /Agotado/.test(estadoB), `Estados: "${estadoA}" y "${estadoB}".`, `Estados: ${estadoA} / ${estadoB}`],
      [162, /Disponible/.test(estadoA) && /Agotado/.test(estadoB), `Estados: "${estadoA}" y "${estadoB}".`, `Estados: ${estadoA} / ${estadoB}`],
      [150, colorA !== colorB, `Disponible ${colorA} · Agotado ${colorB}.`, `Mismo color: ${colorA}`],
      [163, colorA !== colorB, `Disponible ${colorA} · Agotado ${colorB}.`, `Mismo color: ${colorA}`],
      [151, await pillA.isVisible(), 'Cada tarjeta incluye el interruptor de disponibilidad.', 'Sin interruptor.'],
      [164, await pillA.isVisible(), 'La card incluye el interruptor de disponibilidad.', 'Sin interruptor.'],
      [153, /is-out/.test(await pillB.getAttribute('class')), 'El producto agotado muestra el interruptor desactivado (rojo, "Agotado").', 'El agotado no se ve desactivado.'],
      [166, /is-out/.test(await pillB.getAttribute('class')), 'El producto agotado muestra el interruptor desactivado.', 'El agotado no se ve desactivado.'],
      [169, await cardA.getByRole('button', { name: 'Eliminar' }).isVisible(), 'La tarjeta tiene el botón "Eliminar".', 'Sin botón Eliminar.'],
    ]) verificar(n, cond, si, no)
    const ordenCard = await cardA.evaluate((c) => ['img', '.admin-product-card-body', '.admin-product-card-meta'].map((sel) => Boolean(c.querySelector(sel))))
    verificar(168, ordenCard.every(Boolean), 'La card mantiene imagen, información y acciones ordenadas.', `Secciones: ${ordenCard.join(', ')}`)

    await pillA.click()
    await espera(async () => /Agotado/.test(await pillA.innerText()), { timeout: 8000 })
    const publicoA = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
    await pillA.click()
    await espera(async () => /Disponible/.test(await pillA.innerText()), { timeout: 8000 })
    verificar(152, publicoA?.disponible === false, 'Al cambiar el interruptor, el menú público marcó el producto como no disponible al instante.', `Disponible en API: ${publicoA?.disponible}`)
    verificar(165, publicoA?.disponible === false, 'El cambio de disponibilidad se reflejó en tiempo real.', `Disponible en API: ${publicoA?.disponible}`)
    const scroll = await page.evaluate(() => getComputedStyle(document.querySelector('.admin-catalog-cards-list') ?? document.body).overflowY)
    verificar(154, scroll !== 'hidden', `Lista con desplazamiento vertical (overflow: ${scroll}).`, 'La lista no permite desplazamiento.')
    const respCatalogo = await probarResponsive(page, 'HU016-catalogo')
    verificar(155, respCatalogo.length === 0, 'Sin desborde horizontal en móvil, tablet y escritorio.', `Desborde en ${respCatalogo.join(', ')}`)
    verificar(167, respCatalogo.length === 0, 'La card se ve correctamente en todos los tamaños.', `Desborde en ${respCatalogo.join(', ')}`)
    await captura(page, 'HU016-catalogo-admin')

    // HU018: panel de edición.
    await cardA.locator('.admin-card-btn.edit').click()
    await page.getByRole('heading', { name: 'Editar producto' }).waitFor()
    const formulario = page.locator('form').filter({ has: page.locator('#prod-nombre') })
    const vistaPrevia = await page.locator('.admin-img-preview-thumb').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false)
    verificar(172, vistaPrevia, 'El panel de edición muestra la imagen del producto.', 'Sin vista previa de imagen.')
    verificar(173, (await page.locator('#prod-nombre').inputValue()) === s.prodA.nombre, `Nombre: ${await page.locator('#prod-nombre').inputValue()}`, 'El nombre no corresponde.')
    const precioInput = await page.locator('#prod-precio').inputValue()
    verificar(174, Number(precioInput) === 8500 && PRECIO_8500.test(precioA), `Precio base ${precioA} (campo: ${precioInput}).`, `Campo: ${precioInput}`)
    const chips = formulario.locator('.admin-extra-chip-card')
    const chipTextos = await chips.allInnerTexts()
    const marcados = await formulario.locator('.admin-extra-chip-card input[type=checkbox]:checked').count()
    verificar(179, (await chips.count()) > 0 && marcados >= 2, `Se listan ${await chips.count()} extras; ${marcados} asignados a este producto.`, `Extras: ${chipTextos.length}, marcados: ${marcados}`)
    const chipQueso = chips.filter({ hasText: s.extra1.nombre })
    verificar(180, /\$\s?1\.500/.test(await chipQueso.innerText()), `Extra: ${(await chipQueso.innerText()).replace(/\s+/g, ' ')}`, 'El extra no muestra nombre y precio.')
    const extrasCard = await cardA.innerText()
    verificar(178, /extras configurados/.test(extrasCard), `La tarjeta indica: "${extrasCard.match(/\d+ extras configurados/)?.[0]}". (Los tamaños se configuran como extras.)`, 'No se muestra la cantidad de extras.')
    verificar(182, await formulario.locator('.admin-toggle-switch input[type=checkbox]').count() === 1, 'El formulario incluye el interruptor de activación.', 'Sin interruptor.')
    const etiquetaEstado = await formulario.locator('.admin-switch-label').innerText()
    verificar(183, /disponible/i.test(etiquetaEstado), `Estado mostrado: "${etiquetaEstado}"`, `Estado: ${etiquetaEstado}`)
    verificar(184, await page.getByRole('button', { name: 'Guardar cambios' }).isVisible(), 'Existe el botón "Guardar cambios".', 'Sin botón Guardar cambios.')
    const respEdicion = await probarResponsive(page, 'HU018-edicion')
    verificar(187, respEdicion.length === 0, 'El panel de edición se adapta sin desborde.', `Desborde en ${respEdicion.join(', ')}`)

    await page.locator('#prod-precio').fill('9000')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    const precioActualizado = await espera(async () => /9\.000/.test(await cardA.locator('.admin-product-price').innerText()), { timeout: 10_000 })
    const api9000 = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
    verificar(175, Number(api9000?.precio) === 9000, `Precio editado a ${api9000?.precio}.`, `Precio en API: ${api9000?.precio}`)
    verificar(186, precioActualizado, 'La tarjeta mostró el nuevo precio sin recargar la página.', 'La tarjeta no se actualizó.')

    await cardA.locator('.admin-card-btn.edit').click()
    await page.getByRole('heading', { name: 'Editar producto' }).waitFor()
    const pillsForm = formulario.locator('.admin-category-pills').first().locator('.admin-category-pill-btn')
    await pillsForm.filter({ hasText: 'Bebidas' }).click()
    verificar(176, /is-selected/.test(await pillsForm.filter({ hasText: 'Bebidas' }).getAttribute('class')),
      'La categoría se elige en el selector de categorías del formulario (botones en lugar de lista desplegable).', 'No se pudo seleccionar la categoría.')
    await page.locator('#prod-desc').fill('Descripción editada por QA')
    verificar(177, (await page.locator('#prod-desc').inputValue()) === 'Descripción editada por QA', 'La descripción es editable.', 'La descripción no se pudo editar.')
    await page.locator('#nuevo-extra-nombre').fill(`QA Salsa ${TS}`)
    await page.locator('#nuevo-extra-precio').fill('700')
    await page.getByRole('button', { name: 'Guardar extra' }).click()
    const nuevoChip = await espera(async () => (await formulario.locator('.admin-extra-chip-card').filter({ hasText: `QA Salsa ${TS}` }).count()) > 0, { timeout: 8000 })
    verificar(181, nuevoChip, `Se añadió la opción "QA Salsa ${TS}".`, 'La nueva opción no apareció.')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click()
    const tituloTrasCancelar = await page.getByRole('heading', { name: 'Nuevo producto en catálogo' }).isVisible()
    const sinCambios = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
    verificar(185, tituloTrasCancelar && sinCambios?.descripcion !== 'Descripción editada por QA',
      'Cancelar descartó los cambios (categoría y descripción sin guardar).', 'Los cambios no se descartaron.')
    await api('PUT', `/api/products/${s.prodA.id}`, {
      token: s.dueno1.token,
      body: { nombre: s.prodA.nombre, descripcion: 'Sándwich de prueba con queso y tomate', precio: 8500, categoriaId: 3, restauranteId: R1, imagenUrl: PNG_DATA_URL, disponible: true },
    })

    // HU019: crear producto.
    await page.getByRole('button', { name: /Menú y Catálogo/ }).click()
    const publicar = page.getByRole('button', { name: 'Publicar producto en catálogo' })
    verificar(192, await publicar.isVisible(), 'El botón para añadir productos está visible ("Publicar producto en catálogo" y la acción rápida "Agregar producto").', 'Sin botón para añadir.')
    const campos = await Promise.all(['#prod-nombre', '#prod-precio', '#prod-desc', '#prod-img'].map((sel) => page.locator(sel).count()))
    const pillsCrear = await formulario.locator('.admin-category-pills').first().locator('.admin-category-pill-btn').count()
    verificar(194, campos.every((c) => c === 1) && pillsCrear > 0, 'El formulario permite nombre, precio, categoría, descripción e imagen.', `Campos: ${campos.join(',')}; categorías: ${pillsCrear}`)
    verificar(195, await formulario.locator('.admin-extras-section').isVisible(), 'Se pueden configurar ingredientes extra (los tamaños se registran como extras con su precio).', 'Sin sección de extras.')
    verificar(196, await formulario.locator('.admin-toggle-switch input').isChecked(), 'Se define el estado inicial (disponible por defecto).', 'Sin estado inicial.')

    await publicar.click()
    const errorVacio = await page.locator('.admin-alert-banner.error').innerText({ timeout: 1500 }).catch(() => '')
    const nativa = await formulario.evaluate((f) => ({ valido: f.checkValidity(), mensaje: f.querySelector(':invalid')?.validationMessage ?? '' }))
    verificar(197, (!nativa.valido && nativa.mensaje) || /Completa el nombre/.test(errorVacio),
      `No se guardó: el formulario exige los campos obligatorios ("${nativa.mensaje || errorVacio}").`, `Formulario válido: ${nativa.valido}; mensaje: ${errorVacio}`)

    const nombreNuevo = `QA Nuevo ${TS}`
    await page.locator('#prod-nombre').fill(nombreNuevo)
    await page.locator('#prod-precio').fill('3200')
    await page.locator('#prod-desc').fill('Producto creado desde la interfaz por QA')
    const png = path.join(os.tmpdir(), `upbfood-qa-${TS}.png`)
    fs.writeFileSync(png, Buffer.from(PNG_BASE64, 'base64'))
    await page.locator('#prod-img').setInputFiles(png)
    const imgCargada = await espera(async () => {
      const src = await page.locator('.admin-img-preview-thumb').getAttribute('src')
      return src?.startsWith('data:image') ? src : null
    }, { timeout: 8000 })
    verificar(201, Boolean(imgCargada), 'Se cargó la imagen desde el dispositivo y se previsualiza.', 'La imagen no se cargó en el formulario.')

    await page.route('**/api/products', (route) => route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Error simulado por QA' }) })
      : route.continue())
    await publicar.click()
    const errorRegistro = await page.locator('.admin-alert-banner.error').innerText().catch(() => '')
    verificar(199, /Error simulado por QA/.test(errorRegistro), `Mensaje mostrado ante un error del servidor: "${errorRegistro}"`, `Mensaje: ${errorRegistro}`)
    await page.unroute('**/api/products')

    await publicar.click()
    const cardNueva = page.locator('.admin-product-card-row').filter({ hasText: nombreNuevo })
    const aparece = await espera(async () => (await cardNueva.count()) > 0, { timeout: 10_000 })
    verificar(198, aparece, `"${nombreNuevo}" se agregó a la lista de productos.`, 'El producto no apareció en la lista.')
    const creado = (await productosPublicos(R1)).find((p) => p.nombre === nombreNuevo)
    if (creado) limpieza.push(() => api('DELETE', `/api/products/${creado.id}?restauranteId=${R1}`, { token: s.dueno1.token }))
    const respCrear = await probarResponsive(page, 'HU019-crear')
    verificar(200, respCrear.length === 0, 'La creación de productos se ve bien en todos los tamaños.', `Desborde en ${respCrear.join(', ')}`)

    const menu = await nuevaPagina()
    await menu.page.goto(`${config.frontUrl}/restaurante/${R1}`)
    const imgMenu = menu.page.locator('.product-card').filter({ hasText: nombreNuevo }).locator('img')
    await imgMenu.waitFor().catch(() => null)
    const srcMenu = await imgMenu.getAttribute('src').catch(() => '')
    await menu.contexto.close()
    verificar(202, creado?.imagenUrl?.startsWith('data:image') && srcMenu?.startsWith('data:image'),
      'La imagen cargada se muestra en el catálogo público.', `Imagen en API: ${creado?.imagenUrl?.slice(0, 20)}; en el menú: ${srcMenu?.slice(0, 20)}`)

    // HU016: selector de cafetería con más de una asignación.
    await page.getByText(/Gestión de/).waitFor()
    await dormir(1500)
    const selectorAntes = await page.locator('#selector-restaurante-admin').count()
    if (!db) {
      pendiente(157, 'Requiere acceso a PostgreSQL para asignar temporalmente una segunda cafetería.')
      pendiente(158, 'Requiere acceso a PostgreSQL para asignar temporalmente una segunda cafetería.')
    } else {
      const ins = await db.query(
        `INSERT INTO administrador_restaurante (restaurante_id, administrador_id, tipo_administrador_id, estado)
         VALUES ($1, $2, 1, 'Activo') ON CONFLICT DO NOTHING`, [R2, s.dueno1.data.id])
      const quitarAsignacion = () => db.query('DELETE FROM administrador_restaurante WHERE restaurante_id = $1 AND administrador_id = $2', [R2, s.dueno1.data.id])
      await page.reload()
      await page.getByText('Bienvenido').waitFor()
      const selector = page.locator('#selector-restaurante-admin')
      const selectorDespues = (await espera(async () => (await selector.count()) > 0, { timeout: 10_000 })) ? 1 : 0
      verificar(157, selectorAntes === 0 && selectorDespues === 1,
        'Con una cafetería no aparece el selector; con dos asignaciones sí aparece.', `Antes: ${selectorAntes}, después: ${selectorDespues}`)
      if (selectorDespues) {
        await selector.selectOption(String(R2))
        await page.getByRole('button', { name: /Menú y Catálogo/ }).click()
        const nombreR2 = s.productoR2?.nombre
        const cambio = nombreR2 ? await espera(async () => (await page.locator('.admin-product-card-row').filter({ hasText: nombreR2 }).count()) > 0, { timeout: 10_000 }) : false
        verificar(158, cambio, `Al elegir la cafetería ${R2} el catálogo se recargó (aparece "${nombreR2}").`, 'El catálogo no cambió.')
        await selector.selectOption(String(R1))
      } else {
        error(158, 'No apareció el selector de cafetería.')
      }
      if (ins.rowCount) await quitarAsignacion()
      await page.reload()
      await page.getByText('Bienvenido').waitFor()
    }
    await captura(page, 'HU028-panel-dueno')
  }
}

async function pruebasApiCatalogo() {
  await caso('HU016 / HU017 / HU018 · Reglas de catálogo y adiciones', [156, 170, 188, 189, 190, 191], async () => {
    const asignadas = await api('GET', '/api/admin/restaurantes', { token: s.dueno2.token })
    const ids = (asignadas.data ?? []).map((r) => Number(r.id))
    verificar(156, asignadas.status === 200 && ids.includes(R2) && !ids.includes(R1),
      `El dueño de la cafetería ${R2} recibe solo sus cafeterías activas: [${ids.join(', ')}].`, `HTTP ${asignadas.status}: [${ids.join(', ')}]`)

    const temporal = await crearProducto(s.dueno1.token, { nombre: `QA Temporal ${TS}`, precio: 1000, categoriaId: 3 })
    const ajeno = await api('DELETE', `/api/products/${temporal.id}?restauranteId=${R1}`, { token: s.dueno2.token })
    const cocina = await api('DELETE', `/api/products/${temporal.id}?restauranteId=${R1}`, { token: s.cocina.token })
    const dueno = await api('DELETE', `/api/products/${temporal.id}?restauranteId=${R1}`, { token: s.dueno1.token })
    const sigue = (await productosPublicos(R1)).some((p) => Number(p.id) === Number(temporal.id))
    verificar(170, ajeno.status === 403 && cocina.status === 403 && dueno.status === 200 && !sigue,
      `Otro dueño: ${ajeno.status}, cocina: ${cocina.status}, dueño: ${dueno.status}; el producto se retiró del menú.`,
      `Otro dueño: ${ajeno.status}, cocina: ${cocina.status}, dueño: ${dueno.status}, sigue en menú: ${sigue}`)

    const pedido = await pedidoNuevo([{ productoId: s.prodA.id, cantidad: 1, adiciones: [s.extra1.id] }])
    verificar(189, Number(pedido.total) === 10000, `8.500 + adición 1.500 = total ${pedido.total}.`, `Total calculado: ${pedido.total}`)
    const detalle = (await consultarPedido(pedido.codigoSeguimiento)).data?.productos?.[0]
    verificar(190, String(detalle?.adiciones ?? '').includes(s.extra1.nombre.split(' ')[1]) || String(detalle?.adiciones ?? '').includes(s.extra1.nombre),
      `Detalle del pedido: adiciones "${detalle?.adiciones}".`, `Detalle: ${JSON.stringify(detalle)}`)
    if (db) {
      const tipo = await db.query(`SELECT tipo_producto_id FROM tipo_producto WHERE nombre_tipo_producto = 'Adición'`)
      const hist = await db.query(
        `SELECT dpa.precio_adicion FROM detalle_pedido_adicion dpa JOIN detalle_pedido dp ON dp.detalle_pedido_id = dpa.detalle_pedido_id WHERE dp.pedido_id = $1`, [pedido.id])
      verificar(188, tipo.rowCount === 1 && Number(hist.rows[0]?.precio_adicion) === 1500,
        `Existe el tipo "Adición" (id ${tipo.rows[0]?.tipo_producto_id}) y detalle_pedido_adicion guardó el precio histórico ${hist.rows[0]?.precio_adicion}.`,
        `Tipo: ${tipo.rowCount}; precio guardado: ${hist.rows[0]?.precio_adicion}`)
    } else {
      pendiente(188, 'Requiere acceso a PostgreSQL para revisar detalle_pedido_adicion.')
    }
    const publico = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
    verificar(191, (publico?.ingredientesExtra ?? []).length >= 2,
      `El producto ofrece ${publico?.ingredientesExtra?.length} adiciones gestionadas desde el panel.`, `Adiciones: ${publico?.ingredientesExtra?.length}`)
  })
}

async function pruebasSeguimientoYConsulta() {
  await caso('HU020 · Seguimiento por código', [203, 204, 205, 206, 207, 208], async () => {
    const a = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    const b = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    verificar(203, a.codigoSeguimiento !== b.codigoSeguimiento && UUID_V4.test(a.codigoSeguimiento) && UUID_V4.test(b.codigoSeguimiento),
      `Códigos UUID v4 distintos: ${a.codigoSeguimiento} / ${b.codigoSeguimiento}`, `Códigos: ${a.codigoSeguimiento} / ${b.codigoSeguimiento}`)
    const valido = await consultarPedido(a.codigoSeguimiento)
    const inexistente = await consultarPedido('00000000-0000-4000-8000-000000000000')
    verificar(204, valido.status === 200 && valido.data?.id === a.id && inexistente.status === 404,
      `Código válido: HTTP 200 (pedido #${valido.data?.id}); inexistente: HTTP ${inexistente.status}.`, `Válido: ${valido.status}; inexistente: ${inexistente.status}`)

    const { contexto, page } = await nuevaPagina()
    await page.goto(config.frontUrl + '/seguimiento')
    const formulario = await page.locator('.tracking-form').isVisible()
    await page.goto(`${config.frontUrl}/seguimiento/${a.codigoSeguimiento}`)
    await page.getByText(`Pedido #${a.id}`).waitFor()
    verificar(205, formulario, 'Ambas rutas abren la página de seguimiento y la segunda carga el pedido.', 'La ruta /seguimiento no mostró el formulario.')
    const pasos = await page.locator('.tracking-step').allInnerTexts()
    const requeridos = ['Recibido', 'Pagado', 'En preparación', 'Listo para recoger', 'Entregado']
    verificar(206, requeridos.every((r) => pasos.some((p) => p.includes(r))), `Pasos: ${pasos.join(' → ')}`, `Pasos: ${pasos.join(' → ')}`)

    await cambiarEstado(s.cocina.token, b.id, 'CANCELADO')
    await page.goto(`${config.frontUrl}/seguimiento/${b.codigoSeguimiento}`)
    const cancelado = page.locator('.tracking-cancelled')
    await cancelado.waitFor()
    verificar(207, await cancelado.isVisible(), `Se muestra aparte: "${await cancelado.innerText()}"`, 'El cancelado no se diferencia.')
    await captura(page, 'HU020-cancelado')

    await pagar(a)
    await page.goto(`${config.frontUrl}/seguimiento/${a.codigoSeguimiento}`)
    await page.locator('.tracking-status').waitFor()
    await cambiarEstado(s.cocina.token, a.id, 'EN_PREPARACION')
    const cambio = await espera(async () => /preparaci/i.test(await page.locator('.tracking-status').innerText()), { timeout: 16_000 })
    verificar(208, cambio, 'La barra pasó a "En preparación" sin recargar tras el cambio en cocina.', 'La barra no reflejó el cambio en 16 s.')
    await captura(page, 'HU020-seguimiento')
    await contexto.close()
  })

  await caso('HU021 · Consulta de pedido', [209, 210, 211, 212, 213, 214, 215], async () => {
    const p = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    const porCorreo = await api('GET', `/api/pedidos/consulta?pedidoId=${p.id}&correo=${encodeURIComponent(CLIENTE.clienteCorreo.toUpperCase())}`)
    verificar(209, porCorreo.status === 200 && porCorreo.data?.id === p.id, `Número + correo: HTTP 200, pedido #${porCorreo.data?.id}.`, `HTTP ${porCorreo.status}`)
    const tel = CLIENTE.clienteTelefono
    const f1 = `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`
    const f2 = `${tel.slice(0, 3)}-${tel.slice(3, 6)}-${tel.slice(6)}`
    const t1 = await api('GET', `/api/pedidos/consulta?pedidoId=${p.id}&telefono=${encodeURIComponent(f1)}`)
    const t2 = await api('GET', `/api/pedidos/consulta?pedidoId=${p.id}&telefono=${encodeURIComponent(f2)}`)
    verificar(210, t1.status === 200 && t2.status === 200, `"${f1}" y "${f2}" encuentran el pedido.`, `HTTP ${t1.status} / ${t2.status}`)
    const sinDatos = await api('GET', `/api/pedidos/consulta?pedidoId=${p.id}`)
    verificar(211, sinDatos.status === 400, `Sin identificador secundario: HTTP 400 ("${sinDatos.data?.message}").`, `HTTP ${sinDatos.status}`)
    const errado = await api('GET', `/api/pedidos/consulta?pedidoId=${p.id}&correo=otro@upb.edu.co`)
    const soloCodigo = await api('GET', `/api/pedidos/consulta?codigo=${p.codigoSeguimiento}`)
    verificar(214, soloCodigo.status === 200, 'Con solo el código de seguimiento se consulta el pedido.', `HTTP ${soloCodigo.status}`)
    verificar(215, soloCodigo.status === 200 && sinDatos.status === 400,
      'El endpoint acepta un único dato (el código). Con el número de pedido exige además correo o teléfono para proteger los datos del cliente.',
      `Solo código: ${soloCodigo.status}`)

    const { contexto, page } = await nuevaPagina({ almacenamiento: { 'upbfood.lastOrder': { id: p.id, codigoSeguimiento: p.codigoSeguimiento, total: p.total } } })
    await page.goto(config.frontUrl + '/seguimiento')
    await page.getByRole('button', { name: /Consultar mi último pedido reciente/ }).click()
    const encontrado = await page.getByText(`Pedido #${p.id}`).isVisible().catch(() => false) ||
      Boolean(await espera(async () => page.getByText(`Pedido #${p.id}`).isVisible(), { timeout: 6000 }))
    verificar(212, encontrado, 'El último pedido guardado en el navegador (upbfood.lastOrder) se consulta desde el formulario.', 'No se consultó el último pedido.')
    await page.getByRole('tab', { name: /pedido \+ contacto/ }).click()
    await page.getByPlaceholder('Ej. 15').fill(String(p.id))
    await page.getByPlaceholder('Ej. estudiante@upb.edu.co o 3001234567').fill('otro@upb.edu.co')
    await page.getByRole('button', { name: 'Consultar pedido' }).click()
    const msgError = await page.locator('.tracking-error').innerText().catch(() => '')
    verificar(213, errado.status === 404 && msgError.length > 0, `API: HTTP 404. Pantalla: "${msgError}"`, `API: ${errado.status}; pantalla: "${msgError}"`)
    await captura(page, 'HU021-consulta')
    await contexto.close()
  })

  await caso('HU022 · Portal de pago', [216, 217, 218, 219, 220, 221, 222], async () => {
    const p = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    const { contexto, page } = await nuevaPagina({ almacenamiento: { 'upbfood.lastOrder': { id: p.id, codigoSeguimiento: p.codigoSeguimiento, total: p.total } } })
    await page.goto(config.frontUrl + '/pago')
    const opciones = await page.locator('.pago-metodo').allInnerTexts()
    verificar(216, ['Efectivo', 'Tarjeta', 'Transferencia'].every((m) => opciones.some((o) => o.includes(m))), `Métodos: ${opciones.join(', ')}`, `Métodos: ${opciones.join(', ')}`)

    await page.getByLabel('Transferencia').check()
    await page.route('**/api/pedidos/seguimiento/*/pago', (r) => r.abort())
    await page.getByRole('button', { name: 'Simular aprobación del pago' }).click()
    const msgConexion = await page.locator('.mensaje-error').innerText().catch(() => '')
    await page.unroute('**/api/pedidos/seguimiento/*/pago')
    await page.getByLabel('Efectivo').check()
    await page.getByRole('button', { name: 'Simular aprobación del pago' }).click()
    const msgOk = await page.locator('.mensaje-exito').innerText().catch(() => '')
    const estado = (await consultarPedido(p.codigoSeguimiento)).data?.estado
    verificar(217, estado === 'PAGADO', `Pago simulado en efectivo registrado; estado: ${estado}.`, `Estado: ${estado}`)
    verificar(222, /aprobado/i.test(msgOk) && /conectar/i.test(msgConexion), `Aprobado: "${msgOk}". Sin conexión: "${msgConexion}".`, `Aprobado: "${msgOk}"; sin conexión: "${msgConexion}"`)
    await captura(page, 'HU022-pago')
    await contexto.close()

    const q = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    const menor = await api('PUT', `/api/pedidos/seguimiento/${q.codigoSeguimiento}/pago`, { body: { tipoPagoId: 1, monto: Number(q.total) - 1 } })
    const mayor = await api('PUT', `/api/pedidos/seguimiento/${q.codigoSeguimiento}/pago`, { body: { tipoPagoId: 1, monto: Number(q.total) + 1 } })
    verificar(219, menor.status >= 400 && mayor.status >= 400, `Monto menor: HTTP ${menor.status}; mayor: HTTP ${mayor.status}.`, `Menor: ${menor.status}; mayor: ${mayor.status}`)
    const exacto = await api('PUT', `/api/pedidos/seguimiento/${q.codigoSeguimiento}/pago`, { body: { tipoPagoId: 3, monto: Number(q.total) } })
    verificar(218, exacto.status === 200 && exacto.data?.estado === 'PAGADO', `Monto exacto: HTTP 200, estado ${exacto.data?.estado}.`, `HTTP ${exacto.status}`)
    const otraVez = await api('PUT', `/api/pedidos/seguimiento/${q.codigoSeguimiento}/pago`, { body: { tipoPagoId: 1, monto: Number(q.total) } })
    verificar(220, otraVez.status >= 400, `Pedido ya pagado: HTTP ${otraVez.status} ("${otraVez.data?.message}").`, `HTTP ${otraVez.status}`)
    if (db) {
      const pagos = await db.query('SELECT COUNT(*)::int AS n FROM pago WHERE pedido_id = $1', [q.id])
      verificar(221, pagos.rows[0].n === 1 && otraVez.status >= 400, 'El pedido tiene un único registro de pago.', `Pagos registrados: ${pagos.rows[0].n}`)
    } else {
      verificar(221, otraVez.status >= 400, 'El segundo pago fue rechazado (la tabla pago tiene pedido_id UNIQUE).', `HTTP ${otraVez.status}`)
    }
  })
}

async function pruebasSesionYRoles() {
  await caso('HU003 / HU024 · Navegación por rol y rutas protegidas', [22, 23, 24, 25, 26, 231, 232], async () => {
    const anonimo = await nuevaPagina()
    await anonimo.page.goto(config.frontUrl + '/')
    const navAnon = await anonimo.page.locator('.nav-actions').innerText()
    await anonimo.page.goto(config.frontUrl + '/admin/dashboard')
    await anonimo.page.waitForURL(/\/admin$/)
    const redirige1 = new URL(anonimo.page.url()).pathname
    await anonimo.page.goto(config.frontUrl + '/admin/cocina')
    await anonimo.page.waitForURL(/\/admin$/)
    const redirige2 = new URL(anonimo.page.url()).pathname
    await anonimo.contexto.close()

    const duenoNav = await nuevaPagina({ sesion: s.dueno1NavUi })
    await duenoNav.page.goto(config.frontUrl + '/admin')
    await duenoNav.page.waitForURL(/\/admin\/dashboard/)
    const navDueno = await duenoNav.page.locator('.nav-actions').innerText()
    await duenoNav.contexto.close()

    const cocinaNav = await nuevaPagina({ sesion: s.cocinaNavUi })
    await cocinaNav.page.goto(config.frontUrl + '/admin')
    await cocinaNav.page.waitForURL(/\/admin\/cocina/)
    const navCocina = await cocinaNav.page.locator('.nav-actions').innerText()
    await cocinaNav.page.goto(config.frontUrl + '/admin/dashboard')
    const prohibido = await cocinaNav.page.getByText('No tienes acceso a esta sección').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)
    await captura(cocinaNav.page, 'HU024-acceso-denegado')
    await cocinaNav.contexto.close()

    const clienteOk = /Explorar menú/.test(navAnon) && /Mi pedido/.test(navAnon) && /Historial/.test(navAnon) && !/Cocina|Panel/.test(navAnon)
    verificar(23, clienteOk, `Sin sesión: ${navAnon.replace(/\n/g, ' · ')}`, `Sin sesión: ${navAnon}`)
    verificar(24, /Panel del restaurante/.test(navDueno) && !/Mi pedido/.test(navDueno), `Con sesión de dueño: ${navDueno.replace(/\n/g, ' · ')}`, `Dueño: ${navDueno}`)
    verificar(25, /Cocina/.test(navCocina) && !/Panel del restaurante/.test(navCocina) && !/Cocina/.test(navAnon),
      `Rol cocina: ${navCocina.replace(/\n/g, ' · ')} (el dueño también ve Cocina porque puede operar su cocina).`, `Cocina: ${navCocina}`)
    verificar(26, redirige1 === '/admin' && redirige2 === '/admin' && prohibido,
      'Sin sesión las rutas /admin/* redirigen a /admin; con sesión sin permiso se muestra la página 403.',
      `Redirecciones: ${redirige1}, ${redirige2}; 403 visible: ${prohibido}`)
    verificar(22, clienteOk && /Panel/.test(navDueno) && /Cocina/.test(navCocina) && prohibido,
      'Rutas separadas: cliente (/, /pedido, /historial…), administración (/admin/dashboard) y cocina (/admin/cocina).', 'Las rutas no están separadas por tipo de usuario.')
    verificar(231, /Panel/.test(navDueno) && !/Panel/.test(navCocina), 'La barra muestra solo las opciones permitidas para cada rol.', `Dueño: ${navDueno}; cocina: ${navCocina}`)
    verificar(232, redirige1 === '/admin' && prohibido, 'Las rutas /admin/* están protegidas.', 'Rutas sin protección.')
  })

  await caso('HU023 · Sesión persistente y refresh token', [223, 224, 225, 226, 227], async () => {
    if (!s.paginaDueno) s.paginaDueno = await nuevaPagina({ sesion: await login(config.dueno1) })
    const { page } = s.paginaDueno
    await page.goto(config.frontUrl + '/admin/dashboard')
    await page.getByText('Bienvenido').waitFor()
    await page.reload()
    const sigue = await page.getByText('Bienvenido').isVisible().catch(() => false) || Boolean(await espera(() => page.getByText('Bienvenido').isVisible(), { timeout: 8000 }))
    verificar(223, sigue && page.url().includes('/admin/dashboard'), 'Tras recargar, la sesión del administrador se mantiene.', `URL tras recargar: ${page.url()}`)

    let renovaciones = 0
    let forzado = false
    page.on('request', (r) => { if (r.url().includes('/api/admin/refresh')) renovaciones += 1 })
    await page.route('**/api/admin/pedidos/estadisticas**', async (route) => {
      if (!forzado) {
        forzado = true
        await route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"expirado"}' })
      } else {
        await route.continue()
      }
    })
    renovaciones = 0
    await page.getByRole('button', { name: /Actualizar métricas/ }).click()
    await dormir(2500)
    await page.unroute('**/api/admin/pedidos/estadisticas**')
    const errorStats = await page.locator('.error-message').count()
    verificar(225, forzado && renovaciones >= 1 && errorStats === 0, `Ante un 401, apiFetch pidió /api/admin/refresh (${renovaciones} vez) y repitió la consulta.`, `Renovaciones: ${renovaciones}; errores: ${errorStats}`)
    await s.paginaDueno.contexto.close()

    const sesion = await login(config.dueno1)
    const r1 = await api('POST', '/api/admin/refresh', { cookie: `upbfood_refresh_token=${sesion.refresh}` })
    const nuevo = (r1.setCookies ?? []).map((c) => c.match(/upbfood_refresh_token=([^;]*)/)?.[1]).find(Boolean)
    const httpOnly = (r1.setCookies ?? []).some((c) => /HttpOnly/i.test(c))
    const reuso = await api('POST', '/api/admin/refresh', { cookie: `upbfood_refresh_token=${sesion.refresh}` })
    verificar(224, r1.status === 200 && r1.data?.accessToken && nuevo && nuevo !== sesion.refresh && httpOnly && reuso.status === 401,
      'El refresh devolvió un JWT nuevo, rotó la cookie HttpOnly y el token anterior quedó inválido (401).',
      `Refresh: ${r1.status}; cookie nueva: ${Boolean(nuevo)}; HttpOnly: ${httpOnly}; reuso: ${reuso.status}`)
    if (db) {
      const fila = await db.query('SELECT token_hash FROM refresh_tokens WHERE token_hash = $1', [sha256(nuevo)])
      const plano = await db.query('SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE token_hash = $1', [nuevo])
      verificar(227, fila.rowCount === 1 && plano.rows[0].n === 0, 'La base guarda solo el hash SHA-256 del refresh token (nunca el valor de la cookie).', `Hash encontrado: ${fila.rowCount}; texto plano: ${plano.rows[0].n}`)
    } else {
      pendiente(227, 'Requiere acceso a PostgreSQL para revisar refresh_tokens.')
    }
    const salir = await api('POST', '/api/admin/logout', { cookie: `upbfood_refresh_token=${nuevo}` })
    const despues = await api('POST', '/api/admin/refresh', { cookie: `upbfood_refresh_token=${nuevo}` })
    const borraCookie = (salir.setCookies ?? []).some((c) => /Max-Age=0/i.test(c))
    verificar(226, salir.status === 200 && despues.status === 401 && borraCookie,
      'El logout revocó el token y eliminó la cookie; un refresh posterior responde 401.', `Logout: ${salir.status}; refresh posterior: ${despues.status}; cookie borrada: ${borraCookie}`)
  })

  await caso('HU024 / HU026 · Control de acceso y aislamiento', [228, 229, 230, 234, 242, 243, 244, 245, 246, 271], async () => {
    if (db) {
      const tipos = await db.query('SELECT nombre_tipo_administrador FROM tipo_administrador ORDER BY 1')
      const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'administrador_restaurante'`)
      const nombres = tipos.rows.map((r) => r.nombre_tipo_administrador)
      const columnas = cols.rows.map((r) => r.column_name)
      verificar(228, nombres.includes('Dueño de restaurante') && nombres.includes('Administrador de cocina') && columnas.includes('tipo_administrador_id') && columnas.includes('estado'),
        `Roles: ${nombres.join(', ')}; administrador_restaurante guarda rol y estado por cafetería.`, `Roles: ${nombres.join(', ')}; columnas: ${columnas.join(', ')}`)
    } else {
      pendiente(228, 'Requiere acceso a PostgreSQL.')
    }
    const prohibido = await api('GET', `/api/admin/restaurantes/${R1}/administradores-cocina`, { token: s.cocina.token })
    verificar(229, prohibido.status === 403, `Cuenta de cocina en gestión de personal: HTTP 403 ("${prohibido.data?.message}").`, `HTTP ${prohibido.status}`)
    const sinToken = await api('GET', `/api/admin/pedidos?restauranteId=${R1}`)
    const crearSinToken = await api('POST', '/api/products', { body: { nombre: 'x' } })
    const publico = await api('GET', '/api/restaurantes')
    verificar(230, sinToken.status === 401 && crearSinToken.status === 401 && publico.status === 200,
      `Sin token: pedidos admin ${sinToken.status}, crear producto ${crearSinToken.status}; catálogo público ${publico.status}.`, `Pedidos: ${sinToken.status}; crear: ${crearSinToken.status}; público: ${publico.status}`)

    if (!config.claveUpb) {
      pendiente(234, 'APP_UPB_REVISOR_CLAVE no está configurada en P_upbFood/.env; el panel del encargado está deshabilitado.')
      pendiente(271, 'APP_UPB_REVISOR_CLAVE no está configurada en P_upbFood/.env.')
    } else {
      const sinClave = await api('GET', '/api/upb/solicitudes')
      const malaClave = await api('GET', '/api/upb/solicitudes', { headers: { 'X-UPB-Revisor-Clave': 'clave-incorrecta' } })
      const buena = await api('GET', '/api/upb/solicitudes', { headers: { 'X-UPB-Revisor-Clave': config.claveUpb } })
      const conJwt = await api('GET', '/api/upb/solicitudes', { token: s.dueno1.token })
      const ok234 = sinClave.status === 401 && malaClave.status === 403 && conJwt.status === 401 && buena.status === 200
      verificar(234, ok234, 'El rol del encargado de la universidad se valida con su clave institucional: sin clave 401, clave errada 403, clave correcta 200.',
        `Sin clave: ${sinClave.status}; errada: ${malaClave.status}; dueño: ${conJwt.status}; correcta: ${buena.status}`)
      verificar(271, ok234, `Sin rol de aprobación: ${sinClave.status}/${malaClave.status}; un dueño tampoco accede (${conJwt.status}).`,
        `Sin clave: ${sinClave.status}; errada: ${malaClave.status}; dueño: ${conJwt.status}`)
    }

    const base = { nombre: `QA Aislamiento ${TS}`, descripcion: 'x', precio: 1000, categoriaId: 3, disponible: true }
    const sinRest = await api('POST', '/api/products', { token: s.dueno1.token, body: base })
    const putSinRest = await api('PUT', `/api/products/${s.prodB.id}`, { token: s.dueno1.token, body: base })
    const delSinRest = await api('DELETE', `/api/products/${s.prodB.id}`, { token: s.dueno1.token })
    verificar(242, [sinRest, putSinRest, delSinRest].every((r) => r.status === 400),
      `Sin restauranteId: crear ${sinRest.status}, editar ${putSinRest.status}, eliminar ${delSinRest.status}.`, `Crear: ${sinRest.status}; editar: ${putSinRest.status}; eliminar: ${delSinRest.status}`)
    const sinAsignacion = await api('GET', `/api/productos/admin?restauranteId=${R1}`, { token: s.dueno2.token })
    verificar(243, sinAsignacion.status === 403, `Administrador sin asignación en la cafetería ${R1}: HTTP 403.`, `HTTP ${sinAsignacion.status}`)
    const otraCafeteria = await api('PUT', `/api/products/${s.prodB.id}`, { token: s.dueno2.token, body: { ...base, restauranteId: R1 } })
    verificar(244, otraCafeteria.status === 403, `Editar un producto de otra cafetería: HTTP 403 ("${otraCafeteria.data?.message}").`, `HTTP ${otraCafeteria.status}`)
    const cocinaCrea = await api('POST', '/api/products', { token: s.cocina.token, body: { ...base, restauranteId: R1 } })
    const cocinaEdita = await api('PUT', `/api/products/${s.prodB.id}`, { token: s.cocina.token, body: { ...base, restauranteId: R1 } })
    const cocinaElimina = await api('DELETE', `/api/products/${s.prodB.id}?restauranteId=${R1}`, { token: s.cocina.token })
    verificar(245, [cocinaCrea, cocinaEdita, cocinaElimina].every((r) => r.status === 403),
      `Rol cocina: crear ${cocinaCrea.status}, editar ${cocinaEdita.status}, eliminar ${cocinaElimina.status}.`, `Crear: ${cocinaCrea.status}; editar: ${cocinaEdita.status}; eliminar: ${cocinaElimina.status}`)
    const propio = await api('GET', `/api/productos/admin?restauranteId=${R1}`, { token: s.dueno1.token })
    verificar(246, propio.status === 200 && sinAsignacion.status === 403, `Dueño asignado: HTTP ${propio.status}; otro administrador: HTTP ${sinAsignacion.status}.`, `Propio: ${propio.status}; ajeno: ${sinAsignacion.status}`)
  })

  await caso('HU025 · Gestión de personal de cocina', [235, 236, 237, 238, 239, 240, 241], async () => {
    const c = s.cocinaCreacion
    verificar(235, c.status === 200 && c.data?.correo === s.cocinaCredenciales.email && c.data?.estado === 'Activo',
      `El dueño registró a ${c.data?.nombre} (${c.data?.correo}, ${c.data?.telefono}) con estado ${c.data?.estado}.`, `HTTP ${c.status}`)
    const ruta = `/api/admin/restaurantes/${R1}/administradores-cocina`
    const corta = await api('POST', ruta, { token: s.dueno1.token, body: { nombre: 'QA Corta', telefono: '3000000000', correo: `qa.corta.${TS}@upb.edu.co`, password: '1234567' } })
    verificar(236, corta.status === 400, `Contraseña de 7 caracteres: HTTP 400.`, `HTTP ${corta.status}`)
    const dup = await api('POST', ruta, { token: s.dueno1.token, body: { nombre: 'QA Dup', telefono: '3000000000', correo: s.cocinaCredenciales.email, password: 'QaCocina123' } })
    verificar(237, dup.status === 409, `Correo repetido: HTTP 409 ("${dup.data?.message}").`, `HTTP ${dup.status}`)
    if (db) {
      const h = await db.query('SELECT password_hash FROM administrador WHERE correo_administrador = $1', [s.cocinaCredenciales.email])
      const hash = h.rows[0]?.password_hash ?? ''
      verificar(238, /^\$2[aby]\$\d{2}\$/.test(hash) && hash !== s.cocinaCredenciales.password, `Se guardó un hash BCrypt (${hash.slice(0, 7)}…).`, `Valor guardado: ${hash.slice(0, 10)}`)
    } else {
      pendiente(238, 'Requiere acceso a PostgreSQL.')
    }
    const segundo = { email: `qa.retiro.${TS}@upb.edu.co`, password: 'QaRetiro123' }
    const creado = await api('POST', ruta, { token: s.dueno1.token, body: { nombre: 'QA Retiro', telefono: '3000000098', correo: segundo.email, password: segundo.password } })
    const retiro = await api('DELETE', `${ruta}/${creado.data?.administradorId}`, { token: s.dueno1.token })
    let estadoBd = 'sin BD'
    if (db) {
      const e = await db.query('SELECT estado FROM administrador_restaurante WHERE administrador_id = $1 AND restaurante_id = $2', [creado.data?.administradorId, R1])
      estadoBd = e.rows[0]?.estado
    }
    verificar(239, retiro.status === 200 && (estadoBd === 'Inactivo' || estadoBd === 'sin BD'), `Retiro: HTTP ${retiro.status}; asignación en BD: ${estadoBd} (la cuenta no se borra).`, `HTTP ${retiro.status}; estado: ${estadoBd}`)
    const loginRetirado = await api('POST', '/api/admin/login', { body: segundo })
    const listado = await api('GET', ruta, { token: s.dueno1.token })
    const aparece = (listado.data ?? []).some((a) => a.correo === segundo.email)
    verificar(240, loginRetirado.status === 401 && !aparece, `El retirado no puede ingresar (HTTP ${loginRetirado.status}) y no aparece en el listado de activos.`, `Login: ${loginRetirado.status}; en listado: ${aparece}`)
    const cocinaGestiona = await api('POST', ruta, { token: s.cocina.token, body: { nombre: 'QA X', telefono: '3000000000', correo: `qa.x.${TS}@upb.edu.co`, password: 'QaCocina123' } })
    verificar(241, cocinaGestiona.status === 403, `Rol cocina intentando registrar personal: HTTP ${cocinaGestiona.status}.`, `HTTP ${cocinaGestiona.status}`)
  })
}

async function pruebasHistorialYMetricas() {
  await caso('HU027 · Historial del cliente', [248, 249, 250, 251], async () => {
    const r = await api('GET', `/api/pedidos/historial?correo=${encodeURIComponent(CLIENTE.clienteCorreo)}&telefono=${CLIENTE.clienteTelefono}`)
    const lista = Array.isArray(r.data) ? r.data : []
    verificar(249, r.status === 200 && lista.length > 0 && lista.every((p) => p.codigoSeguimiento),
      `Con correo y teléfono se encontraron ${lista.length} pedidos. (Se piden ambos datos para proteger la privacidad del cliente.)`, `HTTP ${r.status}; pedidos: ${lista.length}`)

    const { contexto, page } = await nuevaPagina()
    await page.goto(config.frontUrl + '/historial')
    const titulo = await page.getByRole('heading', { name: 'Mis pedidos', exact: true }).isVisible()
    const provisional = await page.getByText('Mi último pedido').count()
    verificar(248, titulo && provisional === 0, 'La ruta /historial muestra el historial real (búsqueda y lista de pedidos).', 'Aún se ve el contenido provisional.')
    await page.getByLabel('Correo institucional').fill(CLIENTE.clienteCorreo)
    await page.getByLabel('Teléfono celular').fill(CLIENTE.clienteTelefono)
    await page.getByRole('button', { name: 'Ver mi historial' }).click()
    const item = page.locator('.client-results .order-history-item').first()
    await item.waitFor()
    const texto = await item.innerText()
    await item.getByRole('link', { name: 'Seguimiento' }).click()
    await page.waitForURL(/\/seguimiento\//)
    verificar(250, /\$/.test(texto) && /\d{4}/.test(texto) && /\S/.test(await page.locator('.tracking-status').innerText()),
      `Cada pedido muestra estado, total y fecha (${texto.replace(/\s+/g, ' ').slice(0, 120)}) y abre su seguimiento.`, `Texto: ${texto}`)
    await page.goto(config.frontUrl + '/historial')
    await page.getByLabel('Correo institucional').fill(`sin.pedidos.${TS}@upb.edu.co`)
    await page.getByLabel('Teléfono celular').fill('3009999999')
    await page.getByRole('button', { name: 'Ver mi historial' }).click()
    const vacio = page.getByText('No encontramos pedidos con esos datos')
    await vacio.waitFor()
    verificar(251, await vacio.isVisible(), 'Sin pedidos se muestra "No encontramos pedidos con esos datos".', 'Sin mensaje para historial vacío.')
    await captura(page, 'HU027-historial')
    await contexto.close()
  })

  await caso('HU028 · Métricas reales', [252, 253, 254], async () => {
    const ruta = (id) => `/api/admin/pedidos/estadisticas?restauranteId=${id}`
    const antes = (await api('GET', ruta(R1), { token: s.dueno1.token })).data
    const antesR2 = (await api('GET', ruta(R2), { token: s.dueno2.token })).data
    const p = await pedidoNuevo([{ productoId: s.prodB.id, cantidad: 1 }])
    await pagar(p)
    const despues = (await api('GET', ruta(R1), { token: s.dueno1.token })).data
    const despuesR2 = (await api('GET', ruta(R2), { token: s.dueno2.token })).data
    const ajeno = await api('GET', ruta(R1), { token: s.dueno2.token })
    const dHoy = Number(despues.ingresosHoy) - Number(antes.ingresosHoy)
    const dMes = Number(despues.ingresosMes) - Number(antes.ingresosMes)
    verificar(252, despues.pedidosHoy - antes.pedidosHoy === 1 && dHoy === Number(p.total),
      `Tras pagar un pedido de ${p.total}: pedidos hoy ${antes.pedidosHoy} → ${despues.pedidosHoy}, ventas hoy +${dHoy}.`, `Pedidos: ${antes.pedidosHoy}→${despues.pedidosHoy}; ventas +${dHoy}`)
    verificar(253, dMes === Number(p.total), `Ventas del mes +${dMes} (calculadas con los pagos reales).`, `Ventas del mes +${dMes}`)
    verificar(254, ajeno.status === 403 && Number(despuesR2.ingresosHoy) === Number(antesR2.ingresosHoy),
      `Otra cafetería no ve estas métricas (HTTP ${ajeno.status}) y sus cifras no cambiaron.`, `HTTP ${ajeno.status}; R2 hoy: ${antesR2.ingresosHoy}→${despuesR2.ingresosHoy}`)
  })
}

async function pruebasConfiguracionCafeteria() {
  await caso('HU029 · Estado, tiempo y datos de la cafetería', [258, 259, 260, 261, 263], async () => {
    const t = s.dueno1.token
    const vistos = []
    for (const estado of ['Alta demanda', 'Cerrado', 'Abierto']) {
      const r = await configurarRestaurante(t, R1, { estado })
      const actual = (await restaurantes()).find((x) => Number(x.id) === R1)?.estado
      vistos.push(`${estado}: ${r.status}/${actual}`)
    }
    verificar(258, vistos.every((v) => /200\/(.+)$/.test(v) && v.split(':')[0] === v.split('/')[1]), `Cambios: ${vistos.join(' · ')}`, `Cambios: ${vistos.join(' · ')}`)
    await configurarRestaurante(t, R1, { tiempoEstimadoMin: 15 })
    const tiempo = (await restaurantes()).find((x) => Number(x.id) === R1)?.tiempoEstimadoMin
    verificar(259, tiempo === 15, `Tiempo estimado actualizado a ${tiempo} min.`, `Tiempo: ${tiempo}`)
    const cocina = await configurarRestaurante(s.cocina.token, R1, { estado: 'Cerrado' })
    verificar(260, cocina.status === 403, `El rol cocina no puede cambiar el estado (HTTP ${cocina.status}).`, `HTTP ${cocina.status}`)

    await configurarRestaurante(t, R1, { estado: 'Alta demanda' })
    const { contexto, page } = await nuevaPagina()
    await page.goto(config.frontUrl + '/')
    const card = page.locator('.restaurant-card').filter({ hasText: s.r1Original.nombre })
    const estadoCard = await card.locator('.restaurant-card__status').innerText()
    await page.goto(`${config.frontUrl}/restaurante/${R1}`)
    const estadoMenu = await page.locator('.restaurant-menu__status').innerText()
    verificar(261, /Alta demanda/.test(estadoCard) && /Alta demanda/.test(estadoMenu), `Card: "${estadoCard}" · Menú: "${estadoMenu}"`, `Card: ${estadoCard}; menú: ${estadoMenu}`)
    await configurarRestaurante(t, R1, { estado: 'Abierto' })

    const nombreQa = `${s.r1Original.nombre}`.slice(0, 44) + ' (QA)'
    const horario = 'Lunes a viernes, 7:00 a. m. - 5:00 p. m. (QA)'
    const cambio = await configurarRestaurante(t, R1, { nombre: nombreQa, imagenUrl: PNG_DATA_URL, horario })
    const cat = await api('POST', '/api/categorias', { token: t, body: { nombre: `QA Categoría ${TS}`, restauranteId: R1 } })
    if (db && cat.data?.id) limpieza.push(() => db.query('DELETE FROM tipo_producto WHERE tipo_producto_id = $1 AND NOT EXISTS (SELECT 1 FROM producto WHERE tipo_producto_id = $1)', [Number(cat.data.id)]))
    const actual = (await restaurantes()).find((x) => Number(x.id) === R1)
    await page.goto(config.frontUrl + '/')
    const cardHorario = await page.locator('.restaurant-card').filter({ hasText: nombreQa }).innerText().catch(() => '')
    await captura(page, 'HU029-cafeteria')
    await contexto.close()
    verificar(263, cambio.status === 200 && actual?.nombre === nombreQa && actual?.imagenUrl?.startsWith('data:image') && actual?.horario === horario && [200, 201].includes(cat.status) && cardHorario.includes('Horario'),
      `El dueño editó nombre, imagen y horario ("${actual?.horario}") y creó la categoría "QA Categoría ${TS}" (HTTP ${cat.status}).`,
      `PATCH: ${cambio.status}; nombre: ${actual?.nombre}; horario: ${actual?.horario}; categoría: ${cat.status}; card: ${cardHorario.slice(0, 80)}`)
  })
}

async function pruebasRegistroYAprobacion() {
  await caso('HU030 / HU031 · Registro de cafetería y aprobación UPB', [264, 265, 266, 267, 268, 269, 270, 272, 273, 274, 275], async () => {
    const { contexto, page } = await nuevaPagina()
    await page.goto(config.frontUrl + '/admin')
    await page.getByRole('button', { name: 'Registrar restaurante' }).click()
    const etiquetas = await page.locator('.registration-form label').allInnerTexts()
    verificar(264, etiquetas.length >= 6, `Formulario de registro: ${etiquetas.map((e) => e.split('\n')[0]).join(', ')}.`, `Campos: ${etiquetas.join(', ')}`)
    await page.getByRole('button', { name: 'Enviar solicitud' }).click()
    const validacion = await page.locator('.registration-form').evaluate((f) => ({
      valido: f.checkValidity(),
      mensaje: f.querySelector('input:invalid')?.validationMessage ?? '',
    }))
    await captura(page, 'HU030-registro')
    await contexto.close()

    const invalido = await api('POST', '/api/solicitudes-registro', { body: { nombreSolicitante: '', correoSolicitante: 'malo' } })
    verificar(265, !validacion.valido && validacion.mensaje && invalido.status === 400,
      `El formulario no se envía con campos vacíos ("${validacion.mensaje}") y la API responde 400 a datos inválidos.`, `Válido: ${validacion.valido}; API: ${invalido.status}`)

    const correo = `qa.dueno.${TS}@upb.edu.co`
    const nombreCafeteria = `QA Cafetería ${TS}`
    const solicitud = await api('POST', '/api/solicitudes-registro', {
      body: { nombreSolicitante: 'QA Dueño Nuevo', telefonoSolicitante: '3001112233', correoSolicitante: correo, nombreRestaurante: nombreCafeteria, ubicacionRestaurante: 'Bloque QA', tiempoPreparacionMin: 12 },
    })
    verificar(266, solicitud.status === 201 && solicitud.data?.solicitudId,
      `Solicitud #${solicitud.data?.solicitudId} guardada con los datos del administrador y de la cafetería (la cuenta se crea al aprobarla).`, `HTTP ${solicitud.status} ${solicitud.data?.message ?? ''}`)
    verificar(267, solicitud.data?.estado === 'PENDIENTE', `Estado inicial: ${solicitud.data?.estado}.`, `Estado: ${solicitud.data?.estado}`)
    const loginPendiente = await api('POST', '/api/admin/login', { body: { email: correo, password: 'QaDueno123' } })
    verificar(268, loginPendiente.status === 401, `La cuenta pendiente no puede ingresar (HTTP ${loginPendiente.status}).`, `HTTP ${loginPendiente.status}`)
    const duplicado = await api('POST', '/api/solicitudes-registro', {
      body: { nombreSolicitante: 'QA', telefonoSolicitante: '3001112233', correoSolicitante: config.dueno1.email, nombreRestaurante: 'QA Dup', ubicacionRestaurante: 'QA', tiempoPreparacionMin: 10 },
    })
    verificar(269, duplicado.status === 409, `Correo existente: HTTP 409 ("${duplicado.data?.message}").`, `HTTP ${duplicado.status}`)

    if (!config.claveUpb) {
      for (const n of [270, 272, 273, 274, 275]) pendiente(n, 'Configura APP_UPB_REVISOR_CLAVE en P_upbFood/.env y reconstruye el backend para probar el panel del encargado UPB.')
      return
    }
    const h = { 'X-UPB-Revisor-Clave': config.claveUpb }
    const pendientes = await api('GET', '/api/upb/solicitudes?estado=PENDIENTE', { headers: h })
    const encontrada = (pendientes.data ?? []).find((x) => x.id === solicitud.data.solicitudId)
    const panel = await nuevaPagina()
    await panel.page.goto(config.frontUrl + '/upb/solicitudes')
    await panel.page.locator('input[type=password]').fill(config.claveUpb)
    await panel.page.getByRole('button', { name: 'Entrar al panel' }).click()
    const enPanel = await espera(async () => (await panel.page.locator('.request-card').filter({ hasText: nombreCafeteria }).count()) > 0, { timeout: 10_000 })
    await captura(panel.page, 'HU031-panel-upb')
    await panel.contexto.close()
    verificar(270, encontrada && encontrada.correoSolicitante === correo && encontrada.nombreRestaurante === nombreCafeteria && enPanel,
      `La vista lista la solicitud con cafetería "${encontrada?.nombreRestaurante}" y administrador ${encontrada?.nombreSolicitante} (${encontrada?.correoSolicitante}).`, `En API: ${Boolean(encontrada)}; en panel: ${enPanel}`)

    const aprobar = await api('POST', `/api/upb/solicitudes/${solicitud.data.solicitudId}/aprobar`, { headers: h })
    const token = new URL(aprobar.data?.enlaceActivacion ?? 'http://x/?token=').searchParams.get('token')
    const activar = await api('POST', '/api/invitaciones/activar', { body: { token, password: 'QaDueno123' } })
    const visible = (await restaurantes()).find((r) => r.nombre === nombreCafeteria)
    verificar(272, aprobar.status === 200 && activar.status === 200 && Boolean(visible),
      `Aprobada; la cuenta se activó con el enlace y la cafetería "${nombreCafeteria}" aparece en la lista.`, `Aprobar: ${aprobar.status}; activar: ${activar.status} ${activar.data?.mensaje ?? ''}; visible: ${Boolean(visible)}`)
    const nuevoDueno = activar.status === 200 ? await api('POST', '/api/admin/login', { body: { email: correo, password: 'QaDueno123' } }) : { status: 0 }
    const rol = nuevoDueno.data?.asignaciones?.[0]?.tipoAdministradorId
    verificar(275, nuevoDueno.status === 200 && Number(rol) === 1, `El nuevo dueño inicia sesión (HTTP 200, rol dueño en la cafetería ${nuevoDueno.data?.restauranteId}).`, `Login: ${nuevoDueno.status}`)
    if (visible && nuevoDueno.status === 200) {
      limpieza.push(() => api('DELETE', `/api/admin/restaurantes/${visible.id}`, { token: nuevoDueno.data.accessToken, body: { password: 'QaDueno123' } }))
    }

    const correo2 = `qa.rechazo.${TS}@upb.edu.co`
    const nombre2 = `QA Rechazada ${TS}`
    const solicitud2 = await api('POST', '/api/solicitudes-registro', {
      body: { nombreSolicitante: 'QA Rechazo', telefonoSolicitante: '3001112244', correoSolicitante: correo2, nombreRestaurante: nombre2, ubicacionRestaurante: 'Bloque QA', tiempoPreparacionMin: 12 },
    })
    const rechazar = await api('POST', `/api/upb/solicitudes/${solicitud2.data?.solicitudId}/rechazar`, { headers: h, body: { observacion: 'Rechazo de prueba QA' } })
    const loginRechazado = await api('POST', '/api/admin/login', { body: { email: correo2, password: 'QaDueno123' } })
    const noVisible = !(await restaurantes()).some((r) => r.nombre === nombre2)
    verificar(273, rechazar.status === 200 && rechazar.data?.estado === 'RECHAZADA' && loginRechazado.status === 401 && noVisible,
      'Rechazada: no se creó cuenta (login 401) y la cafetería no aparece.', `Rechazo: ${rechazar.status}; login: ${loginRechazado.status}; visible: ${!noVisible}`)
    const todas = await api('GET', '/api/upb/solicitudes?estado=TODAS', { headers: h })
    const estados = Object.fromEntries((todas.data ?? []).filter((x) => [solicitud.data.solicitudId, solicitud2.data?.solicitudId].includes(x.id)).map((x) => [x.id, x.estado]))
    verificar(274, estados[solicitud.data.solicitudId] === 'APROBADA' && estados[solicitud2.data?.solicitudId] === 'RECHAZADA',
      `Estados guardados: #${solicitud.data.solicitudId} APROBADA, #${solicitud2.data?.solicitudId} RECHAZADA (además de las PENDIENTES).`, `Estados: ${JSON.stringify(estados)}`)
  })
}

async function pruebasProductoConHistorial() {
  await caso('HU017 · Retiro de producto con pedidos históricos', [171], async () => {
    const r = await api('DELETE', `/api/products/${s.prodA.id}?restauranteId=${R1}`, { token: s.dueno1.token })
    const publico = (await productosPublicos(R1)).find((p) => Number(p.id) === Number(s.prodA.id))
    verificar(171, r.status === 200 && r.data?.deactivatedInsteadOfDeleted === true && publico?.disponible === false,
      `Con pedidos en el historial el producto se marcó como no disponible: "${r.data?.message}"`, `HTTP ${r.status}; respuesta: ${JSON.stringify(r.data)}`)
  })
}

async function pruebasMaven() {
  await caso('HU024 / HU026 · Pruebas unitarias del backend', [233, 247], async () => {
    if (process.env.QA_SKIP_MAVEN === '1') {
      pendiente(233, 'Omitido con QA_SKIP_MAVEN=1. Ejecuta: cd P_upbFood/Backend && mvnw test -Dtest=AdminAuthorizationServiceTest')
      pendiente(247, 'Omitido con QA_SKIP_MAVEN=1. Ejecuta: cd P_upbFood/Backend && mvnw test -Dtest=ProductControllerTest,AdminAuthorizationServiceTest')
      return
    }
    const pruebas = '-Dtest=AdminAuthorizationServiceTest,ProductControllerTest'
    const win = process.platform === 'win32'
    console.log('   Ejecutando pruebas JUnit (puede tardar unos minutos la primera vez)…')
    let r = spawnSync(win ? 'mvnw.cmd' : './mvnw', ['-q', '-B', 'test', pruebas], { cwd: config.backendDir, encoding: 'utf8', shell: win, timeout: 15 * 60_000 })
    let via = 'mvnw'
    if (r.status !== 0 && /JAVA_HOME|java: not found|no se reconoce|not recognized/i.test(`${r.stderr}${r.stdout}`)) {
      via = 'Docker (maven:3.9-eclipse-temurin-21)'
      r = spawnSync('docker', ['run', '--rm', '-v', `${config.backendDir}:/app`, '-w', '/app', 'maven:3.9-eclipse-temurin-21', 'mvn', '-q', '-B', 'test', pruebas],
        { encoding: 'utf8', timeout: 20 * 60_000 })
    }
    const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`
    fs.writeFileSync(path.join(QA_DIR, 'resultados', 'maven.log'), salida, 'utf8')
    if (r.error || r.status === null) {
      pendiente(233, `No se pudo ejecutar Maven (${r.error?.message ?? 'tiempo agotado'}). Ejecuta mvnw test manualmente.`)
      pendiente(247, `No se pudo ejecutar Maven (${r.error?.message ?? 'tiempo agotado'}).`)
      return
    }
    const fallaron = (salida.match(/FAIL|ERROR\]/g) ?? []).length
    verificar(233, r.status === 0, `AdminAuthorizationServiceTest pasó (vía ${via}).`, `Maven terminó con código ${r.status} (${fallaron} líneas de error). Ver resultados/maven.log`)
    verificar(247, r.status === 0, `ProductControllerTest y AdminAuthorizationServiceTest pasaron (vía ${via}).`, `Maven terminó con código ${r.status}. Ver resultados/maven.log`)
  })
}

// ----------------------------------------------------------------------------
// Ejecución
// ----------------------------------------------------------------------------
async function main() {
  console.log('UPB Food · Plan de pruebas automático (criterios pendientes)\n')
  try {
    await preparar()
  } catch (e) {
    console.error(`\n✖ No se pudo preparar el entorno: ${e.message}`)
    await cerrar()
    process.exit(1)
  }

  // Sesiones para el navegador (cada contexto usa su propio refresh token).
  s.dueno1Ui = await login(config.dueno1)
  s.dueno1NavUi = await login(config.dueno1)
  s.cocinaNavUi = await login(s.cocinaCredenciales)

  const bloques = [
    pruebasCatalogoCliente, pruebasPedidoYCliente, pruebasCocina, pruebasPanelDueno, pruebasApiCatalogo,
    pruebasSeguimientoYConsulta, pruebasSesionYRoles, pruebasHistorialYMetricas, pruebasConfiguracionCafeteria,
    pruebasRegistroYAprobacion, pruebasProductoConHistorial, pruebasMaven,
  ]
  for (const bloque of bloques) {
    try {
      await bloque()
    } catch (e) {
      console.error(`Bloque ${bloque.name} interrumpido: ${e.message}`)
    }
  }
  await cerrar()

  const r = await escribirResultados({
    plantilla: path.join(QA_DIR, 'Plan_de_Pruebas_UPB.xlsx'),
    carpeta: path.join(QA_DIR, 'resultados'),
    inicio: INICIO,
  })
  console.log(`\n══════════════════════════════════════════════`)
  console.log(`Criterios: ${r.total} · OK: ${r.ok} · ERROR: ${r.error} · PENDIENTE: ${r.pendiente}`)
  console.log(`Excel:   ${r.archivoExcel}`)
  console.log(`Reporte: ${r.archivoReporte}`)
  console.log(`Capturas: ${CAPTURAS}`)
  process.exit(r.error > 0 ? 2 : 0)
}

async function cerrar() {
  for (const tarea of limpieza.reverse()) {
    try { await tarea() } catch { /* limpieza best-effort */ }
  }
  limpieza.length = 0
  if (browser) await browser.close().catch(() => null)
  if (db) await db.end().catch(() => null)
}

main()

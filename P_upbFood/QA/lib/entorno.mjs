// Configuración, cliente HTTP con límite de peticiones y acceso a la base de datos.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

export const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function leerEnv(archivo) {
  const valores = {}
  if (!fs.existsSync(archivo)) return valores
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#') || !limpia.includes('=')) continue
    const i = limpia.indexOf('=')
    valores[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return valores
}

const env = { ...leerEnv(path.join(QA_DIR, '..', '.env')), ...process.env }
const puertoFront = env.FRONTEND_PORT || '80'

export const config = {
  frontUrl: (env.QA_FRONT_URL || `http://localhost${puertoFront === '80' ? '' : `:${puertoFront}`}`).replace(/\/+$/, ''),
  apiUrl: (env.QA_API_URL || 'http://localhost:8080').replace(/\/+$/, ''),
  dueno1: { email: env.QA_OWNER1_EMAIL || 'admin@upb.edu.co', password: env.QA_OWNER1_PASSWORD || 'admin123' },
  dueno2: { email: env.QA_OWNER2_EMAIL || 'admin2@upb.edu.co', password: env.QA_OWNER2_PASSWORD || 'admin456' },
  restaurante1: Number(env.QA_RESTAURANTE1 || 1),
  restaurante2: Number(env.QA_RESTAURANTE2 || 2),
  claveUpb: env.APP_UPB_REVISOR_CLAVE || '',
  db: {
    host: env.QA_DB_HOST || 'localhost',
    port: Number(env.QA_DB_PORT || 5432),
    user: env.POSTGRES_USER || 'upbfood',
    password: env.POSTGRES_PASSWORD || 'upbfood123',
    database: env.POSTGRES_DB || 'upbfood',
  },
  headless: env.QA_HEADLESS !== 'false',
  backendDir: path.join(QA_DIR, '..', 'Backend'),
}

// ---------------------------------------------------------------------------
// Límites del RateLimitFilter del backend (ventanas de 60 s por IP). El cliente
// espera antes de superarlos para que ninguna prueba falle por HTTP 429.
// ---------------------------------------------------------------------------
const reglas = [
  { nombre: 'login', max: 9, ventana: 61_000, aplica: (m, p) => m === 'POST' && p === '/api/admin/login' },
  { nombre: 'registro', max: 5, ventana: 15 * 60_000, aplica: (m, p) => m === 'POST' && p === '/api/solicitudes-registro' },
  { nombre: 'consulta', max: 22, ventana: 61_000, aplica: (m, p) => m === 'GET' && (p === '/api/pedidos/consulta' || p === '/api/pedidos/seguimiento/consulta') },
  { nombre: 'historial', max: 17, ventana: 61_000, aplica: (m, p) => m === 'GET' && p === '/api/pedidos/historial' },
  { nombre: 'upb', max: 27, ventana: 61_000, aplica: (m, p) => p.startsWith('/api/upb/') },
  { nombre: 'activar', max: 9, ventana: 61_000, aplica: (m, p) => m === 'POST' && p === '/api/invitaciones/activar' },
]
const marcas = new Map()
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

export async function respetarLimite(metodo, ruta) {
  const regla = reglas.find((r) => r.aplica(metodo, ruta))
  if (!regla) return
  const lista = marcas.get(regla.nombre) ?? []
  for (;;) {
    const ahora = Date.now()
    while (lista.length && ahora - lista[0] > regla.ventana) lista.shift()
    if (lista.length < regla.max) break
    const espera = regla.ventana - (ahora - lista[0]) + 250
    if (regla.nombre === 'registro') {
      throw new Error('Se alcanzó el límite de 5 solicitudes de registro cada 15 minutos. Vuelve a ejecutar más tarde.')
    }
    console.log(`   … esperando ${Math.ceil(espera / 1000)} s por el límite de peticiones (${regla.nombre})`)
    await dormir(espera)
  }
  lista.push(Date.now())
  marcas.set(regla.nombre, lista)
}

/** Registra peticiones hechas por el navegador (cuentan para el mismo límite). */
export function registrarPeticionNavegador(metodo, ruta) {
  const regla = reglas.find((r) => r.aplica(metodo, ruta))
  if (!regla) return
  const lista = marcas.get(regla.nombre) ?? []
  lista.push(Date.now())
  marcas.set(regla.nombre, lista)
}

export async function api(metodo, ruta, { token, body, headers = {}, cookie } = {}) {
  await respetarLimite(metodo, ruta.split('?')[0])
  const h = { Accept: 'application/json', ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (cookie) h.Cookie = cookie
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const inicio = Date.now()
  const res = await fetch(`${config.apiUrl}${ruta}`, {
    method: metodo,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const texto = await res.text()
  let data = null
  try {
    data = texto ? JSON.parse(texto) : null
  } catch {
    data = texto
  }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  return { status: res.status, data, setCookies, ms: Date.now() - inicio }
}

export function cookieRefresh(setCookies) {
  for (const c of setCookies ?? []) {
    const m = c.match(/upbfood_refresh_token=([^;]*)/)
    if (m && m[1]) return m[1]
  }
  return null
}

export async function login(credenciales) {
  const r = await api('POST', '/api/admin/login', { body: credenciales })
  if (r.status !== 200 || !r.data?.accessToken) {
    const e = new Error(`Login fallido para ${credenciales.email}: HTTP ${r.status} ${r.data?.message ?? ''}`)
    e.respuesta = r
    throw e
  }
  return { token: r.data.accessToken, refresh: cookieRefresh(r.setCookies), data: r.data, email: credenciales.email }
}

// Mismo formato que AdminAuthController.hashToken: SHA-256 codificado en Base64 URL sin relleno.
export const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('base64url')

export async function conectarBd() {
  const cliente = new pg.Client(config.db)
  await cliente.connect()
  return cliente
}

export { dormir }

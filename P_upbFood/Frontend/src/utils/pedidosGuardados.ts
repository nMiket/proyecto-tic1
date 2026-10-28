// HU027: pedidos realizados desde este navegador. Permiten mostrar el historial
// sin pedir datos al cliente; la consulta completa se hace por correo y teléfono.

export type PedidoGuardado = {
  id: number
  codigoSeguimiento: string
  total: number
  clienteNombre?: string
  clienteCorreo?: string
  clienteTelefono?: string
  fecha?: string
}

const ORDERS_KEY = 'upbfood.orders'
const LAST_ORDER_KEY = 'upbfood.lastOrder'
const MAX_PEDIDOS = 20

function esPedidoGuardado(valor: unknown): valor is PedidoGuardado {
  if (!valor || typeof valor !== 'object') return false
  const pedido = valor as PedidoGuardado
  return typeof pedido.codigoSeguimiento === 'string' && pedido.codigoSeguimiento.length > 0
}

export function leerPedidosGuardados(): PedidoGuardado[] {
  const pedidos: PedidoGuardado[] = []
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    const lista = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(lista)) pedidos.push(...lista.filter(esPedidoGuardado))

    // Compatibilidad con la versión anterior, que solo guardaba el último pedido.
    const rawUltimo = localStorage.getItem(LAST_ORDER_KEY)
    const ultimo = rawUltimo ? (JSON.parse(rawUltimo) as unknown) : null
    if (esPedidoGuardado(ultimo) && !pedidos.some((p) => p.codigoSeguimiento === ultimo.codigoSeguimiento)) {
      pedidos.unshift(ultimo)
    }
  } catch {
    // Almacenamiento no disponible (modo privado o datos corruptos).
  }
  return pedidos
}

export function guardarPedido(pedido: PedidoGuardado) {
  try {
    const registro = { ...pedido, fecha: pedido.fecha ?? new Date().toISOString() }
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(registro))
    const actuales = leerPedidosGuardados().filter(
      (item) => item.codigoSeguimiento !== registro.codigoSeguimiento,
    )
    localStorage.setItem(ORDERS_KEY, JSON.stringify([registro, ...actuales].slice(0, MAX_PEDIDOS)))
  } catch {
    // Si el navegador no permite guardar, el cliente aún puede consultar por correo y teléfono.
  }
}

export function olvidarPedidosGuardados() {
  try {
    localStorage.removeItem(ORDERS_KEY)
    localStorage.removeItem(LAST_ORDER_KEY)
  } catch {
    // Ignorar errores de almacenamiento.
  }
}

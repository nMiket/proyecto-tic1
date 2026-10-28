import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '../auth'
import {
  leerPedidosGuardados,
  olvidarPedidosGuardados,
  type PedidoGuardado,
} from '../utils/pedidosGuardados'
import './PaginasCliente.css'

// HU027 - Historial de pedidos del cliente.

type PedidoHistorial = {
  id: number
  codigoSeguimiento: string
  nombreRestaurante?: string
  estado: string
  total: number | string
  fecha?: string | null
  horaRecogida?: string | null
  cantidadProductos?: number
}

const etiquetasEstado: Record<string, string> = {
  PENDIENTE: 'Pago pendiente',
  EN_PAGO: 'Pago pendiente',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo para recoger',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

const precioCOP = (valor: number | string) =>
  `$${Number(valor ?? 0).toLocaleString('es-CO')}`

function formatearFecha(valor?: string | null) {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function claseEstado(estado: string) {
  if (estado === 'CANCELADO') return 'status-pill status-pill--danger'
  if (estado === 'ENTREGADO') return 'status-pill status-pill--done'
  if (estado === 'LISTO') return 'status-pill status-pill--ready'
  if (estado === 'PENDIENTE' || estado === 'EN_PAGO') return 'status-pill status-pill--warning'
  return 'status-pill'
}

export default function HistorialPedidosPage() {
  const [guardados, setGuardados] = useState<PedidoGuardado[]>(() => leerPedidosGuardados())
  const ultimoContacto = guardados.find((pedido) => pedido.clienteCorreo && pedido.clienteTelefono)

  const [correo, setCorreo] = useState(ultimoContacto?.clienteCorreo ?? '')
  const [telefono, setTelefono] = useState(ultimoContacto?.clienteTelefono ?? '')
  const [pedidos, setPedidos] = useState<PedidoHistorial[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!correo.trim() || !telefono.trim()) {
      setError('Ingresa el correo y el teléfono con los que hiciste tus pedidos.')
      return
    }

    setCargando(true)
    try {
      const params = new URLSearchParams({ correo: correo.trim(), telefono: telefono.trim() })
      const respuesta = await apiFetch(`${getApiBaseUrl()}/api/pedidos/historial?${params.toString()}`)
      if (!respuesta.ok) {
        const data = (await respuesta.json().catch(() => null)) as { message?: string } | null
        setPedidos(null)
        setError(
          respuesta.status === 429
            ? 'Hiciste demasiadas consultas seguidas. Espera un momento e inténtalo de nuevo.'
            : data?.message ?? 'No fue posible consultar tu historial.',
        )
        return
      }
      setPedidos((await respuesta.json()) as PedidoHistorial[])
    } catch {
      setPedidos(null)
      setError('No se pudo conectar con el servidor. Inténtalo nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  function olvidar() {
    olvidarPedidosGuardados()
    setGuardados([])
  }

  return (
    <section className="client-page">
      <header className="client-page__header">
        <p className="section-kicker">Historial</p>
        <h1>Mis pedidos</h1>
        <p>
          Consulta tus compras anteriores y entra al seguimiento de cada pedido. No necesitas
          crear una cuenta: usa el correo y el teléfono que registraste al pedir.
        </p>
      </header>

      <div className="client-page__grid">
        <form className="client-card client-form" onSubmit={buscar} aria-label="Buscar historial de pedidos">
          <h2>Buscar todos mis pedidos</h2>
          <label>
            Correo institucional
            <input
              type="email"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              placeholder="nombre@upb.edu.co"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Teléfono celular
            <input
              type="tel"
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              placeholder="3001234567"
              autoComplete="tel"
              required
            />
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="submit" className="client-button" disabled={cargando}>
            {cargando ? 'Buscando...' : 'Ver mi historial'}
          </button>
          <p className="client-hint">
            Pedimos los dos datos para que nadie más pueda ver tus pedidos.
          </p>
        </form>

        <div className="client-card">
          <div className="client-card__heading">
            <h2>Pedidos en este dispositivo</h2>
            {guardados.length > 0 && (
              <button type="button" className="client-link-button" onClick={olvidar}>
                Olvidar
              </button>
            )}
          </div>
          {guardados.length === 0 ? (
            <p className="client-empty">
              Aún no hay pedidos guardados en este navegador.{' '}
              <Link to="/">Explora las cafeterías</Link> o busca tus pedidos con tu correo y teléfono.
            </p>
          ) : (
            <ul className="order-history-list">
              {guardados.map((pedido) => (
                <li key={pedido.codigoSeguimiento} className="order-history-item">
                  <div>
                    <strong>Pedido #{pedido.id}</strong>
                    <span>
                      {precioCOP(pedido.total)}
                      {pedido.fecha ? ` · ${formatearFecha(pedido.fecha)}` : ''}
                    </span>
                  </div>
                  <Link className="client-button client-button--small" to={`/seguimiento/${pedido.codigoSeguimiento}`}>
                    Ver estado
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pedidos !== null && (
        <section className="client-card client-results" aria-live="polite">
          <h2>
            {pedidos.length === 0
              ? 'No encontramos pedidos con esos datos'
              : `${pedidos.length} ${pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}`}
          </h2>
          {pedidos.length === 0 ? (
            <p className="client-empty">
              Verifica que el correo y el teléfono sean los mismos que usaste al hacer el pedido.
            </p>
          ) : (
            <ul className="order-history-list">
              {pedidos.map((pedido) => (
                <li key={pedido.codigoSeguimiento} className="order-history-item">
                  <div>
                    <strong>
                      Pedido #{pedido.id} · {pedido.nombreRestaurante ?? 'Cafetería'}
                    </strong>
                    <span>
                      {formatearFecha(pedido.fecha)} · {pedido.cantidadProductos ?? 0}{' '}
                      {Number(pedido.cantidadProductos) === 1 ? 'producto' : 'productos'} ·{' '}
                      {precioCOP(pedido.total)}
                    </span>
                  </div>
                  <div className="order-history-item__actions">
                    <span className={claseEstado(pedido.estado)}>
                      {etiquetasEstado[pedido.estado] ?? pedido.estado}
                    </span>
                    <Link className="client-button client-button--small" to={`/seguimiento/${pedido.codigoSeguimiento}`}>
                      Seguimiento
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  )
}

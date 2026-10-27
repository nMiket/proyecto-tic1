import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiBaseUrl } from '../auth'
import './SeguimientoPedidoPage.css'

type PedidoConsultado = {
  id: number
  codigoSeguimiento: string
  nombreRestaurante: string
  estado: string
  total: number
  fecha?: string
  horaRecogida?: string | null
  clienteNombre?: string
  productos?: Array<{
    detalle_pedido_id: number
    nombre_producto: string
    cantidad: number
    precio_unitario: number | string
    adiciones?: string | null
    observaciones?: string | null
    subtotal?: number | string
  }>
}

const estados = ['PENDIENTE', 'EN_PAGO', 'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']
const etiquetasEstado: Record<string, string> = {
  PENDIENTE: 'Pendiente de pago',
  EN_PAGO: 'Procesando pago',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo para recoger',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

function formatearFecha(valor?: string | null) {
  if (!valor) return 'Sin hora programada'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SeguimientoPedidoPage() {
  const { codigo } = useParams()
  const [modoBusqueda, setModoBusqueda] = useState<'codigo' | 'datos'>('codigo')
  const [codigoSeguimiento, setCodigoSeguimiento] = useState(codigo ?? '')
  const [numeroPedido, setNumeroPedido] = useState('')
  const [contactoCliente, setContactoCliente] = useState('')
  const [pedido, setPedido] = useState<PedidoConsultado | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const ultimoPedidoGuardado = useMemo(() => {
    try {
      const raw = localStorage.getItem('upbfood.lastOrder')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { id?: number; codigoSeguimiento?: string }
      return parsed?.codigoSeguimiento ? parsed : null
    } catch {
      return null
    }
  }, [])

  const consultar = async (event?: FormEvent, codigoDesdeRuta?: string, silenciosa = false) => {
    event?.preventDefault()
    if (!silenciosa) {
      setError('')
      setPedido(null)
    }

    if (!codigoDesdeRuta && modoBusqueda === 'datos') {
      const idNum = Number(numeroPedido.trim())
      const contacto = contactoCliente.trim()
      if (!Number.isInteger(idNum) || idNum <= 0) {
        if (!silenciosa) setError('Ingresa un número de pedido válido (ej. 12).')
        return
      }
      if (!contacto) {
        if (!silenciosa) setError('Ingresa el correo o teléfono que usaste al crear el pedido.')
        return
      }

      if (!silenciosa) setCargando(true)
      try {
        const params = new URLSearchParams({ pedidoId: String(idNum) })
        if (contacto.includes('@')) {
          params.set('correo', contacto)
        } else {
          params.set('telefono', contacto)
        }
        const response = await fetch(`${getApiBaseUrl()}/api/pedidos/consulta?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        })
        const data = (await response.json().catch(() => null)) as
          | ({ message?: string; detail?: string } & Partial<PedidoConsultado>)
          | null

        if (!response.ok) {
          if (silenciosa) return
          throw new Error(
            data?.message ??
              data?.detail ??
              'No encontramos un pedido con esos datos. Verifica el número y tu correo o teléfono.',
          )
        }
        setPedido(data as PedidoConsultado)
      } catch (requestError) {
        if (!silenciosa) {
          setError(
            requestError instanceof Error ? requestError.message : 'No se pudo consultar el pedido.',
          )
        }
      } finally {
        if (!silenciosa) setCargando(false)
      }
      return
    }

    const codigoLimpio = (codigoDesdeRuta ?? codigoSeguimiento).trim()

    if (!codigoLimpio) {
      if (!silenciosa) setError('Ingresa el código de seguimiento.')
      return
    }

    // El endpoint por código espera un UUID. Evitamos una petición inválida
    // y mostramos una indicación útil antes de contactar al backend.
    if (codigoLimpio && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigoLimpio)) {
      if (!silenciosa) setError('El código de seguimiento no tiene el formato esperado. Revisa el código recibido al crear el pedido.')
      return
    }

    if (!silenciosa) setCargando(true)
    try {
      const url = `${getApiBaseUrl()}/api/pedidos/seguimiento/${encodeURIComponent(codigoLimpio)}`

      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => null) as ({ message?: string; detail?: string } & Partial<PedidoConsultado>) | null

      if (!response.ok) {
        if (silenciosa) return
        if (response.status === 404) throw new Error(data?.message ?? 'No encontramos un pedido con esos datos. Verifica el código e inténtalo nuevamente.')
        if (response.status >= 500) throw new Error('El servicio de seguimiento no está disponible en este momento. Inténtalo de nuevo en unos minutos.')
        throw new Error(data?.message ?? data?.detail ?? 'No se pudo consultar el pedido. Revisa los datos e inténtalo nuevamente.')
      }

      setPedido(data as PedidoConsultado)
    } catch (requestError) {
      if (!silenciosa) setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar el pedido.')
    } finally {
      if (!silenciosa) setCargando(false)
    }
  }

  useEffect(() => {
    if (codigo) {
      setCodigoSeguimiento(codigo)
      void Promise.resolve().then(() => consultar(undefined, codigo))
    }
    // Solo repetir la consulta cuando cambie el código de la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  useEffect(() => {
    if (!pedido?.codigoSeguimiento) return
    const codigoActual = pedido.codigoSeguimiento
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/pedidos/seguimiento/${encodeURIComponent(codigoActual)}`, { headers: { Accept: 'application/json' } })
        if (!response.ok) return
        setPedido(await response.json() as PedidoConsultado)
      } catch {
        // La última respuesta válida se conserva; el siguiente ciclo reintentará.
      }
    }, 10000)
    return () => window.clearInterval(interval)
  }, [pedido?.codigoSeguimiento])

  const estadoActual = pedido ? pedido.estado : ''
  const indiceActual = estados.indexOf(estadoActual)

  return (
    <section className="tracking-page">
      <div className="tracking-intro">
        <p className="section-kicker">Seguimiento UPB Food</p>
        <h1>Consulta tu pedido cuando quieras.</h1>
        <p>Usa el código que recibiste al pagar o combina el número de pedido con tus datos de contacto.</p>
      </div>

      <div className="tracking-layout">
        <form className="tracking-form" onSubmit={consultar}>
          <div className="tracking-form__header">
            <span className="tracking-form__mark">BUSCAR PEDIDO</span>
            <h2>¿Dónde está mi pedido?</h2>
            <p>Puedes usar cualquiera de las dos formas de búsqueda.</p>
          </div>

          <div className="tracking-mode-tabs" role="tablist" aria-label="Modo de búsqueda">
            <button
              type="button"
              role="tab"
              aria-selected={modoBusqueda === 'codigo'}
              className={`tracking-mode-tab ${modoBusqueda === 'codigo' ? 'is-active' : ''}`}
              onClick={() => {
                setModoBusqueda('codigo')
                setError('')
              }}
            >
              Por código UUID
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modoBusqueda === 'datos'}
              className={`tracking-mode-tab ${modoBusqueda === 'datos' ? 'is-active' : ''}`}
              onClick={() => {
                setModoBusqueda('datos')
                setError('')
              }}
            >
              Por # pedido + contacto
            </button>
          </div>

          {modoBusqueda === 'codigo' ? (
            <label>
              Código de seguimiento
              <input
                value={codigoSeguimiento}
                onChange={(event) => setCodigoSeguimiento(event.target.value)}
                placeholder="Ej. 5eee1287-4692-4a8e..."
              />
            </label>
          ) : (
            <>
              <label>
                Número de pedido
                <input
                  type="number"
                  min={1}
                  value={numeroPedido}
                  onChange={(event) => setNumeroPedido(event.target.value)}
                  placeholder="Ej. 15"
                />
              </label>
              <label>
                Correo o teléfono registrado
                <input
                  value={contactoCliente}
                  onChange={(event) => setContactoCliente(event.target.value)}
                  placeholder="Ej. estudiante@upb.edu.co o 3001234567"
                />
              </label>
            </>
          )}

          {ultimoPedidoGuardado?.codigoSeguimiento && (
            <button
              type="button"
              className="tracking-last-order-button"
              onClick={() => {
                const code = String(ultimoPedidoGuardado.codigoSeguimiento)
                setModoBusqueda('codigo')
                setCodigoSeguimiento(code)
                void consultar(undefined, code)
              }}
            >
              Consultar mi último pedido reciente
              {ultimoPedidoGuardado.id ? ` (#${ultimoPedidoGuardado.id})` : ''}
            </button>
          )}

          {error && <p className="tracking-error" role="alert">{error}</p>}
          <button type="submit" disabled={cargando}>
            {cargando ? 'Consultando...' : 'Consultar pedido'}
          </button>
        </form>

        <div className="tracking-result" aria-live="polite">
          {!pedido ? (
            <div className="tracking-result__empty">
              <span className="tracking-result__icon">UPB</span>
              <h2>Tu pedido aparecerá aquí</h2>
              <p>Consulta para ver el estado, la cafetería, el total y la hora de recogida.</p>
            </div>
          ) : (
            <>
              <div className="tracking-result__topline">
                <div>
                  <p className="section-kicker">Pedido #{pedido.id}</p>
                  <h2>{pedido.nombreRestaurante}</h2>
                </div>
                <span className={`tracking-status tracking-status--${estadoActual.toLowerCase()}`}>
                  {etiquetasEstado[pedido.estado] ?? pedido.estado}
                </span>
              </div>

              {(pedido.estado === 'PENDIENTE' || pedido.estado === 'EN_PAGO') && (
                <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', padding: '1rem', borderRadius: '0.85rem', margin: '1rem 0' }}>
                  <p style={{ margin: 0, fontWeight: 800, color: '#92400e' }}>
                    ⚠️ Pago pendiente
                  </p>
                  <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.875rem', color: '#78350f' }}>
                    Este pedido no pasará a cocina hasta que se confirme el pago con Stripe.
                  </p>
                  <Link
                    to={`/pago?codigo=${encodeURIComponent(pedido.codigoSeguimiento)}&pedidoId=${pedido.id}&total=${pedido.total}`}
                    style={{ display: 'inline-block', background: '#0f766e', color: '#ffffff', textDecoration: 'none', fontWeight: 700, padding: '0.6rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    Pagar con Stripe ahora
                  </Link>
                </div>
              )}

              <div className="tracking-summary">
                <div><span>Total</span><strong>${Number(pedido.total).toLocaleString('es-CO')}</strong></div>
                <div><span>Recogida</span><strong>{formatearFecha(pedido.horaRecogida)}</strong></div>
              </div>

              <div className="tracking-order-items">
                <h3>Productos del pedido</h3>
                {!pedido.productos?.length ? <p>No hay detalles de productos disponibles para este pedido.</p> : (
                  <ul>{pedido.productos.map((producto) => (
                    <li key={producto.detalle_pedido_id}>
                      <div><strong>{producto.cantidad} × {producto.nombre_producto}</strong>
                        {producto.adiciones && <p>Extras: {producto.adiciones}</p>}
                        {producto.observaciones && <p>Personalización: {producto.observaciones}</p>}
                      </div>
                      <span>${Number(producto.subtotal ?? Number(producto.precio_unitario) * producto.cantidad).toLocaleString('es-CO')}</span>
                    </li>
                  ))}</ul>
                )}
              </div>

              {estadoActual === 'CANCELADO' ? (
                <p className="tracking-cancelled">Este pedido fue cancelado. Puedes crear uno nuevo desde el menú.</p>
              ) : (
                <div className="tracking-timeline">
                  {estados.map((estado, indice) => (
                    <div className={indice <= indiceActual ? 'tracking-step active' : 'tracking-step'} key={estado}>
                      <span className="tracking-step__dot" />
                      <span>{etiquetasEstado[estado]}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="tracking-code">Código: <strong>{pedido.codigoSeguimiento}</strong></p>
            </>
          )}
        </div>
      </div>

      <Link className="tracking-back" to="/">Volver a restaurantes</Link>
    </section>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '../auth'
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
}

const estados = ['PENDIENTE', 'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']
const etiquetasEstado: Record<string, string> = {
  PENDIENTE: 'Recibido',
  EN_PAGO: 'Pago pendiente',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo para recoger',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

function normalizarEstado(estado: string) {
  return estado === 'EN_PAGO' ? 'PENDIENTE' : estado
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
  const [codigoSeguimiento, setCodigoSeguimiento] = useState(codigo ?? '')
  const [pedidoId, setPedidoId] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [pedido, setPedido] = useState<PedidoConsultado | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const consultar = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setPedido(null)

    const codigoLimpio = codigoSeguimiento.trim()
    const tieneDatosAlternos = pedidoId.trim() && (correo.trim() || telefono.trim())

    if (!codigoLimpio && !tieneDatosAlternos) {
      setError('Ingresa el código de seguimiento o el número de pedido con correo o teléfono.')
      return
    }

    setCargando(true)
    try {
      let codigoParaConsultar = codigoLimpio

      if (!codigoParaConsultar) {
        const guardado = localStorage.getItem('upbfood.lastOrder')
        const pedidoGuardado = guardado ? JSON.parse(guardado) as {
          id?: number
          codigoSeguimiento?: string
          clienteCorreo?: string
          clienteTelefono?: string
        } : null
        const correoCoincide = correo.trim() && pedidoGuardado?.clienteCorreo?.toLowerCase() === correo.trim().toLowerCase()
        const telefonoCoincide = telefono.trim() && pedidoGuardado?.clienteTelefono === telefono.trim()

        if (!pedidoGuardado?.codigoSeguimiento || Number(pedidoId) !== Number(pedidoGuardado.id) || (!correoCoincide && !telefonoCoincide)) {
          throw new Error('Para buscar sin código, usa el número de pedido y los datos usados al comprar en este dispositivo.')
        }

        codigoParaConsultar = pedidoGuardado.codigoSeguimiento
      }

      const response = await apiFetch(
        `${getApiBaseUrl()}/api/pedidos/seguimiento/${encodeURIComponent(codigoParaConsultar)}`
      )
      const data = await response.json().catch(() => null) as { message?: string } & Partial<PedidoConsultado> | null

      if (!response.ok) {
        throw new Error(data?.message ?? 'No encontramos un pedido con esos datos.')
      }

      setPedido(data as PedidoConsultado)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar el pedido.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (codigo) void consultar()
  }, [codigo])

  const estadoActual = pedido ? normalizarEstado(pedido.estado) : ''
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

          <label>
            Código de seguimiento
            <input
              value={codigoSeguimiento}
              onChange={(event) => setCodigoSeguimiento(event.target.value)}
              placeholder="Ej. 5eee1287-4692-4a8e..."
            />
          </label>

          <div className="tracking-divider"><span>o busca con tus datos</span></div>

          <label>
            Número de pedido
            <input
              inputMode="numeric"
              value={pedidoId}
              onChange={(event) => setPedidoId(event.target.value)}
              placeholder="Ej. 1042"
            />
          </label>

          <label>
            Correo
            <input
              type="email"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </label>

          <label>
            Teléfono
            <input
              type="tel"
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              placeholder="3001234567"
            />
          </label>

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

              <div className="tracking-summary">
                <div><span>Total</span><strong>${Number(pedido.total).toLocaleString('es-CO')}</strong></div>
                <div><span>Recogida</span><strong>{formatearFecha(pedido.horaRecogida)}</strong></div>
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

type DetallePedido = {
  id: number
  cantidad: number
  producto: { nombre: string }
}

export type Pedido = {
  id: number
  client: { nombre: string }
  estado: string
  total: number
  fechaCreacion?: string
  horaRecogida?: string | null
  observaciones?: string | null
  details: DetallePedido[]
}

type CardPedidoProps = {
  pedido: Pedido
  tipo: 'nuevo' | 'preparacion'
  onAceptar?: (id: number) => void
  onEntregar?: (id: number) => void
}

function formatearHora(valor?: string | null) {
  if (!valor) return 'Sin hora definida'

  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) {
    return valor
  }

  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CardPedido({ pedido, tipo, onAceptar, onEntregar }: CardPedidoProps) {
  const horaRecogida = formatearHora(pedido.horaRecogida ?? pedido.fechaCreacion)

  return (
    <article className={`pedido-card ${tipo === 'preparacion' ? 'en-preparacion' : ''}`}>
      <div className="pedido-card__header">
        <div>
          <span className="pedido-card__eyebrow">Pedido #{pedido.id}</span>
          <h3>{pedido.client?.nombre ?? 'Cliente sin nombre'}</h3>
        </div>
        <span className="pedido-card__badge">{pedido.estado}</span>
      </div>

      <div className="pedido-card__meta">
        <p>
          <strong>Hora de recogida:</strong> {horaRecogida}
        </p>
      </div>

      <div className="pedido-card__productos">
        <strong>Productos</strong>
        <ul>
          {pedido.details?.map((detalle) => (
            <li key={detalle.id}>
              {detalle.cantidad}x {detalle.producto?.nombre ?? 'Producto'}
            </li>
          )) ?? <li>Sin productos registrados</li>}
        </ul>
      </div>

      {pedido.observaciones && (
        <div className="pedido-card__observaciones">
          <strong>Observaciones</strong>
          <p>{pedido.observaciones}</p>
        </div>
      )}

      <div className="pedido-card__acciones">
        {tipo === 'nuevo' && onAceptar ? (
          <button type="button" onClick={() => onAceptar(pedido.id)}>
            Aceptar pedido
          </button>
        ) : null}

        {tipo === 'preparacion' && onEntregar ? (
          <button type="button" className="pedido-card__secondary" onClick={() => onEntregar(pedido.id)}>
            Marcar como entregado
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default CardPedido

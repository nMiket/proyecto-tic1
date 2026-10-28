type DetallePedido = {
  id?: number
  detalle_pedido_id?: number
  cantidad: number
  nombre_producto?: string
  precio_unitario?: number | string
  adiciones?: string | null
  observaciones?: string | null
  subtotal?: number | string
  producto?: { nombre: string }
}

export type Pedido = {
  id: number
  client?: { nombre: string }
  correoCliente?: string | null
  telefonoCliente?: string | null
  estado: string
  total: number | string
  fechaCreacion?: string
  horaRecogida?: string | null
  details: DetallePedido[]
}

type CardPedidoProps = {
  pedido: Pedido
  tipo: 'nuevo' | 'preparacion' | 'listo'
  actualizando?: boolean
  onAceptar?: (id: number) => void
  onListo?: (id: number) => void
  onEntregar?: (id: number) => void
  onCancelar?: (id: number) => void
}

function formatearHora(valor?: string | null) {
  if (!valor) return 'Sin hora definida'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function nombreDetalle(detalle: DetallePedido) {
  return detalle.nombre_producto ?? detalle.producto?.nombre ?? 'Producto'
}

export function CardPedido({ pedido, tipo, actualizando = false, onAceptar, onListo, onEntregar, onCancelar }: CardPedidoProps) {
  const horaRecogida = formatearHora(pedido.horaRecogida ?? pedido.fechaCreacion)
  // HU015: el backend solo permite PAGADO -> EN_PREPARACION; la tarjeta refleja esa regla.
  const pagado = pedido.estado === 'PAGADO'
  return (
    <article className={`pedido-card ${tipo === 'preparacion' ? 'en-preparacion' : ''}`}>
      <div className="pedido-card__header">
        <div><span className="pedido-card__eyebrow">Pedido #{pedido.id}</span><h3>{pedido.client?.nombre ?? 'Cliente sin nombre'}</h3></div>
        <span className="pedido-card__badge">
          {pedido.estado === 'PENDIENTE' ? 'PENDIENTE DE PAGO' : pedido.estado.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="pedido-card__meta">
        <p><strong>Hora de recogida:</strong> {horaRecogida}</p>
        <p><strong>Total:</strong> ${Number(pedido.total).toLocaleString('es-CO')}</p>
        {(pedido.telefonoCliente || pedido.correoCliente) && (
          <p><strong>Contacto:</strong> {[pedido.telefonoCliente, pedido.correoCliente].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <div className="pedido-card__productos"><strong>Productos</strong><ul>
        {pedido.details?.length ? pedido.details.map((detalle) => (
          <li key={detalle.detalle_pedido_id ?? detalle.id ?? `${nombreDetalle(detalle)}-${detalle.cantidad}`}>
            {detalle.cantidad} × {nombreDetalle(detalle)}
            {detalle.subtotal !== undefined && detalle.subtotal !== null && (
              <span> · ${Number(detalle.subtotal).toLocaleString('es-CO')}</span>
            )}
            {detalle.adiciones && <span> — Extras: {detalle.adiciones}</span>}
            {detalle.observaciones && <span> — Nota: {detalle.observaciones}</span>}
          </li>
        )) : <li>Sin productos registrados</li>}
      </ul></div>
      <div className="pedido-card__acciones">
        {tipo === 'nuevo' && onAceptar && (
          pagado ? (
            <button type="button" disabled={actualizando} onClick={() => onAceptar(pedido.id)}>{actualizando ? 'Guardando…' : 'Aceptar pedido e iniciar preparación'}</button>
          ) : (
            <button type="button" disabled title="La cocina solo puede iniciar pedidos con pago confirmado.">Esperando confirmación de pago</button>
          )
        )}
        {tipo === 'nuevo' && onCancelar && <button type="button" className="pedido-card__secondary pedido-card__cancel" disabled={actualizando} onClick={() => onCancelar(pedido.id)}>Cancelar pedido</button>}
        {tipo === 'preparacion' && onListo && <button type="button" className="pedido-card__secondary" disabled={actualizando} onClick={() => onListo(pedido.id)}>{actualizando ? 'Guardando…' : 'Marcar como listo'}</button>}
        {tipo === 'listo' && onEntregar && <button type="button" className="pedido-card__secondary" disabled={actualizando} onClick={() => onEntregar(pedido.id)}>{actualizando ? 'Guardando…' : 'Marcar como entregado'}</button>}
      </div>
    </article>
  )
}

export default CardPedido

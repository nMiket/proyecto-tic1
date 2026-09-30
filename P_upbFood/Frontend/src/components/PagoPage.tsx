import { Link, useLocation } from 'react-router-dom'

type PagoState = {
  pedidoId?: number
  total?: number
}

export default function PagoPage() {
  const location = useLocation()
  const state = (location.state as PagoState | null) ?? null

  return (
    <section className="cliente-container">
      <div className="cliente-card">
        <div className="cliente-header">
          <p className="eyebrow">Pago seguro</p>
          <h2>Portal de pago</h2>
          <p>
            Tu pedido está listo para completar el pago.
          </p>
        </div>
        {state?.pedidoId ? (
          <div aria-live="polite">
            <p>Pedido #{state.pedidoId}</p>
            <p><strong>Total: ${Number(state.total ?? 0).toLocaleString('es-CO')}</strong></p>
            <button type="button" disabled>Continuar con el pago</button>
            <p className="mensaje-exito">El portal de pago estará disponible próximamente.</p>
          </div>
        ) : (
          <>
            <p>No hay un pedido pendiente de pago.</p>
            <Link to="/pedido">Volver al pedido</Link>
          </>
        )}
      </div>
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import './DashboardCocina.css'
import { CardPedido, type Pedido } from './CardPedido'
import { apiFetch, getApiBaseUrl } from '../auth'

type DashboardCocinaProps = {
  restauranteId: number
}

export function DashboardCocina({
  restauranteId,
}: DashboardCocinaProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [error, setError] = useState('')

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await apiFetch(
        `${getApiBaseUrl()}/api/admin/pedidos?restauranteId=${restauranteId}`
      )

      if (res.ok) {
        const data: Pedido[] = await res.json()
        setPedidos(data)
        setError('')
      } else if (res.status === 403) {
        setError('No tienes permisos de cocina para este restaurante.')
      } else {
        setError('No se pudieron cargar los pedidos de cocina.')
      }
    } catch (err) {
      console.error('Error al consultar pedidos:', err)
      setError('No se pudo conectar con el servidor.')
    }
  }, [restauranteId])

  useEffect(() => {
    void fetchPedidos()

    const interval = setInterval(() => {
      void fetchPedidos()
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchPedidos])

  const handleMoverEstado = async (
    id: number,
    nuevoEstado: string
  ) => {
    try {
      const res = await apiFetch(
        `${getApiBaseUrl()}/api/admin/pedidos/${id}/estado`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado }),
        }
      )

      if (res.ok) {
        await fetchPedidos()
      } else if (res.status === 403) {
        setError('No tienes permisos para modificar este pedido.')
      } else {
        setError(
          'El pedido cambió en otra sesión. Se actualizará la lista.'
        )
        await fetchPedidos()
      }
    } catch (err) {
      console.error('Error al cambiar el estado del pedido:', err)
      setError('No se pudo actualizar el pedido.')
    }
  }

  const pagados = pedidos.filter((p) => p.estado === 'PAGADO')
  const enPreparacion = pedidos.filter(
    (p) => p.estado === 'EN_PREPARACION'
  )
  const listos = pedidos.filter((p) => p.estado === 'LISTO')

  return (
    <div className="cocina-dashboard">
      <header className="cocina-dashboard__header">
        <div>
          <p className="eyebrow">Cocina</p>
          <h1>Dashboard de Cocina</h1>
          <p>Restaurante #{restauranteId}</p>
        </div>
      </header>

      {error && <p className="empty-column">{error}</p>}

      <div className="kanban-board">
        <div className="kanban-column">
          <h2>Nuevos ({pagados.length})</h2>

          {pagados.length === 0 ? (
            <p className="empty-column">No hay pedidos nuevos.</p>
          ) : (
            pagados.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="nuevo"
                onAceptar={(id) =>
                  handleMoverEstado(id, 'EN_PREPARACION')
                }
              />
            ))
          )}
        </div>

        <div className="kanban-column">
          <h2>En Preparación ({enPreparacion.length})</h2>

          {enPreparacion.length === 0 ? (
            <p className="empty-column">
              No hay pedidos en preparación.
            </p>
          ) : (
            enPreparacion.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="preparacion"
                onListo={(id) => handleMoverEstado(id, 'LISTO')}
              />
            ))
          )}
        </div>

        <div className="kanban-column">
          <h2>Listos ({listos.length})</h2>

          {listos.length === 0 ? (
            <p className="empty-column">No hay pedidos listos.</p>
          ) : (
            listos.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="listo"
                onEntregar={(id) =>
                  handleMoverEstado(id, 'ENTREGADO')
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

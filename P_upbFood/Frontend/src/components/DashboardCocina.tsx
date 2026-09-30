import { useEffect, useState } from 'react'
import './DashboardCocina.css'
import { CardPedido, type Pedido } from './CardPedido'

export function DashboardCocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])

  const fetchPedidos = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/pedidos/cocina')
      if (res.ok) {
        const data = await res.json()
        setPedidos(data)
      }
    } catch (error) {
      console.error('Error fetching pedidos:', error)
    }
  }

  useEffect(() => {
    fetchPedidos()
    const interval = setInterval(fetchPedidos, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleMoverEstado = async (id: number, nuevoEstado: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })

      if (res.ok) {
        await fetchPedidos()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const nuevos = pedidos.filter((p) => p.estado === 'NUEVO')
  const enPreparacion = pedidos.filter((p) => p.estado === 'EN_PREPARACION')

  return (
    <div className="cocina-dashboard">
      <header className="cocina-dashboard__header">
        <div>
          <p className="eyebrow">Cocina</p>
          <h1>Dashboard de Cocina</h1>
        </div>
      </header>

      <div className="kanban-board">
        <div className="kanban-column">
          <h2>Nuevos ({nuevos.length})</h2>
          {nuevos.length === 0 ? (
            <p className="empty-column">No hay pedidos nuevos.</p>
          ) : (
            nuevos.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="nuevo"
                onAceptar={(id) => handleMoverEstado(id, 'EN_PREPARACION')}
              />
            ))
          )}
        </div>

        <div className="kanban-column">
          <h2>En Preparación ({enPreparacion.length})</h2>
          {enPreparacion.length === 0 ? (
            <p className="empty-column">No hay pedidos en preparación.</p>
          ) : (
            enPreparacion.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="preparacion"
                onEntregar={(id) => handleMoverEstado(id, 'ENTREGADO')}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

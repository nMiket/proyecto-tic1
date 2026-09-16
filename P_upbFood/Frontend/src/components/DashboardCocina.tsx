import { useEffect, useState } from 'react'
import './DashboardCocina.css'

interface DetallePedido {
  id: number
  producto: { nombre: string }
  cantidad: number
}

interface Pedido {
  id: number
  client: { nombre: string }
  estado: string
  total: number
  fechaCreacion: string
  details: DetallePedido[]
}

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
      await fetch(`http://localhost:8080/api/pedidos/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      fetchPedidos()
    } catch (err) {
      console.error(err)
    }
  }

  const nuevos = pedidos.filter((p) => p.estado === 'NUEVO')
  const enPreparacion = pedidos.filter((p) => p.estado === 'EN_PREPARACION')

  return (
    <div className="cocina-dashboard">
      <h1>Dashboard de Cocina (Tiempo Real)</h1>
      <div className="kanban-board">
        <div className="kanban-column">
          <h2>Nuevos ({nuevos.length})</h2>
          {nuevos.map((p) => (
            <div key={p.id} className="pedido-card">
              <h3>Pedido #{p.id}</h3>
              <p><strong>Cliente:</strong> {p.client.nombre}</p>
              <ul>
                {p.details.map((d) => (
                  <li key={d.id}>{d.cantidad}x {d.producto.nombre}</li>
                ))}
              </ul>
              <button onClick={() => handleMoverEstado(p.id, 'EN_PREPARACION')}>Mover a Preparación</button>
            </div>
          ))}
        </div>
        <div className="kanban-column">
          <h2>En Preparación ({enPreparacion.length})</h2>
          {enPreparacion.map((p) => (
            <div key={p.id} className="pedido-card en-preparacion">
              <h3>Pedido #{p.id}</h3>
              <p><strong>Cliente:</strong> {p.client.nombre}</p>
              <ul>
                {p.details.map((d) => (
                  <li key={d.id}>{d.cantidad}x {d.producto.nombre}</li>
                ))}
              </ul>
              <button onClick={() => handleMoverEstado(p.id, 'ENTREGADO')}>Marcar como Entregado</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

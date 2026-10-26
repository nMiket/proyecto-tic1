import { useCallback, useEffect, useState } from 'react'
import './DashboardCocina.css'
import { CardPedido, type Pedido } from './CardPedido'
import { apiFetch, getApiBaseUrl } from '../auth'

type ProductoCocina = { id: number; nombre: string; precio: number; disponible: boolean }

type DashboardCocinaProps = { restauranteId: number; onLogout: () => Promise<void> }

const mensajeError = async (res: Response) => {
  const data = await res.json().catch(() => null) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar el pedido. La lista se volverá a consultar.'
}

const mensajeErrorProducto = async (res: Response) => {
  const data = await res.json().catch(() => null) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar la disponibilidad del producto.'
}

export function DashboardCocina({ restauranteId, onLogout }: DashboardCocinaProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [error, setError] = useState('')
  const [actualizandoId, setActualizandoId] = useState<number | null>(null)
  const [productos, setProductos] = useState<ProductoCocina[]>([])
  const [errorProductos, setErrorProductos] = useState('')
  const [actualizandoProductoId, setActualizandoProductoId] = useState<number | null>(null)

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/admin/pedidos?restauranteId=${restauranteId}`)
      if (!res.ok) {
        setError(res.status === 403 ? 'No tienes permisos de cocina para este restaurante.' : 'No se pudieron cargar los pedidos de cocina.')
        return
      }
      setPedidos(await res.json() as Pedido[])
      setError('')
    } catch (err) {
      console.error('Error al consultar pedidos:', err)
      setError('No se pudo conectar con el servidor. Comprueba la conexión e inténtalo nuevamente.')
    }
  }, [restauranteId])

  useEffect(() => {
    void fetchPedidos()
    const interval = window.setInterval(() => { void fetchPedidos() }, 10000)
    return () => window.clearInterval(interval)
  }, [fetchPedidos])

  useEffect(() => {
    let activo = true
    const cargarProductos = async () => {
      try {
        const res = await apiFetch(`${getApiBaseUrl()}/api/productos/admin?restauranteId=${restauranteId}`)
        if (!activo) return
        if (!res.ok) {
          setErrorProductos(res.status === 403 ? 'No tienes permisos para ver los productos de este restaurante.' : 'No se pudieron cargar los productos.')
          return
        }
        const data = await res.json() as ProductoCocina[]
        if (!activo) return
        setProductos(data)
        setErrorProductos('')
      } catch (err) {
        console.error('Error al consultar productos:', err)
        if (activo) setErrorProductos('No se pudo conectar con el servidor. Comprueba la conexión e inténtalo nuevamente.')
      }
    }
    void cargarProductos()
    return () => { activo = false }
  }, [restauranteId])

  const cambiarDisponibilidad = async (id: number, disponible: boolean) => {
    setActualizandoProductoId(id)
    setErrorProductos('')
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/productos/${id}/disponibilidad?restauranteId=${restauranteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disponible }),
      })
      if (!res.ok) {
        setErrorProductos(await mensajeErrorProducto(res))
        return
      }
      const data = await res.json() as { disponible: boolean }
      setProductos((actuales) => actuales.map((p) => p.id === id ? { ...p, disponible: data.disponible } : p))
    } catch (err) {
      console.error('Error al cambiar disponibilidad:', err)
      setErrorProductos('No se pudo conectar con el servidor. La disponibilidad no se ha guardado.')
    } finally {
      setActualizandoProductoId(null)
    }
  }

  const cambiarEstado = async (id: number, nuevoEstado: string) => {
    setActualizandoId(id)
    setError('')
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/admin/pedidos/${id}/estado`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) setError(await mensajeError(res))
      await fetchPedidos()
    } catch (err) {
      console.error('Error al cambiar estado:', err)
      setError('No se pudo conectar con el servidor. El estado no se ha confirmado; vuelve a consultar el pedido.')
      await fetchPedidos()
    } finally {
      setActualizandoId(null)
    }
  }

  const nuevos = pedidos.filter((p) => p.estado === 'PAGADO')
  const enPreparacion = pedidos.filter((p) => p.estado === 'EN_PREPARACION')
  const listos = pedidos.filter((p) => p.estado === 'LISTO')

  return (
    <div className="cocina-dashboard">
      <header className="cocina-dashboard__header">
        <div><p className="eyebrow">Cocina</p><h1>Dashboard de Cocina</h1><p>Restaurante #{restauranteId}</p></div>
        <button type="button" className="cocina-dashboard__logout" onClick={() => void onLogout()}>Cerrar sesión</button>
      </header>
      {error && <p className="empty-column" role="alert">{error}</p>}
      <p className="cocina-productos__heading">Los pedidos se actualizan automáticamente cada 10 segundos. Las acciones disponibles dependen del estado actual.</p>
      <section className="cocina-productos">
        <div className="cocina-productos__heading">
          <h2>Disponibilidad de productos</h2>
          <p>Marca como agotado un producto para que no pueda agregarse a nuevos pedidos.</p>
        </div>
        {errorProductos && <p className="cocina-productos__error" role="alert">{errorProductos}</p>}
        <div className="cocina-productos__list">
          {productos.map((p) => (
            <div className="cocina-producto" key={p.id}>
              <div className="cocina-producto__info">
                <strong>{p.nombre}</strong>
                <span>{p.disponible ? 'Disponible' : 'Agotado'}</span>
              </div>
              <label className="cocina-producto__toggle">
                <input type="checkbox" checked={p.disponible} disabled={actualizandoProductoId === p.id} onChange={(e) => void cambiarDisponibilidad(p.id, e.target.checked)} aria-label={`Disponibilidad de ${p.nombre}`} />
                {p.disponible ? 'Disponible' : 'Agotado'}
              </label>
            </div>
          ))}
        </div>
      </section>
      <div className="kanban-board">
        <div className="kanban-column"><h2>Nuevos ({nuevos.length})</h2>
          {nuevos.length === 0 ? <p className="empty-column">No hay pedidos pagados pendientes de preparación.</p> : nuevos.map((p) => <CardPedido key={p.id} pedido={p} tipo="nuevo" actualizando={actualizandoId === p.id} onAceptar={(id) => void cambiarEstado(id, 'EN_PREPARACION')} onCancelar={(id) => { if (window.confirm(`¿Cancelar el pedido #${id}?`)) void cambiarEstado(id, 'CANCELADO') }} />)}
        </div>
        <div className="kanban-column"><h2>En preparación ({enPreparacion.length})</h2>
          {enPreparacion.length === 0 ? <p className="empty-column">No hay pedidos en preparación.</p> : enPreparacion.map((p) => <CardPedido key={p.id} pedido={p} tipo="preparacion" actualizando={actualizandoId === p.id} onListo={(id) => void cambiarEstado(id, 'LISTO')} />)}
        </div>
        <div className="kanban-column"><h2>Listos ({listos.length})</h2>
          {listos.length === 0 ? <p className="empty-column">No hay pedidos listos para recoger.</p> : listos.map((p) => <CardPedido key={p.id} pedido={p} tipo="listo" actualizando={actualizandoId === p.id} onEntregar={(id) => void cambiarEstado(id, 'ENTREGADO')} />)}
        </div>
      </div>
    </div>
  )
}

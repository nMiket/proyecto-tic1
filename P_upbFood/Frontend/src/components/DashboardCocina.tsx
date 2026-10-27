import { useCallback, useEffect, useMemo, useState } from 'react'
import './DashboardCocina.css'
import { CardPedido, type Pedido } from './CardPedido'
import { apiFetch, getApiBaseUrl } from '../auth'
import { getProductFallbackImage as getImagenPorCategoria } from '../utils/formatters'

type ProductoCocina = {
  id: number
  nombre: string
  precio: number
  disponible: boolean
  categoriaId?: number
  imagenUrl?: string | null
}

type RestauranteCocina = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
}

type DashboardCocinaProps = { restauranteId: number; onLogout: () => Promise<void> }

const mensajeError = async (res: Response) => {
  const data = (await res.json().catch(() => null)) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar el pedido. La lista se volverá a consultar.'
}

const mensajeErrorProducto = async (res: Response) => {
  const data = (await res.json().catch(() => null)) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar la disponibilidad del producto.'
}

export function DashboardCocina({ restauranteId, onLogout }: DashboardCocinaProps) {
  const [selectedRestauranteId, setSelectedRestauranteId] = useState(restauranteId)
  const [restaurantes, setRestaurantes] = useState<RestauranteCocina[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [error, setError] = useState('')
  const [actualizandoId, setActualizandoId] = useState<number | null>(null)

  const [productos, setProductos] = useState<ProductoCocina[]>([])
  const [errorProductos, setErrorProductos] = useState('')
  const [actualizandoProductoId, setActualizandoProductoId] = useState<number | null>(null)

  // Filtros y control de disponibilidad en cocina
  const [searchProducto, setSearchProducto] = useState('')
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState<string>('todos')
  const [panelProductosExpandido, setPanelProductosExpandido] = useState(true)

  useEffect(() => {
    setSelectedRestauranteId(restauranteId)
  }, [restauranteId])

  useEffect(() => {
    let activo = true
    void apiFetch(`${getApiBaseUrl()}/api/admin/restaurantes`)
      .then(async (res) => {
        if (!res.ok) return []
        return (await res.json()) as RestauranteCocina[]
      })
      .then((data) => {
        if (!activo) return
        setRestaurantes(data)
        if (data.length > 0 && !data.some((item) => Number(item.id) === Number(restauranteId))) {
          setSelectedRestauranteId(data[0].id)
        }
      })
      .catch(() => {
        if (activo) setRestaurantes([])
      })
    return () => {
      activo = false
    }
  }, [restauranteId])

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/admin/pedidos?restauranteId=${selectedRestauranteId}`)
      if (!res.ok) {
        setError(res.status === 403 ? 'No tienes permisos de cocina para este restaurante.' : 'No se pudieron cargar los pedidos de cocina.')
        return
      }
      setPedidos((await res.json()) as Pedido[])
      setError('')
    } catch (err) {
      console.error('Error al consultar pedidos:', err)
      setError('No se pudo conectar con el servidor. Comprueba la conexión e inténtalo nuevamente.')
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void fetchPedidos()
    const interval = window.setInterval(() => {
      void fetchPedidos()
    }, 10000)
    return () => window.clearInterval(interval)
  }, [fetchPedidos])

  useEffect(() => {
    let activo = true
    const cargarProductos = async () => {
      try {
        const res = await apiFetch(`${getApiBaseUrl()}/api/productos/admin?restauranteId=${selectedRestauranteId}`)
        if (!activo) return
        if (!res.ok) {
          setErrorProductos(
            res.status === 403
              ? 'No tienes permisos para ver los productos de este restaurante.'
              : 'No se pudieron cargar los productos.',
          )
          return
        }
        const data = (await res.json()) as ProductoCocina[]
        if (!activo) return
        setProductos(data)
        setErrorProductos('')
      } catch (err) {
        console.error('Error al consultar productos:', err)
        if (activo) setErrorProductos('No se pudo conectar con el servidor. Comprueba la conexión e inténtalo nuevamente.')
      }
    }
    void cargarProductos()
    return () => {
      activo = false
    }
  }, [selectedRestauranteId])

  const cambiarDisponibilidad = async (id: number, disponible: boolean) => {
    setActualizandoProductoId(id)
    setErrorProductos('')
    try {
      const res = await apiFetch(
        `${getApiBaseUrl()}/api/productos/${id}/disponibilidad?restauranteId=${selectedRestauranteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disponible }),
        },
      )
      if (!res.ok) setErrorProductos(await mensajeErrorProducto(res))
      setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, disponible } : p)))
    } catch (err) {
      console.error('Error al actualizar disponibilidad:', err)
      setErrorProductos('No se pudo actualizar el producto en este momento.')
    } finally {
      setActualizandoProductoId(null)
    }
  }

  const cambiarEstado = async (id: number, nuevoEstado: string) => {
    setActualizandoId(id)
    setError('')
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/admin/pedidos/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
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

  // Métricas rápidas de productos
  const disponiblesCount = productos.filter((p) => p.disponible).length
  const agotadosCount = productos.filter((p) => !p.disponible).length

  // Filtrado reactivo en cocina
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (filtroDisponibilidad === 'disponibles' && !p.disponible) return false
      if (filtroDisponibilidad === 'agotados' && p.disponible) return false
      if (
        ['1', '2', '3'].includes(filtroDisponibilidad) &&
        String(p.categoriaId) !== filtroDisponibilidad
      ) {
        return false
      }
      if (!searchProducto.trim()) return true
      const q = searchProducto.trim().toLowerCase()
      return p.nombre.toLowerCase().includes(q)
    })
  }, [productos, filtroDisponibilidad, searchProducto])

  const restauranteActual = restaurantes.find(
    (r) => Number(r.id) === Number(selectedRestauranteId),
  )

  const cambiarEstadoRestaurante = async (nuevoEstado: string) => {
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (res.ok) {
        setRestaurantes((prev) =>
          prev.map((r) =>
            Number(r.id) === Number(selectedRestauranteId) ? { ...r, estado: nuevoEstado } : r,
          ),
        )
      }
    } catch (err) {
      console.error('Error al cambiar estado de la cafetería:', err)
    }
  }

  return (
    <div className="dashboard-cocina">
      {/* BARRA SUPERIOR ESTILO BRANDING INSTITUCIONAL */}
      <header className="cocina-topbar">
        <div className="cocina-topbar__brand">
          <span className="cocina-topbar__icon">🍽️</span>
          <div>
            <h1>Dashboard de Cocina</h1>
            <p>
              {restauranteActual?.nombre ?? 'Cafetería UPB'} · Ubicación:{' '}
              {restauranteActual?.ubicacion ?? 'Campus'}
            </p>
          </div>
        </div>

        <div className="cocina-topbar__actions">
          {restaurantes.length > 1 && (
            <div className="cocina-selector-group">
              <label htmlFor="select-cafeteria">Cafetería:</label>
              <select
                id="select-cafeteria"
                value={selectedRestauranteId}
                onChange={(e) => setSelectedRestauranteId(Number(e.target.value))}
              >
                {restaurantes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CONTROL OPERATIVO RÁPIDO: ESTADO EN VIVO */}
          <div className="cocina-state-control">
            <button
              type="button"
              className={`cocina-state-pill ${restauranteActual?.estado === 'Abierto' ? 'active-abierto' : ''}`}
              onClick={() => void cambiarEstadoRestaurante('Abierto')}
            >
              Abierto
            </button>
            <button
              type="button"
              className={`cocina-state-pill ${restauranteActual?.estado === 'Alta demanda' ? 'active-demanda' : ''}`}
              onClick={() => void cambiarEstadoRestaurante('Alta demanda')}
            >
              Alta demanda
            </button>
            <button
              type="button"
              className={`cocina-state-pill ${restauranteActual?.estado === 'Cerrado' ? 'active-cerrado' : ''}`}
              onClick={() => void cambiarEstadoRestaurante('Cerrado')}
            >
              Cerrado
            </button>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      {/* SECCIÓN DESPLEGABLE DE CONTROL DE PRODUCTOS Y EXISTENCIAS */}
      <section className="cocina-panel-productos">
        <div
          className="cocina-panel-productos__header"
          onClick={() => setPanelProductosExpandido((prev) => !prev)}
        >
          <div className="cocina-panel-title">
            <span className="cocina-panel-icon">📦</span>
            <div>
              <h3>Control Rápido de Disponibilidad</h3>
              <p>
                {disponiblesCount} disponibles · {agotadosCount} agotados
              </p>
            </div>
          </div>
          <button type="button" className="cocina-panel-toggle-btn">
            {panelProductosExpandido ? 'Ocultar catálogo ▲' : 'Ver productos agotados/disponibles ▼'}
          </button>
        </div>

        {panelProductosExpandido && (
          <>
            {errorProductos && <p className="error-message">{errorProductos}</p>}

            {/* Barra de filtros de platos */}
            <div className="cocina-productos-toolbar">
              <input
                type="search"
                placeholder="Buscar plato o bebida..."
                value={searchProducto}
                onChange={(e) => setSearchProducto(e.target.value)}
                className="cocina-search-input"
              />

              <div className="cocina-filter-chips">
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === 'todos' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('todos')}
                >
                  Todos ({productos.length})
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === 'disponibles' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('disponibles')}
                >
                  Disponibles ({disponiblesCount})
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === 'agotados' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('agotados')}
                >
                  Agotados ({agotadosCount})
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === '1' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('1')}
                >
                  Almuerzos
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === '2' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('2')}
                >
                  Bebidas
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === '3' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('3')}
                >
                  Snacks
                </button>
              </div>
            </div>

            {productosFiltrados.length === 0 ? (
              <div className="cocina-productos-empty">
                <strong>No se encontraron productos</strong>
                <p>No hay platos que coincidan con la búsqueda o el filtro seleccionado.</p>
              </div>
            ) : (
              <div className="cocina-productos__grid">
                {productosFiltrados.map((p) => {
                  const isUpdating = actualizandoProductoId === p.id
                  const imgSrc =
                    p.imagenUrl?.trim() || getImagenPorCategoria(p.categoriaId, p.nombre)

                  return (
                    <div
                      key={p.id}
                      className={`cocina-producto-card ${!p.disponible ? 'is-out' : ''}`}
                    >
                      <img
                        src={imgSrc}
                        alt={p.nombre}
                        className="cocina-producto-thumb"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src = getImagenPorCategoria(
                            p.categoriaId,
                            p.nombre,
                          )
                        }}
                      />

                      <div className="cocina-producto-details">
                        <strong title={p.nombre}>{p.nombre}</strong>
                        <span>${Number(p.precio).toLocaleString('es-CO')}</span>
                        <span
                          className={`cocina-producto-badge ${p.disponible ? 'available' : 'out-of-stock'}`}
                        >
                          {p.disponible ? 'Disponible' : 'Agotado'}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isUpdating}
                        className={`cocina-toggle-btn ${p.disponible ? 'mark-out' : 'mark-available'}`}
                        onClick={() => void cambiarDisponibilidad(p.id, !p.disponible)}
                      >
                        {isUpdating
                          ? 'Actualizando...'
                          : p.disponible
                            ? 'Agotar'
                            : 'Habilitar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* TABLERO KANBAN DE PEDIDOS */}
      <div className="kanban-board" aria-live="polite">
        <div className="kanban-column">
          <h2>Nuevos ({nuevos.length})</h2>
          {nuevos.length === 0 ? (
            <p className="empty-column">No hay pedidos pagados pendientes de preparación.</p>
          ) : (
            nuevos.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="nuevo"
                actualizando={actualizandoId === p.id}
                onAceptar={(id) => void cambiarEstado(id, 'EN_PREPARACION')}
                onCancelar={(id) => {
                  if (window.confirm(`¿Cancelar el pedido #${id}?`)) {
                    void cambiarEstado(id, 'CANCELADO')
                  }
                }}
              />
            ))
          )}
        </div>

        <div className="kanban-column">
          <h2>En preparación ({enPreparacion.length})</h2>
          {enPreparacion.length === 0 ? (
            <p className="empty-column">No hay pedidos en preparación.</p>
          ) : (
            enPreparacion.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="preparacion"
                actualizando={actualizandoId === p.id}
                onListo={(id) => void cambiarEstado(id, 'LISTO')}
              />
            ))
          )}
        </div>

        <div className="kanban-column">
          <h2>Listos ({listos.length})</h2>
          {listos.length === 0 ? (
            <p className="empty-column">No hay pedidos listos para recoger.</p>
          ) : (
            listos.map((p) => (
              <CardPedido
                key={p.id}
                pedido={p}
                tipo="listo"
                actualizando={actualizandoId === p.id}
                onEntregar={(id) => void cambiarEstado(id, 'ENTREGADO')}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

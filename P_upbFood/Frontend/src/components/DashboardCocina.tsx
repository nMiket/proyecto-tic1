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

type DashboardCocinaProps = {
  restauranteId: number
  onLogout: () => Promise<void>
  // HU029: solo el dueño puede abrir, cerrar o marcar alta demanda.
  restaurantesDueno?: number[]
}

const mensajeError = async (res: Response) => {
  const data = (await res.json().catch(() => null)) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar el pedido. La lista se volverá a consultar.'
}

const mensajeErrorProducto = async (res: Response) => {
  const data = (await res.json().catch(() => null)) as { message?: string; detail?: string } | null
  return data?.message ?? data?.detail ?? 'No se pudo actualizar la disponibilidad del producto.'
}

export function DashboardCocina({ restauranteId, onLogout, restaurantesDueno = [] }: DashboardCocinaProps) {
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
      if (!res.ok) {
        setErrorProductos(await mensajeErrorProducto(res))
        return
      }
      const data = (await res.json()) as { disponible: boolean }
      setProductos((actuales) =>
        actuales.map((p) => (p.id === id ? { ...p, disponible: data.disponible } : p)),
      )
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

  const nuevos = pedidos.filter(
    (p) => p.estado === 'PAGADO' || p.estado === 'PENDIENTE' || p.estado === 'EN_PAGO',
  )
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
      const res = await apiFetch(
        `${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado }),
        },
      )
      if (res.ok) {
        const data = (await res.json()) as RestauranteCocina
        setRestaurantes((prev) =>
          prev.map((r) => (r.id === selectedRestauranteId ? { ...r, ...data } : r)),
        )
      }
    } catch (err) {
      console.error('Error al actualizar estado del restaurante:', err)
    }
  }

  return (
    <div className="cocina-dashboard">
      <header className="cocina-dashboard__header">
        <div>
          <p className="eyebrow">Cocina</p>
          <h1>Dashboard de Cocina</h1>
          {restaurantes.length > 1 ? (
            <label className="cocina-restaurante-switcher">
              Cafetería activa
              <select
                value={selectedRestauranteId}
                onChange={(event) => setSelectedRestauranteId(Number(event.target.value))}
              >
                {restaurantes.map((restaurante) => (
                  <option key={restaurante.id} value={restaurante.id}>
                    {restaurante.nombre} ({restaurante.ubicacion})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              {restaurantes[0]
                ? `${restaurantes[0].nombre} (${restaurantes[0].ubicacion})`
                : `Restaurante #${selectedRestauranteId}`}
            </p>
          )}

          {restauranteActual && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginTop: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: '999px',
                  background:
                    restauranteActual.estado === 'Abierto'
                      ? '#ecfdf5'
                      : restauranteActual.estado === 'Alta demanda'
                        ? '#fefce8'
                        : '#fef2f2',
                  color:
                    restauranteActual.estado === 'Abierto'
                      ? '#065f46'
                      : restauranteActual.estado === 'Alta demanda'
                        ? '#854d0e'
                        : '#991b1b',
                  border: `1px solid ${
                    restauranteActual.estado === 'Abierto'
                      ? '#a7f3d0'
                      : restauranteActual.estado === 'Alta demanda'
                        ? '#fde047'
                        : '#fecaca'
                  }`,
                }}
              >
                {restauranteActual.estado ?? 'Abierto'}
              </span>

              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                Tiempo estimado: {restauranteActual.tiempoEstimadoMin ?? 15} min
              </span>

              {restaurantesDueno.includes(Number(selectedRestauranteId)) && (
              <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                {restauranteActual.estado !== 'Abierto' && (
                  <button
                    type="button"
                    onClick={() => void cambiarEstadoRestaurante('Abierto')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.4rem',
                      border: '1px solid #a7f3d0',
                      background: '#ecfdf5',
                      color: '#065f46',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Abrir
                  </button>
                )}
                {restauranteActual.estado !== 'Alta demanda' && (
                  <button
                    type="button"
                    onClick={() => void cambiarEstadoRestaurante('Alta demanda')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.4rem',
                      border: '1px solid #fde047',
                      background: '#fefce8',
                      color: '#854d0e',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Alta demanda
                  </button>
                )}
                {restauranteActual.estado !== 'Cerrado' && (
                  <button
                    type="button"
                    onClick={() => void cambiarEstadoRestaurante('Cerrado')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.4rem',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#991b1b',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Cerrar
                  </button>
                )}
              </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="cocina-dashboard__logout"
          onClick={() => void onLogout()}
        >
          Cerrar sesión
        </button>
      </header>

      {error && (
        <p className="empty-column" role="alert" style={{ marginBottom: '1.25rem' }}>
          {error}
        </p>
      )}

      {/* SECCIÓN MEJORADA DE DISPONIBILIDAD DE PRODUCTOS EN COCINA */}
      <section className="cocina-productos" aria-label="Control de existencias de cocina">
        <div className="cocina-productos__top-bar">
          <div className="cocina-productos__title-group">
            <h2>Disponibilidad de productos</h2>
            <p>
              Marca como agotado cualquier producto si se termina un ingrediente o plato para evitar que los clientes lo ordenen.
            </p>
          </div>

          <div className="cocina-productos__stats-bar">
            <span className="cocina-stat-chip available">
              {disponiblesCount} disponibles
            </span>
            <span className="cocina-stat-chip out-of-stock">
              {agotadosCount} agotados
            </span>
            <button
              type="button"
              className="cocina-collapse-btn"
              onClick={() => setPanelProductosExpandido((prev) => !prev)}
            >
              {panelProductosExpandido
                ? 'Ocultar panel'
                : `Gestionar existencias (${productos.length})`}
            </button>
          </div>
        </div>

        {errorProductos && (
          <div className="cocina-productos__error" role="alert">
            {errorProductos}
          </div>
        )}

        {panelProductosExpandido && (
          <>
            <div className="cocina-productos__toolbar">
              <div className="cocina-search-input">
                <input
                  type="search"
                  placeholder="Buscar producto para agotar o habilitar..."
                  aria-label="Buscar producto para agotar o habilitar"
                  value={searchProducto}
                  onChange={(e) => setSearchProducto(e.target.value)}
                />
              </div>

              <div className="cocina-filters-strip">
                <button
                  type="button"
                  className={`cocina-filter-btn ${filtroDisponibilidad === 'todos' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('todos')}
                >
                  Todos ({productos.length})
                </button>
                <button
                  type="button"
                  className={`cocina-filter-btn is-warning ${filtroDisponibilidad === 'agotados' ? 'is-active' : ''}`}
                  onClick={() => setFiltroDisponibilidad('agotados')}
                >
                  Agotados ({agotadosCount})
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

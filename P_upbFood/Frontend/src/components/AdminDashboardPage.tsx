import { startTransition, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '../auth'

type ProductItem = {
  id: number
  nombre: string
  descripcion: string
  precio: number | string
  disponible: boolean
  categoriaId: number
  restauranteId: number
  ingredientesExtra: string[]
}

type RestauranteItem = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
}

function getImagenPorCategoria(categoriaId: number, nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('empanada')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400'
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400'
  if (n.includes('perro') || n.includes('hot dog')) return 'https://images.unsplash.com/photo-1599599811450-2c59409af2c0?w=400'
  if (n.includes('gatorade') || n.includes('energ') || n.includes('sport')) return 'https://images.unsplash.com/photo-1525397053281-a37d8a2ff7ce?w=400'
  if (n.includes('jugo') || n.includes('bebida') || n.includes('gaseosa') || n.includes('agua')) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400'
  if (n.includes('cafe') || n.includes('café') || n.includes('cappuccino') || n.includes('latte')) return 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?w=400'
  if (n.includes('asado') || n.includes('res') || n.includes('carne') || n.includes('parrilla') || n.includes('cerdo') || n.includes('chuleta') || n.includes('bbq') || n.includes('costilla')) return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400'
  if (n.includes('almuerzo') || n.includes('ejecutivo') || n.includes('pollo') || n.includes('pescado')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'
  if (n.includes('hamburguesa') || n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'
  if (n.includes('dedo') || n.includes('queso') || n.includes('pan') || n.includes('sandwich') || n.includes('sándwich')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
  if (n.includes('postre') || n.includes('torta') || n.includes('dulce') || n.includes('brownie')) return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400'
  if (n.includes('ensalada') || n.includes('saludable') || n.includes('vegetariano')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400'

  if (categoriaId === 1) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' // Almuerzos
  if (categoriaId === 2) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400' // Bebidas
  return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' // Snacks
}

export default function AdminDashboardPage({
  adminName,
  restauranteId: initialRestauranteId,
  onLogout,
}: {
  adminName: string
  restauranteId: number
  onLogout: () => void
}) {
  const [selectedRestauranteId, setSelectedRestauranteId] = useState<number>(initialRestauranteId)
  const [listaRestaurantes, setListaRestaurantes] = useState<RestauranteItem[]>([])
  const [productDescription, setProductDescription] = useState('')
  const [products, setProducts] = useState<ProductItem[]>([])
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [categoriaId, setCategoriaId] = useState('1')
  const [disponible, setDisponible] = useState(true)
  const [productError, setProductError] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [ingredientesExtra, setIngredientesExtra] = useState<string[]>([])
  const [nuevoIngredienteExtra, setNuevoIngredienteExtra] = useState('')

  const resetProductForm = () => {
    setProductName('')
    setProductDescription('')
    setProductPrice('')
    setCategoriaId('1')
    setDisponible(true)
    setEditingProductId(null)
    setIngredientesExtra([])
  }

  useEffect(() => {
    apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RestauranteItem[]) => {
        setListaRestaurantes(data)
      })
      .catch(() => {})
  }, [])

  const agregarIngredienteExtra = () => {
  const nuevoExtra = nuevoIngredienteExtra.trim()

  if (!nuevoExtra) return

  setIngredientesExtra((extras) => [...extras, nuevoExtra])
  setNuevoIngredienteExtra('')
}

  const fetchProducts = useCallback(async () => {
    startTransition(() => setLoadingProducts(true))
    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products?restauranteId=${selectedRestauranteId}`)
      if (!response.ok) {
        throw new Error('No se pudo cargar el menú.')
      }

      const data = (await response.json()) as ProductItem[]
      setProducts(data)
    } catch {
      setProductError('No se pudo cargar el catálogo de productos.')
    } finally {
      setLoadingProducts(false)
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void Promise.resolve().then(() => fetchProducts())
  }, [fetchProducts])

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError('')

    if (!productName.trim() || !productPrice) {
      setProductError('Completa el nombre y el precio del producto.')
      return
    }

    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: productName.trim(),
          descripcion: productDescription.trim(),
          precio: productPrice,
          categoriaId: Number(categoriaId),
          restauranteId: selectedRestauranteId,
          disponible,
        }),
      })

      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? 'No se pudo guardar el producto.')
      }

      resetProductForm()
      await fetchProducts()
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
    }
  }

  const handleEditProduct = (product: ProductItem) => {
    setEditingProductId(product.id)
    setProductName(product.nombre)
    setProductPrice(String(product.precio))
    setCategoriaId(String(product.categoriaId))
    setDisponible(Boolean(product.disponible))
    setProductDescription(product.descripcion)
    setIngredientesExtra(product.ingredientesExtra ?? [])
  }

  const handleUpdateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError('') 

    if (editingProductId === null) {
      return
    }

    if (!productName.trim() || !productPrice) {
      setProductError('Completa el nombre y el precio del producto.')
      return
    }

    const confirmar = window.confirm(
        '¿Estás seguro de que quieres guardar los cambios de este producto?'
    )

    if (!confirmar) return

    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        nombre: productName.trim(),
        descripcion: productDescription.trim(),
        precio: productPrice,
        categoriaId: Number(categoriaId),
        restauranteId: selectedRestauranteId,
        disponible,
        ingredientesExtra,
        }),
      })

      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? 'No se pudo actualizar el producto.')
      }

      resetProductForm()
      await fetchProducts()
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'No se pudo actualizar el producto.')
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    setProductError('')

    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products/${productId}`, {
        method: 'DELETE',
      })

      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? 'No se pudo eliminar el producto.')
      }

      await fetchProducts()
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.')
    }
  }

  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h2>Bienvenido, {adminName}</h2>
        </div>
        <button className="secondary" onClick={onLogout}>
          Cerrar sesión
        </button>
        <Link className="secondary" to="/admin/cocina">
          Cocina
        </Link>
      </div>

      {/* Selector de Cafetería a Administrar */}
      <div style={{ margin: '0 0 24px', padding: '16px 20px', backgroundColor: '#f0f8f8', borderRadius: '12px', border: '1px solid #d3ebe7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 700, color: '#0f3d3e', fontSize: '1rem' }}>
            Cafetería en gestión:
          </span>
          <select
            value={selectedRestauranteId}
            onChange={(e) => setSelectedRestauranteId(Number(e.target.value))}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #0d7377', fontWeight: 600, color: '#0d7377', backgroundColor: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}
          >
            {listaRestaurantes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} ({r.ubicacion})
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: '0.85rem', color: '#557571' }}>
          Los cambios se aplican al menú de esta cafetería
        </span>
      </div>

      <div className="dashboard-grid">
        <article className="metric-card accent">
          <span>Pedidos activos</span>
          <strong>24</strong>
          <small>5 nuevos hoy</small>
        </article>
        <article className="metric-card">
          <span>Productos</span>
          <strong>{products.length}</strong>
          <small>catálogo del restaurante</small>
        </article>
        <article className="metric-card">
          <span>Ganancias</span>
          <strong>$3.4M</strong>
          <small>vs. $2.9M mes anterior</small>
        </article>
      </div>

      <div className="dashboard-panels">
        <div className="panel">
          <h3>Acciones rápidas</h3>
          <ul>
            <li>Ver pedidos pendientes</li>
            <li>Actualizar menú</li>
            <li>Configurar cafeterías</li>
            <li>Revisar métricas</li>
          </ul>
        </div>

        <div className="panel">
          <h3>Resumen del día</h3>
          <div className="summary-row">
            <span>Entrega en curso</span>
            <strong>18</strong>
          </div>
          <div className="summary-row">
            <span>Clientes activos</span>
            <strong>312</strong>
          </div>
          <div className="summary-row">
            <span>Calificación promedio</span>
            <strong>4.8</strong>
          </div>
        </div>
      </div>

      <div className="product-section">
        <div className="panel">
          <h3>Gestión de productos</h3>
          <form className="product-form" onSubmit={editingProductId !== null ? handleUpdateProduct : handleCreateProduct}>
            <label>
              Nombre
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ej: Café Americano" required />
            </label>

            <label>
              Descripción
                <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Ej: Café preparado con leche..." required />
            </label>

            <label>
              Precio    
              <input type="number" min="0" step="100" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="4500" required />
            </label>

            <label>
              Categoría
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="1">Almuerzos</option>
                <option value="2">Bebidas</option>
                <option value="3">Snacks</option>
              </select>
            </label>

            <div>
                <label>
                    Ingredientes extra
                    <input
                    value={nuevoIngredienteExtra}
                    onChange={(e) => setNuevoIngredienteExtra(e.target.value)}
                    placeholder="Ej: Queso"
                    />
                </label>

                <button
                    type="button"
                    onClick={agregarIngredienteExtra}
                >
                    Agregar extra
                </button>

                {ingredientesExtra.length > 0 && (
                    <ul>
                    {ingredientesExtra.map((extra, index) => (
                        <li key={`${extra}-${index}`}>
                        {extra}
                        <button
                            type="button"
                            onClick={() =>
                            setIngredientesExtra((extras) =>
                                extras.filter((_, i) => i !== index)
                            )
                            }
                        >
                            Eliminar
                        </button>
                        </li>
                    ))}
                    </ul>
                )}
                </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} />
              Disponible
            </label>

            {productError && <p className="error-message">{productError}</p>}

            <div className="product-form-actions">
              <button type="submit">{editingProductId !== null ? 'Actualizar producto' : 'Guardar producto'}</button>
              {editingProductId !== null && (
                <button type="button" className="secondary-button" onClick={resetProductForm}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <h3>Catálogo actual</h3>
          {loadingProducts ? (
            <p>Cargando productos...</p>
          ) : products.length === 0 ? (
            <p>No hay productos registrados para esta cafetería.</p>
          ) : (
            <ul className="product-list">
              {products.map((product) => (
                <li key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img 
                    src={getImagenPorCategoria(product.categoriaId, product.nombre)} 
                    alt="" 
                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                  />
                  <div style={{ flex: 1 }}>
                    <strong>{product.nombre}</strong>
                    <span>{product.disponible ? 'Disponible' : 'Sin stock'}</span>
                  </div>
                  <div className="product-actions">
                    <span>${Number(product.precio).toLocaleString('es-CO')}</span>
                    <div className="inline-actions">
                      <button type="button" className="mini-button" onClick={() => handleEditProduct(product)}>
                        Editar
                      </button>
                      <button type="button" className="mini-button danger" onClick={() => handleDeleteProduct(product.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
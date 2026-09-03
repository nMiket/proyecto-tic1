import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ListaRestaurantes from './components/ListaRestaurantes'
import { CardProducto } from './components/CardProducto'
import type { Producto } from './types/Producto'
import './App.css'

type LoginResponse = {
  success: boolean
  message?: string
  email?: string
  restauranteId?: number
}

type ProductItem = {
  id: number
  nombre: string
  precio: number | string
  disponible: boolean
  categoriaId: number
  restauranteId: number
}

const STORAGE_KEY = 'upbfood-admin-auth'

const PRODUCTOS_CATALOGO: Producto[] = [
  {
    id: 1,
    nombre: 'Empanada de Carne',
    descripcion: 'Deliciosa empanada crujiente llena de carne desmechada y papa.',
    precio: 3500,
    imagenUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400',
    disponible: true,
  },
  {
    id: 2,
    nombre: 'Jugo Natural en Agua',
    descripcion: 'Jugo natural de mora, maracuyá o lulo (400ml).',
    precio: 5000,
    imagenUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400',
    disponible: true,
  },
  {
    id: 3,
    nombre: 'Combo Almuerzo Ejecutivo',
    descripcion: 'Proteína, arroz, ensalada, principio del día y sobremesa.',
    precio: 14500,
    imagenUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    disponible: true,
  },
]

function getImagenPorCategoria(categoriaId: number, nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('empanada')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400'
  if (n.includes('jugo') || n.includes('bebida') || n.includes('gaseosa') || n.includes('agua')) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400'
  if (n.includes('cafe') || n.includes('café') || n.includes('cappuccino')) return 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?w=400'
  if (n.includes('almuerzo') || n.includes('ejecutivo') || n.includes('carne') || n.includes('pollo')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'
  if (n.includes('hamburguesa') || n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'
  if (n.includes('dedo') || n.includes('queso') || n.includes('pan') || n.includes('sandwich')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'

  if (categoriaId === 1) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' // Almuerzos
  if (categoriaId === 2) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400' // Bebidas
  return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400' // Snacks
}

function getDescripcionPorCategoria(categoriaId: number, _nombre: string): string {
  if (categoriaId === 1) return 'Plato del día preparado fresco con proteína, acompañamientos y sazón casera.'
  if (categoriaId === 2) return 'Bebida refrescante preparada al instante para acompañar tu menú.'
  return 'Snack recién horneado y delicioso, ideal para disfrutar entre clases.'
}

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [adminName, setAdminName] = useState('')
  const [restauranteId, setRestauranteId] = useState<number | null>(null)
  const location = useLocation()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { email?: string; restauranteId?: number }
        if (parsed.email) {
          setAdminName(parsed.email)
          setRestauranteId(parsed.restauranteId ?? 1)
          setIsLoggedIn(true)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const handleLogin = async (email: string, password: string) => {
    const response = await fetch('http://localhost:8080/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = (await response.json()) as LoginResponse

    if (!response.ok || !data.success) {
      throw new Error(data.message ?? 'Credenciales inválidas.')
    }

    const nextEmail = data.email ?? email
    const nextRestauranteId = data.restauranteId ?? 1
    setAdminName(nextEmail)
    setRestauranteId(nextRestauranteId)
    setIsLoggedIn(true)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: nextEmail, restauranteId: nextRestauranteId }))
    return nextEmail
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setAdminName('')
    setRestauranteId(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link to="/" className="brand">
          UPB Food
        </Link>
        <div className="nav-actions">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Vista pública
          </Link>
          <Link
            to={isLoggedIn ? '/admin/dashboard' : '/admin'}
            className={location.pathname.startsWith('/admin') ? 'active' : ''}
          >
            Panel administrativo
          </Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/admin"
          element={
            isLoggedIn ? <Navigate to="/admin/dashboard" replace /> : <AdminLoginPage onLogin={handleLogin} />
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            isLoggedIn ? (
              <AdminDashboardPage
                adminName={adminName}
                restauranteId={restauranteId ?? 1}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/admin" replace />
            )
          }
        />
      </Routes>
    </main>
  )
}

function HomePage() {
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_CATALOGO)
  const [cargando, setCargando] = useState<boolean>(true)

  useEffect(() => {
    fetch('http://localhost:8080/api/products?restauranteId=1')
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar productos')
        return res.json()
      })
      .then((data: ProductItem[]) => {
        if (data && data.length > 0) {
          const adaptados: Producto[] = data.map((item) => ({
            id: item.id,
            nombre: item.nombre,
            precio: Number(item.precio),
            disponible: item.disponible,
            descripcion: getDescripcionPorCategoria(item.categoriaId, item.nombre),
            imagenUrl: getImagenPorCategoria(item.categoriaId, item.nombre),
          }))
          setProductos(adaptados)
        }
      })
      .catch(() => {
        // En caso de que el backend no responda, conserva la lista estática
      })
      .finally(() => {
        setCargando(false)
      })
  }, [])

  return (
    <>
      <section className="hero-card">
        <p className="eyebrow">Comedor UPB</p>
        <h1>Haz tu pedido antes de llegar</h1>
        <p>
          Explora cafeterías, revisa el menú y prepara tu pedido desde cualquier dispositivo.
        </p>

        <div className="stats">
          <div>
            <strong>3 min</strong>
            <span>tiempo estimado de entrega</span>
          </div>

          <div>
            <strong>4</strong>
            <span>cafeterías disponibles</span>
          </div>
        </div>
      </section>

      <ListaRestaurantes />

      <section className="menu-destacado" style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f3d3e', margin: 0 }}>Menú UPB Food</h2>
          <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
            {cargando ? 'Cargando productos...' : `${productos.length} producto${productos.length !== 1 ? 's' : ''} en carta`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {productos.map((prod) => (
            <CardProducto
              key={prod.id}
              producto={prod}
              onAgregar={(p) => alert(`Agregado al carrito: ${p.nombre}`)}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function AdminLoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<string> }) {
  const [email, setEmail] = useState('admin@upb.edu.co')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await onLogin(email, password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="login-card">
      <div className="login-header">
        <p className="eyebrow">Administración</p>
        <h2>Iniciar sesión</h2>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Correo institucional
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@upb.edu.co"
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error && <p className="error-message">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Validando...' : 'Ingresar'}
        </button>
      </form>
    </section>
  )
}

function AdminDashboardPage({
  adminName,
  restauranteId,
  onLogout,
}: {
  adminName: string
  restauranteId: number
  onLogout: () => void
}) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [categoriaId, setCategoriaId] = useState('1')
  const [disponible, setDisponible] = useState(true)
  const [productError, setProductError] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)

  const resetProductForm = () => {
    setProductName('')
    setProductPrice('')
    setCategoriaId('1')
    setDisponible(true)
    setEditingProductId(null)
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch(`http://localhost:8080/api/products?restauranteId=${restauranteId}`)
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
  }

  useEffect(() => {
    void fetchProducts()
  }, [restauranteId])

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError('')

    if (!productName.trim() || !productPrice) {
      setProductError('Completa el nombre y el precio del producto.')
      return
    }

    try {
      const response = await fetch('http://localhost:8080/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: productName.trim(),
          precio: productPrice,
          categoriaId: Number(categoriaId),
          restauranteId,
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

    try {
      const response = await fetch(`http://localhost:8080/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: productName.trim(),
          precio: productPrice,
          categoriaId: Number(categoriaId),
          restauranteId,
          disponible,
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
      const response = await fetch(`http://localhost:8080/api/products/${productId}`, {
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
            <p>No hay productos registrados.</p>
          ) : (
            <ul className="product-list">
              {products.map((product) => (
                <li key={product.id}>
                  <div>
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

export default App

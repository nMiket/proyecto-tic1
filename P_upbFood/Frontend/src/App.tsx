
import { useEffect, useState, type FormEvent } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import ListaRestaurantes from './components/ListaRestaurantes'
import ListaProductos from './components/ListaProductos'
import ResumenPedido from './components/ResumenPedido'
import { CartProvider } from './context/CartContext'
import { useCart } from './context/useCart'
import {
  apiFetch,
  getApiBaseUrl,
  login as authenticate,
  logout as endSession,
  refreshSession,
  type AsignacionRestaurante,
} from './auth'
import FormularioCliente from './components/FormularioCliente'
import PagoPage from './components/PagoPage'
import { DashboardCocina } from './components/DashboardCocina'
import AdminDashboardPage from './components/AdminDashboardPage'
import './App.css'

type RestauranteItem = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
}

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [restauranteId, setRestauranteId] = useState<number | null>(null)
  const [asignaciones, setAsignaciones] = useState<AsignacionRestaurante[]>([])

  const tieneAccesoAdmin =
    isLoggedIn && asignaciones.some(
      (asignacion) => Number(asignacion.restauranteId) > 0
    )

  const restauranteCocinaId =
    asignaciones.find(
      (asignacion) => Number(asignacion.tipoAdministradorId) === 2
    )?.restauranteId ?? null

  useEffect(() => {
    let cancelled = false

    void refreshSession()
      .then((session) => {
        if (!cancelled && session) {
          setAdminName(session.email)
          setRestauranteId(session.restauranteId)
          setAsignaciones(session.asignaciones ?? [])
          setIsLoggedIn(true)
        }
      })
      .catch((error) => {
        console.error('Error al recuperar la sesión:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = async (email: string, password: string) => {
    const session = await authenticate(email, password)

    setAdminName(session.email)
    setRestauranteId(session.restauranteId)
    setAsignaciones(session.asignaciones ?? [])
    setIsLoggedIn(true)

    return session.email
  }

  const handleLogout = async () => {
    await endSession()
    setIsLoggedIn(false)
    setAdminName('')
    setRestauranteId(null)
    setAsignaciones([])
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link to="/" className="brand">
          UPB Food
        </Link>

        
      <div className="nav-actions">
        {!isLoggedIn ? (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Servicios
            </NavLink>

            <NavLink
              to="/pedido"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Pedido
            </NavLink>

            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Iniciar sesión
            </NavLink>
          </>
        ) : (
          <>
            {tieneAccesoAdmin && (
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Panel administrativo
              </NavLink>
            )}

            {tieneAccesoAdmin && restauranteCocinaId !== null && (
              <NavLink
                to="/admin/cocina"
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Cocina
              </NavLink>
            )}
          </>
        )}
      </div>

      </nav>

      <CartProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/admin"
            element={
              isLoggedIn ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <AdminLoginPage onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              tieneAccesoAdmin ? (
                <AdminDashboardPage
                  adminName={adminName}
                  restauranteId={restauranteId ?? asignaciones[0].restauranteId}
                  asignaciones={asignaciones}
                  onLogout={handleLogout}
                />
              ) : (
                <Navigate to="/admin" replace />
              )
            }
          />

          <Route
            path="/admin/cocina"
            element={
              tieneAccesoAdmin && restauranteCocinaId !== null ? (
                <DashboardCocina restauranteId={restauranteCocinaId} />
              ) : (
                <Navigate
                  to={tieneAccesoAdmin ? '/admin/dashboard' : '/admin'}
                  replace
                />
              )
            }
          />

          <Route path="/pedido" element={<PedidoPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/cliente" element={<FormularioCliente />} />
          <Route path="/pago" element={<PagoPage />} />
        </Routes>
      </CartProvider>
    </main>
  )
}

function HomePage() {
  const { agregarProducto, totalItems, total } = useCart()
  const navigate = useNavigate()

  const [restauranteSeleccionado, setRestauranteSeleccionado] = useState<{
    id: number
    nombre: string
  }>({
    id: 1,
    nombre: 'Cafetería Central - Bloque 11',
  })

  const [listaRestaurantes, setListaRestaurantes] = useState<RestauranteItem[]>([])

  useEffect(() => {
    apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RestauranteItem[]) => {
        if (data && data.length > 0) {
          setListaRestaurantes(data)

          setRestauranteSeleccionado((actual) => {
            const existe = data.some((r) => r.id === actual.id)

            if (existe) {
              const restaurante = data.find((r) => r.id === actual.id)!
              return { id: restaurante.id, nombre: restaurante.nombre }
            }

            return { id: data[0].id, nombre: data[0].nombre }
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <section className="hero-card">
        <p className="eyebrow">Comedor UPB</p>

        <h1>Haz tu pedido antes de llegar</h1>

        <p>
          Explora cafeterías, revisa el menú y prepara tu pedido desde cualquier
          dispositivo.
        </p>

        <div className="stats">
          <div>
            <strong>3 min</strong>
            <span>tiempo estimado de entrega</span>
          </div>

          <div>
            <strong>{listaRestaurantes.length || 2}</strong>
            <span>cafeterías disponibles</span>
          </div>
        </div>
      </section>

      <ListaRestaurantes
        restauranteSeleccionadoId={restauranteSeleccionado.id}
        onSelectRestaurante={(r) => {
          setRestauranteSeleccionado({
            id: r.id,
            nombre: r.nombre,
          })
        }}
      />

      <section className="menu-destacado" style={{ marginTop: '2.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.8rem',
                color: '#0d7377',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 700,
              }}
            >
              Menú de la cafetería
            </span>

            <h2
              style={{
                fontSize: '1.6rem',
                color: '#0f3d3e',
                margin: '4px 0 0',
              }}
            >
              {restauranteSeleccionado.nombre}
            </h2>
          </div>
        </div>

        {listaRestaurantes.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            {listaRestaurantes.map((r) => {
              const active = restauranteSeleccionado.id === r.id

              return (
                <button
                  key={r.id}
                  onClick={() =>
                    setRestauranteSeleccionado({
                      id: r.id,
                      nombre: r.nombre,
                    })
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '24px',
                    border: active
                      ? '2px solid #0d7377'
                      : '1px solid #c2ded9',
                    backgroundColor: active ? '#0d7377' : '#ffffff',
                    color: active ? '#ffffff' : '#0f3d3e',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: active
                      ? '0 2px 6px rgba(13, 115, 119, 0.2)'
                      : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {r.nombre}
                </button>
              )
            })}
          </div>
        )}

        <ListaProductos
          restauranteId={restauranteSeleccionado.id}
          onAgregar={(product) =>
            agregarProducto({
              ...product,
              id: Number(product.id),
              restauranteId: restauranteSeleccionado.id,
              imagenUrl: product.imagenUrl,
            })
          }
        />
      </section>

      <button
        className="floating-cart-button"
        type="button"
        onClick={() => navigate('/pedido')}
      >
        <span>Carrito ({totalItems})</span>
        <strong>${total.toLocaleString('es-CO')}</strong>
      </button>
    </>
  )
}

function AdminLoginPage({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<string>
}) {
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
      setError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.'
      )
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
            placeholder="Contraseña"
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

function PedidoPage() {
  return (
    <section className="hero-card order-page">
      <p className="eyebrow">Lista de pedidos</p>
      <h1>Mi pedido</h1>
      <p>Revisa los productos seleccionados antes de confirmar la compra.</p>
      <ResumenPedido />
    </section>
  )
}

function HistorialPage() {
  return (
    <section className="hero-card">
      <h1>Historial</h1>
      <p>Aquí aparecerán tus pedidos anteriores.</p>
    </section>
  )
}

export default App

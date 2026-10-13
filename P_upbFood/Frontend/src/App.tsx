
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
          <span className="brand-mark" aria-hidden="true">UPB</span>
          <span className="brand-copy">
            <strong>UPB Food</strong>
            <small>Comunidad universitaria</small>
          </span>
        </Link>

      <div className="nav-actions" aria-label="Navegación principal">
        {!isLoggedIn ? (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Explorar menú
            </NavLink>

            <NavLink
              to="/pedido"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Mi pedido
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
        <div className="hero-content">
          <p className="eyebrow">Alimentación en campus</p>
          <h1>Tu próxima pausa empieza aquí.</h1>
          <p className="hero-description">
            Consulta los menús de las cafeterías UPB, arma tu pedido y recógelo
            cuando estés listo.
          </p>
          <a className="hero-cta" href="#cafeterias">Ver cafeterías</a>
        </div>

        <div className="hero-aside" aria-label="Información del servicio">
          <div className="identity-placeholders" aria-label="Espacios reservados para logos">
            <span className="identity-logo-slot">Logo UPB</span>
            <span className="identity-logo-slot identity-logo-slot--food">Logo Food</span>
          </div>
          <span className="hero-aside__label">Hoy en el campus</span>
          <strong>Menos filas, más tiempo para ti.</strong>
          <div className="stats">
            <div>
              <strong>3 min</strong>
              <span>tiempo estimado</span>
            </div>
            <div>
              <strong>{listaRestaurantes.length || 2}</strong>
              <span>cafeterías disponibles</span>
            </div>
          </div>
        </div>
      </section>

      <div id="cafeterias">
        <ListaRestaurantes
          restauranteSeleccionadoId={restauranteSeleccionado.id}
          onSelectRestaurante={(r) => {
            setRestauranteSeleccionado({
              id: r.id,
              nombre: r.nombre,
            })
          }}
        />
      </div>

      <section className="menu-destacado">
        <div className="menu-heading">
          <div>
            <p className="section-kicker">Menú disponible</p>
            <h2>{restauranteSeleccionado.nombre}</h2>
          </div>
          <span className="menu-hint">Selecciona un producto para agregarlo a tu pedido</span>
        </div>

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
  const navigate = useNavigate()

  return (
    <section className="order-page-shell">
      <button className="order-page__back" type="button" onClick={() => navigate('/')}>
        Seguir explorando cafeterías
      </button>

      <header className="order-page__header">
        <div>
          <p className="section-kicker">Paso 1 de 3</p>
          <h1>Revisa tu pedido</h1>
          <p>Confirma los productos y agrega cualquier indicación antes de continuar.</p>
        </div>
        <div className="order-steps" aria-label="Progreso del pedido">
          <span className="active"><strong>1</strong> Pedido</span>
          <span><strong>2</strong> Datos</span>
          <span><strong>3</strong> Pago</span>
        </div>
      </header>

      <div className="order-page__content">
        <div className="order-page__aside">
          <div className="order-note">
            <span className="order-note__mark">UPB FOOD</span>
            <h2>Una pausa hecha a tu medida.</h2>
            <p>Revisa las cantidades, personaliza tus productos y elige cuándo recoger tu pedido.</p>
          </div>
          <div className="order-checklist">
            <span>Pedido preparado en la cafetería que elegiste</span>
            <span>Observaciones comunicadas al equipo de cocina</span>
            <span>Pago simulado y seguro dentro de la plataforma</span>
          </div>
        </div>
        <ResumenPedido />
      </div>
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

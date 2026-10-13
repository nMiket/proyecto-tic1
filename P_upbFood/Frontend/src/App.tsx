
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
import ResumenPedido from './components/ResumenPedido'
import RestaurantMenuPage from './components/RestaurantMenuPage'
import SeguimientoPedidoPage from './components/SeguimientoPedidoPage'
import { CartProvider } from './context/CartContext'
import {
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

            <NavLink
              to="/seguimiento"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Consultar pedido
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
          <Route path="/restaurante/:restauranteId" element={<RestaurantMenuPage />} />
          <Route path="/seguimiento" element={<SeguimientoPedidoPage />} />
          <Route path="/seguimiento/:codigo" element={<SeguimientoPedidoPage />} />

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
  const navigate = useNavigate()

  return (
    <>
      <section className="restaurant-directory-hero">
        <div>
          <p className="section-kicker">UPB Food · Alimentación en campus</p>
          <h1>¿Dónde quieres comer hoy?</h1>
          <p>Selecciona una cafetería, descubre su carta y arma tu pedido en pocos pasos.</p>
          <Link className="directory-tracking-cta" to="/seguimiento">
            Ya hice un pedido · Consultar estado
          </Link>
        </div>
        <div className="identity-logo-panel" aria-label="Espacios reservados para identidad visual">
          <span className="identity-logo-slot">/assets/branding/upb-logo.svg</span>
          <span className="identity-logo-slot identity-logo-slot--food">/assets/branding/upb-food-logo.svg</span>
        </div>
      </section>

      <ListaRestaurantes
        onSelectRestaurante={(restaurant) => navigate(`/restaurante/${restaurant.id}`)}
      />

      <SiteFooter />
    </>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <div className="footer-logo-placeholder">/assets/branding/upb-logo.svg</div>
        <div>
          <strong>UPB Food</strong>
          <span>Alimentación universitaria, más simple.</span>
        </div>
      </div>
      <div className="site-footer__links">
        <span>Proyecto académico UPB</span>
        <span>Campus · Medellín</span>
        <span>© 2026 UPB Food</span>
      </div>
    </footer>
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

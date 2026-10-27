import { useEffect, useState, type FormEvent } from 'react'
import ConfigurarInvitacionPage from './components/ConfigurarInvitacionPage'
import RevisarSolicitudPage from './components/RevisarSolicitudPage'
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
  getApiBaseUrl,
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

  const navigate = useNavigate()

  const tieneRolDueno = asignaciones.some(
    (asignacion) => Number(asignacion.tipoAdministradorId) === 1
  )
  const tieneRolCocina = asignaciones.some(
    (asignacion) => Number(asignacion.tipoAdministradorId) === 2
  )
  const soloCocina = !tieneRolDueno && tieneRolCocina

const tieneAccesoAdmin =
  isLoggedIn && (tieneRolDueno || tieneRolCocina)

const rutaPanelPrincipal = soloCocina
  ? '/admin/cocina'
  : '/admin/dashboard'

  // El dueno (rol 1) tambien puede ver la vista de cocina de su restaurante.
  // Primero se busca asignacion de cocinero; si no existe, se usa la del dueno.
  const restauranteCocinaId =
    asignaciones.find(
      (asignacion) => Number(asignacion.tipoAdministradorId) === 2
    )?.restauranteId ??
    asignaciones.find(
      (asignacion) => Number(asignacion.tipoAdministradorId) === 1
    )?.restauranteId ??
    restauranteId ??
    null

  useEffect(() => {
    let cancelled = false

    void refreshSession()
      .then((session) => {
        if (!cancelled && session) {
          setAdminName(session.email)
          setRestauranteId(session.restauranteId ?? null)
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
    setRestauranteId(session.restauranteId ?? null)
    setAsignaciones(session.asignaciones ?? [])
    setIsLoggedIn(true)

    return session.email
  }

  const handleLogout = async () => {
    try {
      await endSession()
    } catch (error) {
      // La sesión local debe cerrarse incluso si el servidor no responde.
      console.error('No se pudo confirmar el cierre de sesión en el servidor:', error)
    } finally {
      setIsLoggedIn(false)
      setAdminName('')
      setRestauranteId(null)
      setAsignaciones([])
      navigate('/admin', { replace: true })
    }
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link to="/" className="brand">
          <img src="/assets/branding/campana.svg" alt="" className="brand-logo-icon" aria-hidden="true" />
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
              {/* El panel de administración solo es visible para el dueño */}
              {tieneRolDueno && (
                <NavLink
                  to="/admin/dashboard"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  Panel del restaurante
                </NavLink>
              )}

              {/* El panel de cocina es visible tanto para el administrador como para el rol de cocina */}
              {(tieneRolDueno || tieneRolCocina) && restauranteCocinaId !== null && (
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
            path="/restaurante/:restauranteId"
            element={<RestaurantMenuPage />}
          />
          <Route
            path="/configurar-invitacion"
            element={<ConfigurarInvitacionPage />}
          />
          <Route
            path="/revisar-solicitud"
            element={<RevisarSolicitudPage />}
          />
          <Route
            path="/seguimiento"
            element={<SeguimientoPedidoPage />}
          />
          <Route
            path="/seguimiento/:codigo"
            element={<SeguimientoPedidoPage />}
          />

          <Route
            path="/admin"
            element={
              isLoggedIn ? (
                <Navigate
                  to={rutaPanelPrincipal}
                  replace
                />
              ) : (
                <AdminLoginPage onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              isLoggedIn && tieneRolDueno ? (
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
              isLoggedIn && (tieneRolDueno || tieneRolCocina) && restauranteCocinaId !== null ? (
                <DashboardCocina restauranteId={restauranteCocinaId} onLogout={handleLogout} />
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
          <p>
            Selecciona una cafetería, descubre su carta y arma tu pedido en
            pocos pasos.
          </p>
          <Link className="directory-tracking-cta" to="/seguimiento">
            Ya hice un pedido · Consultar estado
          </Link>
        </div>
        <div
          className="identity-logo-panel"
          aria-label="Identidad visual UPB Food"
        >
          <img
            src="/assets/branding/UPBFood.svg"
            alt="UPB Food · Universidad Pontificia Bolivariana"
            className="identity-logo-img"
          />
        </div>
      </section>

      <ListaRestaurantes
        onSelectRestaurante={(restaurant) =>
          navigate(`/restaurante/${restaurant.id}`)
        }
      />

      <SiteFooter />
    </>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <div className="footer-logo-placeholder">
          <img src="/assets/branding/UPBFood.svg" alt="UPB Food" className="footer-logo-img" />
        </div>
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
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [nombreSolicitante, setNombreSolicitante] = useState('')
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('')
  const [correoSolicitante, setCorreoSolicitante] = useState('')
  const [nombreRestaurante, setNombreRestaurante] = useState('')
  const [ubicacionRestaurante, setUbicacionRestaurante] = useState('')
  const [tiempoPreparacionMin, setTiempoPreparacionMin] = useState('15')

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMensaje('')
    setLoading(true)

    try {
      await onLogin(email, password)
      navigate('/admin')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible iniciar sesión.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleRegistro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMensaje('')
    setLoading(true)

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/solicitudes-registro`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreSolicitante,
            telefonoSolicitante,
            correoSolicitante,
            nombreRestaurante,
            ubicacionRestaurante,
            tiempoPreparacionMin: Number(tiempoPreparacionMin),
          }),
        }
      )

      const data = (await response.json().catch(() => ({}))) as {
        mensaje?: string
        message?: string
        solicitudId?: number
      }

      if (!response.ok) {
        throw new Error(
          data.mensaje ??
            data.message ??
            'No fue posible enviar la solicitud.'
        )
      }

      setMensaje(
        `${data.mensaje ?? 'Solicitud enviada correctamente.'}${
          data.solicitudId
            ? ` Código de solicitud: #${data.solicitudId}.`
            : ''
        }`
      )

      setNombreSolicitante('')
      setTelefonoSolicitante('')
      setCorreoSolicitante('')
      setNombreRestaurante('')
      setUbicacionRestaurante('')
      setTiempoPreparacionMin('15')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al enviar la solicitud.'
      )
    } finally {
      setLoading(false)
    }
  }

  function volverAlLogin() {
    setModo('login')
    setError('')
    setMensaje('')
  }

  return (
    <section className="login-card">
      <div className="login-header">
        <p className="eyebrow">Administración</p>
        <h2>
          {modo === 'login' ? 'Iniciar sesión' : 'Registrar restaurante'}
        </h2>
        <p>
          {modo === 'login'
            ? 'Ingresa con tus credenciales de administrador.'
            : 'Completa los datos para solicitar el registro de tu restaurante.'}
        </p>
      </div>

      {modo === 'login' ? (
        <form onSubmit={handleLogin} className="login-form">
          <label>
            Correo institucional
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@upb.edu.co"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Validando...' : 'Ingresar'}
          </button>

          <div className="register-restaurant-prompt">
            <span>¿Tu restaurante aún no está registrado?</span>
            <button
              type="button"
              className="register-restaurant-button"
              onClick={() => {
                setModo('registro')
                setError('')
                setMensaje('')
              }}
            >
              Registrar restaurante
            </button>
          </div>
        </form>
      ) : (
        <>
          <form
            onSubmit={handleRegistro}
            className="login-form registration-form"
          >
            <label>
              Nombre del solicitante
              <input
                value={nombreSolicitante}
                onChange={(event) =>
                  setNombreSolicitante(event.target.value)
                }
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>

            <label>
              Teléfono de contacto
              <input
                type="tel"
                value={telefonoSolicitante}
                onChange={(event) =>
                  setTelefonoSolicitante(event.target.value)
                }
                maxLength={20}
                autoComplete="tel"
                required
              />
            </label>

            <label>
              Correo de contacto
              <input
                type="email"
                value={correoSolicitante}
                onChange={(event) =>
                  setCorreoSolicitante(event.target.value)
                }
                maxLength={255}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Nombre del restaurante
              <input
                value={nombreRestaurante}
                onChange={(event) =>
                  setNombreRestaurante(event.target.value)
                }
                maxLength={50}
                required
              />
            </label>

            <label>
              Ubicación del restaurante
              <input
                value={ubicacionRestaurante}
                onChange={(event) =>
                  setUbicacionRestaurante(event.target.value)
                }
                maxLength={50}
                placeholder="Ej. Bloque 10, primer piso"
                required
              />
            </label>

            <label>
              Tiempo estimado de preparación (minutos)
              <input
                type="number"
                min={1}
                max={1440}
                value={tiempoPreparacionMin}
                onChange={(event) =>
                  setTiempoPreparacionMin(event.target.value)
                }
                required
              />
            </label>

            {error && <p className="error-message">{error}</p>}
            {mensaje && <p className="success-message">{mensaje}</p>}

            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>

          <button
            type="button"
            className="register-restaurant-button back-to-login-button"
            onClick={volverAlLogin}
          >
            Volver al inicio de sesión
          </button>
        </>
      )}
    </section>
  )
}

function PedidoPage() {
  const navigate = useNavigate()

  return (
    <section className="order-page-shell">
      <button
        className="order-page__back"
        type="button"
        onClick={() => navigate('/')}
      >
        Seguir explorando cafeterías
      </button>

      <header className="order-page__header">
        <div>
          <p className="section-kicker">Paso 1 de 3</p>
          <h1>Revisa tu pedido</h1>
          <p>
            Confirma los productos y agrega cualquier indicación antes de
            continuar.
          </p>
        </div>
        <div className="order-steps" aria-label="Progreso del pedido">
          <span className="active"><strong>1</strong> Pedido</span>
          <span><strong>2</strong> Datos</span>
          <span><strong>3</strong> Pago</span>
        </div>
      </header>

      <div className="order-page__content">
        <ResumenPedido />
        <div className="order-page__aside">
          <div className="order-note">
            <span className="order-note__mark">UPB FOOD</span>
            <h2>Una pausa hecha a tu medida.</h2>
            <p>
              Revisa las cantidades, personaliza tus productos y elige cuándo
              recoger tu pedido.
            </p>
          </div>
          <div className="order-checklist">
            <span>Pedido preparado en la cafetería que elegiste</span>
            <span>Observaciones comunicadas al equipo de cocina</span>
            <span>Pago simulado y seguro dentro de la plataforma</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function HistorialPage() {
  const [ultimoPedido] = useState(() => {
    try {
      const raw = localStorage.getItem('upbfood.lastOrder')
      if (!raw) return null
      return JSON.parse(raw) as {
        id?: number
        codigoSeguimiento?: string
        total?: number
        clienteNombre?: string
      }
    } catch {
      return null
    }
  })

  return (
    <section className="hero-card">
      <h1>Mi último pedido</h1>
      {ultimoPedido?.codigoSeguimiento ? (
        <div>
          <p>
            Pedido <strong>#{ultimoPedido.id}</strong> · Total:{' '}
            <strong>${Number(ultimoPedido.total ?? 0).toLocaleString('es-CO')}</strong>
          </p>
          <p>Código de seguimiento: <strong>{ultimoPedido.codigoSeguimiento}</strong></p>
          <Link
            className="directory-tracking-cta"
            to={`/seguimiento/${ultimoPedido.codigoSeguimiento}`}
          >
            Ver estado en tiempo real
          </Link>
        </div>
      ) : (
        <div>
          <p>Aún no tienes pedidos recientes guardados en este navegador.</p>
          <Link className="directory-tracking-cta" to="/seguimiento">
            Buscar un pedido por código o número
          </Link>
        </div>
      )}
    </section>
  )
}

export default App

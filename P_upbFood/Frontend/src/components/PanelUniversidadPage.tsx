import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getApiBaseUrl } from '../auth'
import './PaginasCliente.css'

// HU031 - Panel del encargado de la universidad para aprobar o rechazar
// las solicitudes de registro de nuevas cafeterías (HU030).

type Solicitud = {
  id: number
  nombreSolicitante: string
  telefonoSolicitante: string
  correoSolicitante: string
  nombreRestaurante: string
  ubicacionRestaurante: string
  tiempoPreparacionMin: number
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  fechaSolicitud?: string | null
  fechaRevision?: string | null
  observacionRevision?: string | null
}

type Filtro = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'TODAS'

type ResultadoDecision = {
  mensaje?: string
  message?: string
  enlaceActivacion?: string
}

const CLAVE_STORAGE = 'upbfood.revisorUpb'
const HEADER_CLAVE = 'X-UPB-Revisor-Clave'

const filtros: Array<{ valor: Filtro; etiqueta: string }> = [
  { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
  { valor: 'APROBADA', etiqueta: 'Aprobadas' },
  { valor: 'RECHAZADA', etiqueta: 'Rechazadas' },
  { valor: 'TODAS', etiqueta: 'Todas' },
]

function leerClave() {
  try {
    return sessionStorage.getItem(CLAVE_STORAGE) ?? ''
  } catch {
    return ''
  }
}

function guardarClave(valor: string) {
  try {
    if (valor) sessionStorage.setItem(CLAVE_STORAGE, valor)
    else sessionStorage.removeItem(CLAVE_STORAGE)
  } catch {
    // La clave se mantiene solo en memoria si el navegador no permite guardarla.
  }
}

function formatearFecha(valor?: string | null) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

async function leerMensaje(respuesta: Response, porDefecto: string) {
  const data = (await respuesta.json().catch(() => null)) as ResultadoDecision | null
  return data?.mensaje ?? data?.message ?? porDefecto
}

export default function PanelUniversidadPage() {
  const [clave, setClave] = useState(leerClave)
  const [claveInput, setClaveInput] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTE')
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enlaceActivacion, setEnlaceActivacion] = useState('')
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [rechazandoId, setRechazandoId] = useState<number | null>(null)
  const [observacion, setObservacion] = useState('')

  const cerrarPanel = useCallback((mensaje = '') => {
    guardarClave('')
    setClave('')
    setSolicitudes([])
    setError(mensaje)
  }, [])

  const cargar = useCallback(async () => {
    if (!clave) return
    setCargando(true)
    try {
      const respuesta = await fetch(
        `${getApiBaseUrl()}/api/upb/solicitudes?estado=${filtro}`,
        { headers: { [HEADER_CLAVE]: clave } },
      )
      if (respuesta.status === 401 || respuesta.status === 403) {
        cerrarPanel(await leerMensaje(respuesta, 'La clave del encargado no es válida.'))
        return
      }
      if (!respuesta.ok) {
        setError(await leerMensaje(respuesta, 'No fue posible cargar las solicitudes.'))
        return
      }
      setSolicitudes((await respuesta.json()) as Solicitud[])
      setError('')
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setCargando(false)
    }
  }, [clave, filtro, cerrarPanel])

  useEffect(() => {
    void Promise.resolve().then(cargar)
  }, [cargar])

  function ingresar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const valor = claveInput.trim()
    if (!valor) {
      setError('Ingresa la clave institucional.')
      return
    }
    guardarClave(valor)
    setClave(valor)
    setClaveInput('')
    setError('')
  }

  async function decidir(solicitud: Solicitud, accion: 'aprobar' | 'rechazar') {
    setProcesandoId(solicitud.id)
    setError('')
    setAviso('')
    setEnlaceActivacion('')
    try {
      const respuesta = await fetch(
        `${getApiBaseUrl()}/api/upb/solicitudes/${solicitud.id}/${accion}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [HEADER_CLAVE]: clave },
          body: accion === 'rechazar' ? JSON.stringify({ observacion: observacion.trim() || null }) : '{}',
        },
      )
      if (respuesta.status === 401) {
        cerrarPanel(await leerMensaje(respuesta, 'Tu sesión del panel terminó.'))
        return
      }
      const data = (await respuesta.json().catch(() => null)) as ResultadoDecision | null
      if (!respuesta.ok) {
        setError(data?.mensaje ?? data?.message ?? 'No fue posible registrar la decisión.')
        return
      }
      setAviso(
        data?.mensaje ??
          (accion === 'aprobar' ? 'Solicitud aprobada.' : 'Solicitud rechazada.'),
      )
      setEnlaceActivacion(data?.enlaceActivacion ?? '')
      setRechazandoId(null)
      setObservacion('')
      await cargar()
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setProcesandoId(null)
    }
  }

  if (!clave) {
    return (
      <section className="login-card">
        <div className="login-header">
          <p className="eyebrow">Universidad Pontificia Bolivariana</p>
          <h2>Panel de aprobación de cafeterías</h2>
          <p>Acceso exclusivo para la persona encargada de revisar los establecimientos del campus.</p>
        </div>
        <form className="login-form" onSubmit={ingresar}>
          <label>
            Clave institucional
            <input
              type="password"
              value={claveInput}
              onChange={(event) => setClaveInput(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="submit">Entrar al panel</button>
        </form>
      </section>
    )
  }

  return (
    <section className="client-page">
      <header className="client-page__header client-page__header--row">
        <div>
          <p className="section-kicker">Encargado UPB</p>
          <h1>Solicitudes de registro</h1>
          <p>Revisa los datos de cada cafetería antes de habilitarla en UPB Food.</p>
        </div>
        <button type="button" className="client-link-button" onClick={() => cerrarPanel()}>
          Salir del panel
        </button>
      </header>

      <div className="client-tabs" role="tablist" aria-label="Filtrar solicitudes">
        {filtros.map((item) => (
          <button
            key={item.valor}
            type="button"
            role="tab"
            aria-selected={filtro === item.valor}
            className={filtro === item.valor ? 'is-active' : ''}
            onClick={() => setFiltro(item.valor)}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {aviso && (
        <div className="success-message" role="status">
          <p>{aviso}</p>
          {enlaceActivacion && (
            <p className="activation-link">
              Enlace de activación: <code>{enlaceActivacion}</code>{' '}
              <button
                type="button"
                className="client-link-button"
                onClick={() => void navigator.clipboard?.writeText(enlaceActivacion)}
              >
                Copiar
              </button>
            </p>
          )}
        </div>
      )}

      {cargando && solicitudes.length === 0 ? (
        <p className="client-empty">Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <div className="client-card">
          <p className="client-empty">No hay solicitudes en esta categoría.</p>
        </div>
      ) : (
        <div className="request-list">
          {solicitudes.map((solicitud) => (
            <article key={solicitud.id} className="client-card request-card">
              <div className="client-card__heading">
                <div>
                  <span className="request-card__id">Solicitud #{solicitud.id}</span>
                  <h2>{solicitud.nombreRestaurante}</h2>
                </div>
                <span
                  className={
                    solicitud.estado === 'APROBADA'
                      ? 'status-pill status-pill--done'
                      : solicitud.estado === 'RECHAZADA'
                        ? 'status-pill status-pill--danger'
                        : 'status-pill status-pill--warning'
                  }
                >
                  {solicitud.estado === 'PENDIENTE' ? 'Pendiente de aprobación' : solicitud.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>

              <dl className="request-card__data">
                <div><dt>Ubicación</dt><dd>{solicitud.ubicacionRestaurante}</dd></div>
                <div><dt>Tiempo de preparación</dt><dd>{solicitud.tiempoPreparacionMin} min</dd></div>
                <div><dt>Solicitante</dt><dd>{solicitud.nombreSolicitante}</dd></div>
                <div><dt>Correo</dt><dd>{solicitud.correoSolicitante}</dd></div>
                <div><dt>Teléfono</dt><dd>{solicitud.telefonoSolicitante}</dd></div>
                <div><dt>Recibida</dt><dd>{formatearFecha(solicitud.fechaSolicitud)}</dd></div>
                {solicitud.estado !== 'PENDIENTE' && (
                  <div><dt>Revisada</dt><dd>{formatearFecha(solicitud.fechaRevision)}</dd></div>
                )}
                {solicitud.observacionRevision && (
                  <div><dt>Observación</dt><dd>{solicitud.observacionRevision}</dd></div>
                )}
              </dl>

              {solicitud.estado === 'PENDIENTE' && (
                rechazandoId === solicitud.id ? (
                  <div className="request-card__reject">
                    <label>
                      Motivo del rechazo (opcional, se envía al solicitante)
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={observacion}
                        onChange={(event) => setObservacion(event.target.value)}
                      />
                    </label>
                    <div className="request-card__actions">
                      <button
                        type="button"
                        className="client-button client-button--danger"
                        disabled={procesandoId === solicitud.id}
                        onClick={() => void decidir(solicitud, 'rechazar')}
                      >
                        {procesandoId === solicitud.id ? 'Guardando...' : 'Confirmar rechazo'}
                      </button>
                      <button
                        type="button"
                        className="client-link-button"
                        onClick={() => {
                          setRechazandoId(null)
                          setObservacion('')
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="request-card__actions">
                    <button
                      type="button"
                      className="client-button"
                      disabled={procesandoId === solicitud.id}
                      onClick={() => void decidir(solicitud, 'aprobar')}
                    >
                      {procesandoId === solicitud.id ? 'Aprobando...' : 'Aprobar y enviar invitación'}
                    </button>
                    <button
                      type="button"
                      className="client-button client-button--ghost"
                      disabled={procesandoId === solicitud.id}
                      onClick={() => {
                        setRechazandoId(solicitud.id)
                        setObservacion('')
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

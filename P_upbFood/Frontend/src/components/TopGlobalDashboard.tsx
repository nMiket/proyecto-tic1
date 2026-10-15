
import { useCallback, useEffect, useState } from 'react'
import { apiFetch, getApiBaseUrl } from '../auth'

type SolicitudRegistro = {
  id: number
  nombreSolicitante: string
  telefonoSolicitante: string
  correoSolicitante: string
  nombreRestaurante: string
  ubicacionRestaurante: string
  tiempoPreparacionMin: number
  estado: string
  fechaSolicitud: string
}

type RespuestaApi = {
  mensaje?: string
  message?: string
}

export default function TopGlobalDashboard({
  adminName,
  onLogout,
}: {
  adminName: string
  onLogout: () => void
}) {
  const [solicitudes, setSolicitudes] = useState<SolicitudRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/solicitudes-registro/pendientes`,
      )

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'Tu cuenta no tiene permisos para revisar solicitudes.'
            : 'No se pudieron cargar las solicitudes pendientes.',
        )
      }

      const data = (await response.json()) as SolicitudRegistro[]
      setSolicitudes(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al consultar las solicitudes.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargarSolicitudes()
  }, [cargarSolicitudes])

  const revisarSolicitud = async (
    solicitud: SolicitudRegistro,
    accion: 'aprobar' | 'rechazar',
  ) => {
    let observacion = ''

    if (accion === 'aprobar') {
      if (
        !window.confirm(
          `¿Aprobar el registro de "${solicitud.nombreRestaurante}"?`,
        )
      ) {
        return
      }
    } else {
      const respuesta = window.prompt(
        `Motivo del rechazo de "${solicitud.nombreRestaurante}" (opcional):`,
      )

      if (respuesta === null) return

      observacion = respuesta.trim()

      if (observacion.length > 500) {
        setError('La observación no puede superar los 500 caracteres.')
        return
      }

      if (
        !window.confirm(
          `¿Rechazar la solicitud de "${solicitud.nombreRestaurante}"?`,
        )
      ) {
        return
      }
    }

    setError('')
    setMensaje('')
    setProcesandoId(solicitud.id)

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/solicitudes-registro/${solicitud.id}/${accion}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...(accion === 'rechazar'
            ? { body: JSON.stringify({ observacion }) }
            : {}),
        },
      )

      const data = (await response.json().catch(() => ({}))) as RespuestaApi

      if (!response.ok) {
        throw new Error(
          data.mensaje ??
            data.message ??
            `No se pudo ${accion === 'aprobar' ? 'aprobar' : 'rechazar'} la solicitud.`,
        )
      }

      setMensaje(
        data.mensaje ??
          data.message ??
          `Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente.`,
      )

      await cargarSolicitudes()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al revisar la solicitud.',
      )
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Administración global</p>
          <h2>Bienvenido, {adminName}</h2>
          <p>Revisa las solicitudes de registro de restaurantes.</p>
        </div>

        <button className="secondary" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3>Solicitudes pendientes</h3>
            <p>Solicitudes por revisar: {solicitudes.length}</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void cargarSolicitudes()}
            disabled={loading || procesandoId !== null}
          >
            Actualizar
          </button>
        </div>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {mensaje && (
          <p className="success-message" role="status">
            {mensaje}
          </p>
        )}

        {loading ? (
          <p>Cargando solicitudes...</p>
        ) : solicitudes.length === 0 ? (
          <p>No hay solicitudes pendientes por el momento.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 20,
            }}
          >
            {solicitudes.map((solicitud) => (
              <article
                key={solicitud.id}
                style={{
                  border: '1px solid #d3ebe7',
                  borderRadius: 12,
                  padding: 20,
                  minWidth: 0,
                }}
              >
                <p className="eyebrow">Solicitud #{solicitud.id}</p>
                <h3>{solicitud.nombreRestaurante}</h3>

                <p>
                  <strong>Solicitante:</strong>{' '}
                  {solicitud.nombreSolicitante}
                </p>
                <p>
                  <strong>Ubicación:</strong>{' '}
                  {solicitud.ubicacionRestaurante}
                </p>
                <p>
                  <strong>Teléfono:</strong>{' '}
                  {solicitud.telefonoSolicitante}
                </p>
                <p>
                  <strong>Correo:</strong>{' '}
                  {solicitud.correoSolicitante}
                </p>
                <p>
                  <strong>Preparación:</strong>{' '}
                  {solicitud.tiempoPreparacionMin} minutos
                </p>
                <p>
                  <strong>Fecha:</strong>{' '}
                  {new Date(solicitud.fechaSolicitud).toLocaleString('es-CO')}
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    disabled={procesandoId !== null}
                    onClick={() =>
                      void revisarSolicitud(solicitud, 'aprobar')
                    }
                  >
                    {procesandoId === solicitud.id
                      ? 'Procesando...'
                      : 'Aprobar'}
                  </button>

                  <button
                    type="button"
                    className="mini-button danger"
                    disabled={procesandoId !== null}
                    onClick={() =>
                      void revisarSolicitud(solicitud, 'rechazar')
                    }
                  >
                    Rechazar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getApiBaseUrl } from '../auth'

type RespuestaApi = {
  mensaje?: string
  message?: string
  detail?: string
}

export default function RevisarSolicitudPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const accionParam = searchParams.get('accion')
  const accion = accionParam === 'aprobar' || accionParam === 'rechazar'
    ? accionParam
    : null

  const [observacion, setObservacion] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [decisionNoDisponible, setDecisionNoDisponible] = useState(false)
  const [validandoEnlace, setValidandoEnlace] = useState(true)
  const [enlaceValidado, setEnlaceValidado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false

    async function validarEnlace() {
      if (!token || !accion) {
        setError('El enlace de revisión no es válido. Verifica el enlace del correo.')
        setDecisionNoDisponible(true)
        setValidandoEnlace(false)
        return
      }

      try {
        const params = new URLSearchParams({ token, accion })
        const response = await fetch(
          `${getApiBaseUrl()}/api/solicitudes-registro/revisar-correo?${params.toString()}`,
        )
        const data = (await response.json().catch(() => ({}))) as RespuestaApi

        if (!response.ok) {
          throw new Error(
            data.mensaje ?? data.message ?? data.detail ?? 'Este enlace ya no está disponible.',
          )
        }

        if (!cancelado) setEnlaceValidado(true)
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No fue posible validar el enlace.')
          setDecisionNoDisponible(true)
        }
      } finally {
        if (!cancelado) setValidandoEnlace(false)
      }
    }

    void validarEnlace()
    return () => { cancelado = true }
  }, [token, accion])

  async function confirmarDecision() {
    if (!token || !accion) {
      setError('El enlace de revisión no es válido. Verifica el enlace del correo.')
      return
    }

    setProcesando(true)
    setError('')
    setMensaje('')

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/solicitudes-registro/revisar-correo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, accion, observacion }),
        },
      )

      const data = (await response.json().catch(() => ({}))) as RespuestaApi

      if (!response.ok) {
        const mensajeError = data.mensaje ?? data.message ?? data.detail ?? 'No fue posible procesar la decisión.'
        if (response.status === 400 || response.status === 409 || response.status === 410) {
          setDecisionNoDisponible(true)
        }
        throw new Error(mensajeError)
      }

      setMensaje(data.mensaje ?? 'La decisión se registró correctamente.')
      setCompletado(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al procesar la decisión.',
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">UPB Food · Revisión por correo</p>
          <h2>
            {accion === 'aprobar'
              ? 'Aprobar solicitud de restaurante'
              : accion === 'rechazar'
                ? 'Rechazar solicitud de restaurante'
                : 'Enlace de revisión'}
          </h2>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, maxWidth: 720 }}>
        {validandoEnlace ? (
          <p role="status">Verificando el enlace de revisión...</p>
        ) : !token || !accion ? (
          <p className="error-message" role="alert">
            {error || 'El enlace no contiene una decisión válida. Abre el enlace original que recibiste por correo.'}
          </p>
        ) : completado ? (
          <div>
            <p className="success-message" role="status">{mensaje}</p>
            <p>Ya puedes cerrar esta página.</p>
          </div>
        ) : decisionNoDisponible || !enlaceValidado ? (
          <div>
            <p className="error-message" role="alert">{error || 'Esta solicitud ya fue resuelta y no se puede modificar nuevamente.'}</p>
            <p>Los enlaces de aprobación y rechazo ya no permiten realizar otra acción.</p>
            <Link className="secondary-button" to="/">Volver al inicio</Link>
          </div>
        ) : (
          <>
            <p>
              {accion === 'aprobar'
                ? 'Al confirmar, se aprobará la solicitud y se enviará al solicitante un enlace para activar su cuenta de dueño.'
                : 'Al confirmar, la solicitud quedará rechazada. Puedes incluir un motivo opcional.'}
            </p>

            {accion === 'rechazar' && (
              <label style={{ display: 'block', marginTop: 16 }}>
                Motivo del rechazo (opcional)
                <textarea
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  maxLength={500}
                  rows={4}
                  style={{ display: 'block', width: '100%', marginTop: 8 }}
                  placeholder="Escribe un motivo para el solicitante..."
                />
              </label>
            )}

            {error && (
              <p className="error-message" role="alert" style={{ marginTop: 16 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              <button type="button" onClick={() => void confirmarDecision()} disabled={procesando}>
                {procesando
                  ? 'Procesando...'
                  : accion === 'aprobar'
                    ? 'Confirmar aprobación'
                    : 'Confirmar rechazo'}
              </button>
              <Link className="secondary-button" to="/">
                Cancelar
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

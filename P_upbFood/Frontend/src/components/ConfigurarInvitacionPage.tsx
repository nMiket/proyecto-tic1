import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getApiBaseUrl } from '../auth'

type RespuestaApi = {
  mensaje?: string
  message?: string
  error?: string
}

export default function ConfigurarInvitacionPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function activarCuenta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMensaje('')

    if (!token) {
      setError('El enlace de invitación no contiene un token válido. Revisa el correo recibido.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password.length > 72) {
      setError('La contraseña no puede superar los 72 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setProcesando(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/invitaciones/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = (await response.json().catch(() => ({}))) as RespuestaApi
      if (!response.ok) {
        throw new Error(
          data.mensaje ??
            data.message ??
            data.error ??
            'No fue posible activar la cuenta. El enlace podría haber expirado o ya haber sido utilizado.',
        )
      }

      setMensaje(data.mensaje ?? 'Tu cuenta fue activada correctamente. Ya puedes iniciar sesión.')
      setCompletado(true)
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al activar la cuenta.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">UPB Food · Activación de cuenta</p>
          <h2>Configura tu contraseña</h2>
          <p>Establece una contraseña para activar tu cuenta de dueño del restaurante.</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, maxWidth: 560 }}>
        {!token ? (
          <>
            <p className="error-message" role="alert">
              El enlace no es válido porque no contiene el token de invitación. Abre el enlace completo que recibiste por correo.
            </p>
            <p style={{ marginTop: 16 }}>
              Si el problema continúa, solicita que te envíen una nueva invitación.
            </p>
          </>
        ) : completado ? (
          <div>
            <p className="success-message" role="status">{mensaje}</p>
            <p>Ya puedes entrar al panel administrativo con tu correo y la contraseña que acabas de crear.</p>
            <Link className="directory-tracking-cta" to="/admin" style={{ display: 'inline-block', marginTop: 12 }}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form className="login-form" onSubmit={activarCuenta}>
            <label>
              Nueva contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                placeholder="Mínimo 8 caracteres"
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                placeholder="Escribe nuevamente tu contraseña"
              />
            </label>

            {error && <p className="error-message" role="alert">{error}</p>}

            <button type="submit" disabled={procesando}>
              {procesando ? 'Activando cuenta...' : 'Crear contraseña y activar cuenta'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

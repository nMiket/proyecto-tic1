import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getApiBaseUrl } from '../auth'

export default function ActivarInvitacionPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMensaje('')

    if (!token.trim()) {
      setError('El enlace de invitación no contiene un token válido.')
      return
    }

    if (password.length < 8 || password.length > 72) {
      setError('La contraseña debe tener entre 8 y 72 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/invitaciones/activar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      )

      const data = (await response.json().catch(() => ({}))) as {
        mensaje?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(
          data.mensaje ??
            data.message ??
            'No fue posible activar la cuenta. Verifica tu invitación.'
        )
      }

      setMensaje(
        data.mensaje ?? '¡Cuenta activada correctamente!'
      )
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al activar la cuenta.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="login-card activation-card">
      <div className="login-header">
        <p className="eyebrow">UPB Food · Administración</p>
        <h2>Activa tu cuenta</h2>
        <p>
          Tu solicitud fue aprobada. Crea una contraseña para
          comenzar a utilizar tu cuenta de administrador.
        </p>
      </div>

      {mensaje ? (
        <div className="activation-success">
          <p className="success-message">{mensaje}</p>
          <Link className="activation-login-link" to="/admin">
            Ir al inicio de sesión
          </Link>
        </div>
      ) : (
        <form
          className="login-form registration-form"
          onSubmit={handleSubmit}
        >
          <label>
            Nueva contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Escribe nuevamente tu contraseña"
              required
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading || !token}>
            {loading ? 'Activando cuenta...' : 'Crear contraseña y activar'}
          </button>

          {!token && (
            <p className="error-message">
              Falta el token de invitación. Abre el enlace completo
              que recibiste.
            </p>
          )}
        </form>
      )}
    </section>
  )
}
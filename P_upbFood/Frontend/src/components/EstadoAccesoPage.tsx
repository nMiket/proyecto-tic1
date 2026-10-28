import { Link } from 'react-router-dom'
import './PaginasCliente.css'

// HU024 - Respuestas visibles para rutas sin permiso (403) o inexistentes (404).

type EstadoAccesoPageProps = {
  tipo: 'prohibido' | 'no-encontrado'
  destino?: string
  textoDestino?: string
}

export default function EstadoAccesoPage({
  tipo,
  destino = '/',
  textoDestino = 'Volver al inicio',
}: EstadoAccesoPageProps) {
  const prohibido = tipo === 'prohibido'

  return (
    <section className="client-page client-page--narrow">
      <div className="client-card access-state">
        <span className="access-state__code" aria-hidden="true">{prohibido ? '403' : '404'}</span>
        <h1>{prohibido ? 'No tienes acceso a esta sección' : 'No encontramos esta página'}</h1>
        <p>
          {prohibido
            ? 'Tu rol no tiene permisos para abrir esta vista. Si crees que es un error, pide al dueño de la cafetería que revise tu asignación.'
            : 'La dirección no existe o cambió. Revisa el enlace o vuelve al inicio.'}
        </p>
        <Link className="client-button" to={destino}>
          {textoDestino}
        </Link>
      </div>
    </section>
  )
}

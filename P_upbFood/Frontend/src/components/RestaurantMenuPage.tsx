import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ListaProductos from './ListaProductos'
import ResumenPedido from './ResumenPedido'
import { useCart } from '../context/useCart'
import { apiFetch, getApiBaseUrl } from '../auth'
import './RestaurantMenuPage.css'

type Restaurante = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
  imagen?: string
  imagenUrl?: string
  horario?: string | null
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80'

export default function RestaurantMenuPage() {
  const { restauranteId } = useParams()
  const navigate = useNavigate()
  const { agregarProducto } = useCart()
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const id = Number(restauranteId)

    apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el restaurante')
        return response.json() as Promise<Restaurante[]>
      })
      .then((restaurantes) => {
        const encontrado = restaurantes.find((item) => item.id === id)
        if (!encontrado) throw new Error('Restaurante no encontrado')
        setRestaurante(encontrado)
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [restauranteId])

  if (cargando) {
    return (
      <section className="restaurant-menu-page" aria-live="polite" aria-busy="true">
        <div className="skeleton-card" role="status" aria-label="Cargando menú de la cafetería">
          <div className="skeleton-block skeleton-block--media" />
          <div className="skeleton-block skeleton-block--title" />
          <div className="skeleton-block skeleton-block--line" />
        </div>
      </section>
    )
  }

  if (error || !restaurante) {
    return (
      <div className="restaurant-menu-state">
        <h1>No encontramos este restaurante</h1>
        <button type="button" onClick={() => navigate('/')}>Volver al directorio</button>
      </div>
    )
  }

  const estaCerrado = restaurante.estado?.trim().toLowerCase() === 'cerrado'

  return (
    <section className="restaurant-menu-page">
      <button className="restaurant-menu__back" type="button" onClick={() => navigate('/')}>
        Volver a restaurantes
      </button>

      <header className="restaurant-menu__hero">
        <img src={restaurante.imagenUrl || restaurante.imagen || DEFAULT_IMAGE} alt={`Imagen de ${restaurante.nombre}`} />
        <div className="restaurant-menu__hero-content">
          <span className={`restaurant-menu__status ${estaCerrado ? 'restaurant-menu__status--closed' : ''}`}>
            {restaurante.estado || 'Disponible'}
          </span>
          <p className="section-kicker">Menú de la cafetería</p>
          <h1>{restaurante.nombre}</h1>
          <p>{restaurante.ubicacion} · Recogida estimada en {restaurante.tiempoEstimadoMin || 15} minutos</p>
          {restaurante.horario && <p className="restaurant-menu__schedule">Horario: {restaurante.horario}</p>}
        </div>
      </header>

      {estaCerrado && (
        <div className="restaurant-menu__closed-banner" role="alert">
          <strong>Cafetería cerrada en este momento</strong>
          <span>
            Esta cafetería no está recibiendo pedidos actualmente. Puedes consultar su carta, pero la compra está deshabilitada hasta que vuelva a abrir.
          </span>
        </div>
      )}

      <div className="restaurant-menu__layout">
        <div className="restaurant-menu__catalog">
          <div className="restaurant-menu__heading">
            <div>
              <p className="section-kicker">Carta disponible</p>
              <h2>Elige tus productos</h2>
            </div>
            <span>
              {estaCerrado
                ? 'Pedidos deshabilitados mientras la cafetería esté cerrada.'
                : 'Abre los detalles para elegir ingredientes extra.'}
            </span>
          </div>
          <ListaProductos
            restauranteId={restaurante.id}
            mostrarBuscador
            cafeteriaCerrada={estaCerrado}
            onAgregar={
              estaCerrado
                ? undefined
                : (product) =>
                    agregarProducto({
                      ...product,
                      id: Number(product.id),
                      restauranteId: restaurante.id,
                      tiempoEstimadoMin: restaurante.tiempoEstimadoMin || 15,
                      imagenUrl: product.imagenUrl,
                      adiciones: product.adiciones ?? [],
                    })
            }
          />
        </div>

        <ResumenPedido checkoutLabel="Ir al pedido" checkoutPath="/pedido" />
      </div>
    </section>
  )
}

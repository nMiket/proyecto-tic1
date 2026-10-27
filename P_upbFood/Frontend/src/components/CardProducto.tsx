import { useEffect, useMemo, useRef, useState } from 'react'
import type { Producto, IngredienteExtra } from '../types/Producto'
import { getProductFallbackImage } from '../utils/formatters'
import './CardProducto.css'

interface CardProductoProps {
  producto: Producto
  onAgregar?: (producto: Producto) => void
  cafeteriaCerrada?: boolean
}

const formatearCOP = (valor: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(valor)

export const CardProducto = ({ producto, onAgregar, cafeteriaCerrada = false }: CardProductoProps) => {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [cantidad, setCantidad] = useState(1)
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)
  const disponible = producto.disponible !== false && !cafeteriaCerrada
  const fallbackImage = useMemo(
    () => getProductFallbackImage(producto.categoriaId, producto.nombre),
    [producto.categoriaId, producto.nombre],
  )
  const extras = useMemo(() => producto.ingredientesExtra ?? [], [producto.ingredientesExtra])
  const totalExtras = useMemo(() => extras
    .filter((extra) => seleccionados.includes(Number(extra.id)))
    .reduce((total, extra) => total + Number(extra.precio), 0), [extras, seleccionados])

  const cerrarModal = () => {
    setModalAbierto(false)
    setSeleccionados([])
    setCantidad(1)
    window.setTimeout(() => {
      triggerBtnRef.current?.focus()
    }, 0)
  }

  useEffect(() => {
    if (!modalAbierto) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cerrarModal()
        return
      }
      if (event.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalAbierto])

  const confirmarProducto = () => {
    if (!onAgregar || !disponible) return
    const adiciones: IngredienteExtra[] = extras.filter((extra) => seleccionados.includes(Number(extra.id)))
    for (let i = 0; i < cantidad; i += 1) onAgregar({ ...producto, adiciones })
    cerrarModal()
  }

  return (
    <>
      <article className={`product-card ${disponible ? '' : 'product-card--unavailable'}`}>
        <div className="product-card__image-wrap">
          <img
            className="product-card__image"
            src={producto.imagenUrl || fallbackImage}
            alt={producto.nombre}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.src !== fallbackImage) {
                event.currentTarget.src = fallbackImage
              }
            }}
          />
          {!disponible && (
            <span className="product-card__badge">
              {cafeteriaCerrada ? 'Cerrado' : 'No disponible'}
            </span>
          )}
        </div>
        <div className="product-card__content">
          <h3>{producto.nombre}</h3>
          <p>{producto.descripcion}</p>
          <div className="product-card__footer">
            <span className="product-card__price">{formatearCOP(Number(producto.precio))}</span>
            {cafeteriaCerrada ? (
              <button className="product-card__button" type="button" disabled>
                Cafetería cerrada
              </button>
            ) : (
              onAgregar && (
                <button
                  ref={triggerBtnRef}
                  className="product-card__button"
                  type="button"
                  onClick={() => disponible && setModalAbierto(true)}
                  disabled={!disponible}
                >
                  {disponible ? 'Ver detalles' : 'No disponible'}
                </button>
              )
            )}
          </div>
        </div>
      </article>

      {modalAbierto && (
        <div className="product-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cerrarModal() }}>
          <section ref={modalRef} className="product-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
            <button ref={closeBtnRef} type="button" className="product-detail-close" aria-label="Cerrar detalles" onClick={cerrarModal}>×</button>
            <img
              className="product-detail-image"
              src={producto.imagenUrl || fallbackImage}
              alt={producto.nombre}
              decoding="async"
              onError={(event) => {
                if (event.currentTarget.src !== fallbackImage) {
                  event.currentTarget.src = fallbackImage
                }
              }}
            />
            <div className="product-detail-content">
              <p className="section-kicker">Detalles del producto</p>
              <h2 id="product-detail-title">{producto.nombre}</h2>
              <p className="product-detail-description">{producto.descripcion}</p>
              <div className="product-detail-base-price">Precio base <strong>{formatearCOP(Number(producto.precio))}</strong></div>

              {extras.length > 0 ? (
                <div className="product-detail-extras">
                  <h3>¿Quieres agregar algo extra?</h3>
                  <p>Selecciona los adicionales que quieras incluir. Se cobran por cada unidad.</p>
                  {extras.map((extra) => (
                    <label className="product-detail-extra" key={extra.id}>
                      <input type="checkbox" checked={seleccionados.includes(Number(extra.id))} onChange={(event) => setSeleccionados((current) => event.target.checked ? [...current, Number(extra.id)] : current.filter((id) => id !== Number(extra.id)))} />
                      <span>{extra.nombre}</span>
                      <strong>+{formatearCOP(Number(extra.precio))}</strong>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="product-detail-no-extras">Este producto no tiene ingredientes extra por ahora.</p>
              )}

              <div className="product-detail-bottom">
                <div className="product-detail-quantity" aria-label="Cantidad">
                  <button type="button" aria-label="Disminuir cantidad" onClick={() => setCantidad((value) => Math.max(1, value - 1))}>−</button>
                  <span>{cantidad}</span>
                  <button type="button" aria-label="Aumentar cantidad" onClick={() => setCantidad((value) => Math.min(20, value + 1))}>+</button>
                </div>
                <div className="product-detail-total">
                  <span>Total por unidad</span>
                  <strong>{formatearCOP(Number(producto.precio) + totalExtras)}</strong>
                </div>
              </div>
              <button type="button" className="product-detail-add" onClick={confirmarProducto}>
                Agregar {cantidad > 1 ? `${cantidad} unidades` : 'al pedido'} · {formatearCOP((Number(producto.precio) + totalExtras) * cantidad)}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

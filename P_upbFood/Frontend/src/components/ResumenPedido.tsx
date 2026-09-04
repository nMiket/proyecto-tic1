import { useCart } from '../context/useCart'
import './ResumenPedido.css'

function ResumenPedido() {
  const { items, totalItems, total, agregarProducto, quitarProducto, eliminarProducto, vaciarCarrito } = useCart()

  return (
    <aside className="order-summary" aria-label="Resumen del pedido">
      <div className="order-summary__heading">
        <div>
          <p className="eyebrow">Tu pedido</p>
          <h2>Resumen</h2>
        </div>
        <span className="order-badge">{totalItems}</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-order">Agrega productos del menú para verlos aquí.</p>
      ) : (
        <>
          <div className="order-items">
            {items.map((item) => (
              <div className="order-item" key={item.id}>
                <div>
                  <strong>{item.nombre}</strong>
                  <span>${(Number(item.precio) * item.cantidad).toLocaleString('es-CO')}</span>
                </div>
                <div className="quantity-controls">
                  <button type="button" aria-label={`Quitar una unidad de ${item.nombre}`} onClick={() => quitarProducto(item.id)}>-</button>
                  <span>{item.cantidad}</span>
                  <button type="button" aria-label={`Agregar una unidad de ${item.nombre}`} onClick={() => agregarProducto(item)}>+</button>
                  <button className="remove-item" type="button" aria-label={`Eliminar ${item.nombre}`} onClick={() => eliminarProducto(item.id)}>x</button>
                </div>
              </div>
            ))}
          </div>
          <div className="order-total"><span>Total</span><strong>${total.toLocaleString('es-CO')}</strong></div>
          <div className="order-actions">
            <button type="button" className="checkout-button" disabled>Continuar al pago</button>
            <button type="button" className="clear-button" onClick={vaciarCarrito}>Vaciar carrito</button>
          </div>
        </>
      )}
    </aside>
  )
}

export default ResumenPedido

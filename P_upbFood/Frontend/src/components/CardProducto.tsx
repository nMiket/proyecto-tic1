import React from 'react';
import type { Producto } from '../types/Producto';
import './CardProducto.css';

interface CardProductoProps {
  producto: Producto;
  onAgregar?: (producto: Producto) => void;
}

export const CardProducto: React.FC<CardProductoProps> = ({ producto, onAgregar }) => {
  const formatearCOP = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  };

  const disponible = producto.disponible !== false;

  return (
    <article className={`product-card ${disponible ? '' : 'product-card--unavailable'}`}>
      <div className="product-card__image-wrap">
        <img
          className="product-card__image"
          src={producto.imagenUrl} 
          alt={producto.nombre}
        />
        {!disponible && (
          <span className="product-card__badge">No disponible</span>
        )}
      </div>
      <div className="product-card__content">
        <h3>{producto.nombre}</h3>
        <p>{producto.descripcion}</p>
        <div className="product-card__footer">
          <span className="product-card__price">{formatearCOP(producto.precio)}</span>
          {onAgregar && (
            <button
              className="product-card__button"
              onClick={() => disponible && onAgregar(producto)}
              disabled={!disponible}
            >
              {disponible ? 'Agregar al pedido' : 'No disponible'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

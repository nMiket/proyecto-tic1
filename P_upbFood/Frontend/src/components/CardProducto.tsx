import React from 'react';
import type { Producto } from '../types/Producto';

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
    <div style={{ ...styles.card, opacity: disponible ? 1 : 0.75 }}>
      <div style={{ position: 'relative' }}>
        <img 
          src={producto.imagenUrl} 
          alt={producto.nombre} 
          style={styles.imagen} 
        />
        {!disponible && (
          <span style={styles.badgeAgotado}>
            Agotado
          </span>
        )}
      </div>
      <div style={styles.contenido}>
        <h3 style={styles.titulo}>{producto.nombre}</h3>
        <p style={styles.descripcion}>{producto.descripcion}</p>
        <div style={styles.footer}>
          <span style={styles.precio}>{formatearCOP(producto.precio)}</span>
          {onAgregar && (
            <button 
              style={{ ...styles.boton, ...(disponible ? {} : styles.botonDeshabilitado) }} 
              onClick={() => disponible && onAgregar(producto)}
              disabled={!disponible}
            >
              {disponible ? 'Agregar' : 'Sin stock'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  imagen: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
  },
  badgeAgotado: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: '#c0392b',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  contenido: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  titulo: {
    margin: 0,
    fontSize: '1rem',
    color: '#333',
  },
  descripcion: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#666',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  },
  precio: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  boton: {
    backgroundColor: '#0d7377',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  botonDeshabilitado: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed',
  },
};

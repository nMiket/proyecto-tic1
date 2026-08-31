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

  return (
    <div style={styles.card}>
      <img 
        src={producto.imagenUrl} 
        alt={producto.nombre} 
        style={styles.imagen} 
      />
      <div style={styles.contenido}>
        <h3 style={styles.titulo}>{producto.nombre}</h3>
        <p style={styles.descripcion}>{producto.descripcion}</p>
        <div style={styles.footer}>
          <span style={styles.precio}>{formatearCOP(producto.precio)}</span>
          {onAgregar && (
            <button style={styles.boton} onClick={() => onAgregar(producto)}>
              Agregar
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
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '280px',
    margin: '10px',
  },
  imagen: {
    width: '100%',
    height: '160px',
    objectFit: 'cover',
  },
  contenido: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  titulo: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#333',
  },
  descripcion: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#666',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '10px',
  },
  precio: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  boton: {
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

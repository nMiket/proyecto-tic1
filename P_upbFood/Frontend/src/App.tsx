import React, { useState } from 'react';
import { CardProducto } from './components/CardProducto';
import type { Producto } from './types/Producto';

// Datos de prueba para verificar los productos y el formato COP
const PRODUCTOS_DE_PRUEBA: Producto[] = [
  {
    id: 1,
    nombre: 'Empanada de Carne',
    descripcion: 'Deliciosa empanada crujiente rellena de carne desmechada y papa.',
    precio: 3500,
    imagenUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400',
  },
  {
    id: 2,
    nombre: 'Jugo Natural en Agua',
    descripcion: 'Jugo natural de mora, maracuyá o lulo (400ml).',
    precio: 5000,
    imagenUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400',
  },
  {
    id: 3,
    nombre: 'Combo Almuerzo Ejecutivo',
    descripcion: 'Proteína, arroz, ensalada, principio del día y sobremesa.',
    precio: 14500,
    imagenUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  },
];

export function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@upb.edu.co' && password === 'admin123') {
      setAutenticado(true);
      setError('');
    } else {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f8', minHeight: '100vh', padding: '20px' }}>
      {!autenticado ? (
        /* --- PANTALLA DE LOGIN --- */
        <div style={{ maxWidth: '360px', margin: '80px auto', padding: '30px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign: 'center', color: '#333' }}>Iniciar Sesión</h2>
          {error && <p style={{ color: 'red', textAlign: 'center', fontSize: '0.9rem' }}>{error}</p>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Correo Institucional:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@upb.edu.co"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Contraseña:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={!email || !password}
              style={{
                backgroundColor: email && password ? '#007bff' : '#ccc',
                color: '#fff',
                padding: '10px',
                border: 'none',
                borderRadius: '4px',
                cursor: email && password ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
              }}
            >
              Ingresar al Panel
            </button>
          </form>
        </div>
      ) : (
        /* --- CATÁLOGO DE PRODUCTOS (CARDPRODUCTO) --- */
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1>Menú UPB Food</h1>
            <button
              onClick={() => setAutenticado(false)}
              style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cerrar Sesión
            </button>
          </header>

          <main style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {PRODUCTOS_DE_PRUEBA.map((prod) => (
              <CardProducto
                key={prod.id}
                producto={prod}
                onAgregar={(p) => alert(`Agregado: ${p.nombre}`)}
              />
            ))}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;

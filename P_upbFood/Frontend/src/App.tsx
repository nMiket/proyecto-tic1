import React, { useState } from 'react';
import { CardProducto } from './components/CardProducto';
import type { Producto } from './types/Producto';

const PRODUCTOS_CATALOGO: Producto[] = [
  {
    id: 1,
    nombre: 'Empanada de Carne',
    descripcion: 'Deliciosa empanada crujiente llena de carne desmechada y papa.',
    precio: 3500,
    imagenUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400',
    disponible: true
  },
  {
    id: 2,
    nombre: 'Jugo Natural en Agua',
    descripcion: 'Jugo natural de mora, maracuyá o lulo (400ml).',
    precio: 5000,
    imagenUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400',
    disponible: true
  },
  {
    id: 3,
    nombre: 'Combo Almuerzo Ejecutivo',
    descripcion: 'Proteína, arroz, ensalada, principio del día y sobremesa.',
    precio: 14500,
    imagenUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    disponible: true
  }
];

export function App() {
  const [vista, setVista] = useState<'admin' | 'publica'>('publica');
  const [autenticado, setAutenticado] = useState(false);
  const [correo, setCorreo] = useState('admin@upb.edu.co');
  const [password, setPassword] = useState('123456');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (correo.trim() && password.trim()) {
      setAutenticado(true);
    }
  };

  const handleLogout = () => {
    setAutenticado(false);
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#eef6f5', minHeight: '100vh', padding: '20px' }}>
      {/* Navegación Superior */}
      <header style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '960px', margin: '0 auto 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <h2 style={{ margin: 0, color: '#0f3d3e', fontSize: '1.2rem', fontWeight: 'bold' }}>UPB Food</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setVista('publica')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: vista === 'publica' ? '#0d7377' : '#eef4f4', color: vista === 'publica' ? '#fff' : '#2c5d5e', cursor: 'pointer', fontWeight: 500 }}
          >
            Vista pública
          </button>
          <button 
            onClick={() => setVista('admin')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: vista === 'admin' ? '#0d7377' : '#eef4f4', color: vista === 'admin' ? '#fff' : '#2c5d5e', cursor: 'pointer', fontWeight: 500 }}
          >
            Panel administrativo
          </button>
        </div>
      </header>

      {/* VISTA PÚBLICA (Catálogo de productos) */}
      {vista === 'publica' && (
        <main style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ margin: 0, color: '#0f3d3e', fontSize: '1.8rem' }}>Menú UPB Food</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {PRODUCTOS_CATALOGO.map((prod) => (
              <CardProducto 
                key={prod.id} 
                producto={prod} 
                onAgregar={(p) => alert(`Agregado al carrito: ${p.nombre}`)} 
              />
            ))}
          </div>
        </main>
      )}

      {/* VISTA PANEL ADMINISTRATIVO */}
      {vista === 'admin' && (
        <main style={{ maxWidth: '960px', margin: '0 auto' }}>
          {!autenticado ? (
            /* Formulario de Login */
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '36px', maxWidth: '480px', margin: '40px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6c757d', fontWeight: 600 }}>ADMINISTRACIÓN</span>
              <h1 style={{ margin: '8px 0 24px', color: '#0f3d3e', fontSize: '1.6rem' }}>Iniciar sesión</h1>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#2c5d5e' }}>Correo institucional</label>
                  <input 
                    type="email" 
                    value={correo} 
                    onChange={(e) => setCorreo(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#2c5d5e' }}>Contraseña</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                  />
                </div>

                <button type="submit" style={{ backgroundColor: '#0d7377', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginTop: '8px' }}>
                  Ingresar
                </button>
              </form>
            </div>
          ) : (
            /* Panel Completo de Admin tras Iniciar Sesión */
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6c757d', fontWeight: 600 }}>PANEL ADMINISTRATIVO</span>
                  <h1 style={{ margin: '4px 0 0', color: '#0f3d3e', fontSize: '1.6rem' }}>Bienvenido, {correo}</h1>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: '#c0392b', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Cerrar sesión
                </button>
              </div>

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#0d7377', color: '#fff', padding: '20px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Pedidos activos</span>
                  <h2 style={{ fontSize: '2.2rem', margin: '8px 0 4px' }}>24</h2>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>5 nuevos hoy</span>
                </div>

                <div style={{ backgroundColor: '#f2f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <span style={{ fontSize: '0.9rem', color: '#4a6572' }}>Productos</span>
                  <h2 style={{ fontSize: '2.2rem', margin: '8px 0 4px', color: '#0f3d3e' }}>{PRODUCTOS_CATALOGO.length}</h2>
                  <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>catálogo del restaurante</span>
                </div>

                <div style={{ backgroundColor: '#f2f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <span style={{ fontSize: '0.9rem', color: '#4a6572' }}>Ganancias</span>
                  <h2 style={{ fontSize: '2.2rem', margin: '8px 0 4px', color: '#0f3d3e' }}>$3.4M</h2>
                  <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>vs. $2.9M mes anterior</span>
                </div>
              </div>

              {/* Acciones Rápidas y Resumen del día */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#f8fbfb', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f3d3e', fontSize: '1.1rem' }}>Acciones rápidas</h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#2c5d5e', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.95rem' }}>
                    <li>Ver pedidos pendientes</li>
                    <li>Actualizar menú</li>
                    <li>Configurar cafeterías</li>
                    <li>Revisar métricas</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: '#f8fbfb', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f3d3e', fontSize: '1.1rem' }}>Resumen del día</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eaf2f2', paddingBottom: '8px' }}>
                      <span style={{ color: '#557571' }}>Entrega en curso</span>
                      <strong style={{ color: '#0f3d3e' }}>18</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eaf2f2', paddingBottom: '8px' }}>
                      <span style={{ color: '#557571' }}>Clientes activos</span>
                      <strong style={{ color: '#0f3d3e' }}>312</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#557571' }}>Calificación promedio</span>
                      <strong style={{ color: '#0f3d3e' }}>4.8</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulario y Catálogo actual */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ backgroundColor: '#f8fbfb', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f3d3e', fontSize: '1.1rem' }}>Gestión de productos</h3>
                  <form style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Nombre</label>
                      <input type="text" placeholder="Ej: Café Americano" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Precio</label>
                      <input type="number" placeholder="4500" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Categoría</label>
                      <input type="text" placeholder="Bebidas / Almuerzos" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                    </div>
                  </form>
                </div>

                <div style={{ backgroundColor: '#f8fbfb', padding: '20px', borderRadius: '12px', border: '1px solid #e0eded' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#0f3d3e', fontSize: '1.1rem' }}>Catálogo actual</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {PRODUCTOS_CATALOGO.map((item) => (
                      <div key={item.id} style={{ backgroundColor: '#eef6f6', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: '0 0 6px', color: '#0f3d3e' }}>{item.nombre}</h4>
                          <span style={{ fontSize: '0.8rem', color: '#2c5d5e' }}>Disponible</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#2c5d5e' }}>${item.precio.toLocaleString('es-CO')}</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button style={{ backgroundColor: '#d1f2eb', color: '#0e6251', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Editar</button>
                            <button style={{ backgroundColor: '#fadbd8', color: '#78281f', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Eliminar</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;

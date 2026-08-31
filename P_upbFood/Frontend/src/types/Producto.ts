export interface Producto {
  id: number | string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagenUrl: string;
  disponible?: boolean;
}

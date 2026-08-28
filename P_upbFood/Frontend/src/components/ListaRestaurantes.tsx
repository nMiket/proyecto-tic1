interface Restaurante {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
  tiempo_estimado_min: number;
}

function ListaRestaurantes() {
  return (
    <section>
      <h2>Restaurantes y cafeterías</h2>
    </section>
  );
}

export default ListaRestaurantes;
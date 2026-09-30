package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateOrderRequest;
import com.upbfood.Backend.entity.Client;
import com.upbfood.Backend.entity.Order;
import com.upbfood.Backend.entity.OrderDetail;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.entity.Restaurant;
import com.upbfood.Backend.repository.ClientRepository;
import com.upbfood.Backend.repository.OrderRepository;
import com.upbfood.Backend.repository.ProductRepository;
import com.upbfood.Backend.repository.RestaurantRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/pedidos")
@CrossOrigin(origins = "http://localhost:5173")
public class OrderController {
    private final OrderRepository orderRepository;
    private final ClientRepository clientRepository;
    private final ProductRepository productRepository;
    private final RestaurantRepository restaurantRepository;

    public OrderController(
            OrderRepository orderRepository,
            ClientRepository clientRepository,
            ProductRepository productRepository,
            RestaurantRepository restaurantRepository
    ) {
        this.orderRepository = orderRepository;
        this.clientRepository = clientRepository;
        this.productRepository = productRepository;
        this.restaurantRepository = restaurantRepository;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> crearPedido(@Valid @RequestBody CreateOrderRequest request) {
        Restaurant restaurant = restaurantRepository.findById(request.restauranteId())
                .orElseThrow(() -> new IllegalArgumentException("La cafetería no existe."));

        Client client = clientRepository.findByCorreo(request.clienteCorreo().trim())
                .orElseGet(Client::new);
        client.setCorreo(request.clienteCorreo().trim());
        client.setNombre(request.clienteNombre().trim());
        client.setTelefono(request.clienteTelefono().trim());
        client = clientRepository.save(client);

        Order order = new Order();
        order.setRestaurant(restaurant);
        order.setClient(client);
        order.setEstado("NUEVO");

        BigDecimal total = BigDecimal.ZERO;
        java.util.List<OrderDetail> details = new java.util.ArrayList<>();
        for (CreateOrderRequest.OrderItemRequest item : request.items()) {
            Product product = productRepository.findById(item.productoId())
                    .orElseThrow(() -> new IllegalArgumentException("Uno de los productos no existe."));
            if (!request.restauranteId().equals(product.getRestauranteId())) {
                throw new IllegalArgumentException("Todos los productos deben pertenecer a la misma cafetería.");
            }
            if (!Boolean.TRUE.equals(product.getDisponible())) {
                throw new IllegalArgumentException("El producto " + product.getNombre() + " no está disponible.");
            }

            OrderDetail detail = new OrderDetail();
            detail.setOrder(order);
            detail.setProduct(product);
            detail.setCantidad(item.cantidad());
            detail.setPrecioUnitario(product.getPrecio());
            details.add(detail);
            total = total.add(product.getPrecio().multiply(BigDecimal.valueOf(item.cantidad())));
        }

        order.setTotal(total);
        order.setDetails(details);
        Order saved = orderRepository.save(order);

        Map<String, Object> response = new HashMap<>();
        response.put("id", saved.getId());
        response.put("estado", saved.getEstado());
        response.put("total", saved.getTotal());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}/pago")
    @Transactional
    public ResponseEntity<?> pasarAPago(@PathVariable Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("El pedido no existe."));
        if (!"NUEVO".equals(order.getEstado())) {
            throw new IllegalArgumentException("El pedido ya no puede pasar a pago.");
        }

        order.setEstado("EN_PAGO");
        Order updated = orderRepository.save(order);
        Map<String, Object> response = new HashMap<>();
        response.put("id", updated.getId());
        response.put("estado", updated.getEstado());
        response.put("total", updated.getTotal());
        return ResponseEntity.ok(response);
    }
}
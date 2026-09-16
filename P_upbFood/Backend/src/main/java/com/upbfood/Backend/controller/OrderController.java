package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateOrderRequest;
import com.upbfood.Backend.dto.CreateOrderItemRequest;
import com.upbfood.Backend.entity.*;
import com.upbfood.Backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/pedidos")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private RestaurantRepository restaurantRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ProductRepository productRepository;

    @GetMapping("/cocina")
    public ResponseEntity<List<Order>> getKitchenOrders(@RequestParam(required = false) Long restauranteId) {
        List<Order> orders;
        if (restauranteId != null) {
            orders = orderRepository.findActiveOrdersByRestaurant(restauranteId);
        } else {
            orders = orderRepository.findAllActiveOrders();
        }
        return ResponseEntity.ok(orders);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createOrder(@RequestBody CreateOrderRequest request) {
        Optional<Restaurant> restOpt = restaurantRepository.findById(request.getRestauranteId());
        if (restOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Restaurante no encontrado"));
        }

        // Buscar o crear cliente
        Client client = clientRepository.findByCorreo(request.getClienteCorreo()).orElseGet(() -> {
            Client newClient = new Client();
            newClient.setCorreo(request.getClienteCorreo());
            newClient.setNombre(request.getClienteNombre());
            newClient.setTelefono(request.getClienteTelefono());
            return clientRepository.save(newClient);
        });

        Order order = new Order();
        order.setRestaurant(restOpt.get());
        order.setClient(client);
        order.setEstado("NUEVO");
        
        List<OrderDetail> details = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (CreateOrderItemRequest itemReq : request.getItems()) {
            Optional<Product> pOpt = productRepository.findById(itemReq.getProductoId());
            if (pOpt.isPresent()) {
                Product p = pOpt.get();
                OrderDetail detail = new OrderDetail();
                detail.setOrder(order);
                detail.setProduct(p);
                detail.setCantidad(itemReq.getCantidad());
                detail.setPrecioUnitario(p.getPrecio());
                details.add(detail);
                
                total = total.add(p.getPrecio().multiply(BigDecimal.valueOf(itemReq.getCantidad())));
            }
        }

        order.setTotal(total);
        order.setDetails(details);
        
        Order savedOrder = orderRepository.save(order);
        
        return ResponseEntity.ok(savedOrder);
    }

    @PutMapping("/{id}/estado")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        String nuevoEstado = body.get("estado");
        if (nuevoEstado == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falta el estado"));
        }
        Order order = orderOpt.get();
        order.setEstado(nuevoEstado);
        orderRepository.save(order);
        return ResponseEntity.ok(order);
    }
}

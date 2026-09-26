package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.Client;
import com.upbfood.Backend.repository.ClientRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clientes")
@CrossOrigin(origins = "http://localhost:5173")
public class ClientController {

    private final ClientRepository clienteRepository;

    public ClientController(ClientRepository clienteRepository) {
        this.clienteRepository = clienteRepository;
    }

    @PostMapping
    public ResponseEntity<Client> crearCliente(@RequestBody Client cliente) {
        Client nuevoCliente = clienteRepository.save(cliente);
        return ResponseEntity.ok(nuevoCliente);
    }
}
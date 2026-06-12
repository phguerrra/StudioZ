package com.studioz.backend.controller;


import com.studioz.backend.dto.LoginRequest;
import com.studioz.backend.dto.ProductDTO;
import com.studioz.backend.model.Order;
import com.studioz.backend.model.Product;
import com.studioz.backend.service.AdminSessionService;
import com.studioz.backend.service.AuthService;
import com.studioz.backend.service.OrderService;
import com.studioz.backend.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import com.studioz.backend.model.Role;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AdminController {
    private final OrderService orderService;
    private final ProductService productService;
    private final AuthService authService;
    private final AdminSessionService adminSessionService;

    @Value("${app.admin.email:admin@studioz.com}")
    private String adminEmail;

    @Value("${app.admin.password:admin123}")
    private String adminPassword;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest request) {
        String email = request.email() == null ? "" : request.email().trim().toLowerCase();
        String password = request.password() == null ? "" : request.password();
        String configuredEmail = adminEmail == null ? "" : adminEmail.trim().toLowerCase();

        Map<String, Object> admin = new HashMap<>();
        if (configuredEmail.equals(email) && adminPassword.equals(password)) {
            admin.put("email", configuredEmail);
            admin.put("role", Role.ADMIN.name());
        } else {
            var user = authService.login(request);
            if (!Role.ADMIN.name().equals(user.getRole())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciais de administrador inválidas.");
            }
            admin.put("email", user.getEmail());
            admin.put("role", user.getRole());
        }

        if (admin.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciais de administrador inválidas.");
        }

        var session = adminSessionService.create();

        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("token", session.token());
        response.put("expiresAt", session.expiresAt());
        response.put("admin", admin);
        return response;
    }

    @GetMapping("/session")
    public Map<String, Object> session(@RequestHeader("X-Admin-Token") String token) {
        requireAdminToken(token);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        return response;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestHeader("X-Admin-Token") String token) {
        requireAdminToken(token);
        adminSessionService.revoke(token);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        return response;
    }

    @GetMapping("/orders")
    public Map<String, Object> getAllOrders(
            @RequestHeader("X-Admin-Token") String token
    ) {
        requireAdminToken(token);
        List<Order> ordersService = orderService.getAllOrders();
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("orders", ordersService);
        return response;
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> updateOrderStatus(
            @RequestHeader("X-Admin-Token") String token,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        requireAdminToken(token);
        String status = body.get("status");
        Order updatedOrder = orderService.updateStatus(id, status);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("order", updatedOrder);
        return response;
    }

    @DeleteMapping("/orders/{id}")
    public Map<String, Object> deleteOrder(
            @RequestHeader("X-Admin-Token") String token,
            @PathVariable Long id
    ) {
        requireAdminToken(token);
        orderService.delete(id);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        return response;
    }

    @GetMapping("/prices")
    public Map<String, Object> getPrices(@RequestHeader("X-Admin-Token") String token) {
        requireAdminToken(token);
        List<Product> products = productService.getAllProducts();
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("prices", products);
        return response;
    }

    @PutMapping("/prices/{productKey}")
    public Map<String, Object> updatePrice(
            @RequestHeader("X-Admin-Token") String token,
            @PathVariable String productKey,
            @RequestBody ProductDTO dto
    ) {
        requireAdminToken(token);
        Double basePrice = dto.basePrice;
        if (basePrice == null || basePrice < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preço base inválido.");
        }
        String productName = dto.productName == null || dto.productName.isBlank() ? productKey : dto.productName;
        ProductDTO updatedDto = new ProductDTO();
        updatedDto.productKey = productKey;
        updatedDto.productName = productName;
        updatedDto.basePrice = basePrice;
        Product product = productService.upsert(updatedDto);

        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("price", product);
        return response;
    }

    private void requireAdminToken(String token) {
        if (!adminSessionService.isValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Acesso administrativo não autorizado.");
        }
    }
}

package com.studioz.backend.controller;

import com.studioz.backend.model.Order;
import com.studioz.backend.repository.UserRepository;
import com.studioz.backend.service.ContactService;
import com.studioz.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import com.studioz.backend.model.Role;
import com.studioz.backend.model.User;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.studioz.backend.dto.UpdatePriceDTO;
import com.studioz.backend.model.Product;
import com.studioz.backend.service.ProductService;
import com.studioz.backend.dto.UpdateOrderDTO;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AdminController {
    private final OrderService orderService;
    private final UserRepository userRepository;
    private final ContactService contactService;
    private final ProductService productService;

    @GetMapping("/orders")
    public Map<String, Object> getAllOrders(
            @RequestHeader("X-User-Email") String email
    ) {
        //validateAdmin(email);
        List<Order> ordersService = orderService.getAllOrders();
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("orders", ordersService);
        return response;
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> updateOrderStatus(
            @RequestHeader("X-User-Email") String email,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        String status = body.get("status");
        Order updatedOrder = orderService.updateStatus(id, status);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("order", updatedOrder);
        return response;
    }

    private void validateAdmin(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));
        if (user.getRole() != Role.ADMIN) {
            throw new RuntimeException("Acesso negado");
        }
    }

    @GetMapping("/stats")
    public Map<String, Object> getStats(
            @RequestHeader("X-User-Email") String email
    ) {

        validateAdmin(email);

        Map<String, Object> stats =
                orderService.getStats();

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);

        response.putAll(stats);

        return response;
    }

    @GetMapping("/contacts")
    public Map<String, Object> getContacts(
            @RequestHeader("X-User-Email") String email
    ) {
        validateAdmin(email);
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("contacts",
                contactService.getAllContacts());
        return response;
    }

    @GetMapping("/prices")
    public Map<String, Object> getPrices(
            @RequestHeader("X-User-Email") String email
    ) {

        validateAdmin(email);

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put(
                "prices",
                productService.getAllProducts()
        );

        return response;
    }

    @PutMapping("/prices/{productKey}")
    public Map<String, Object> updatePrice(
            @RequestHeader("X-User-Email") String email,
            @PathVariable String productKey,
            @RequestBody UpdatePriceDTO dto
    ) {

        validateAdmin(email);

        Product product = productService.updatePrice(
                        productKey,
                        dto.getBasePrice()
                );

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("price", product);

        return response;
    }

    @GetMapping("/orders/{id}")
    public Map<String, Object> getOrderById(
            @RequestHeader("X-User-Email") String email,
            @PathVariable Long id
    ) {

        validateAdmin(email);

        Order order =
                orderService.getOrderById(id);

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("order", order);

        return response;
    }

    @PatchMapping("/orders/{id}")
    public Map<String, Object> updateOrder(
            @RequestHeader("X-User-Email") String email,
            @PathVariable Long id,
            @RequestBody UpdateOrderDTO dto
    ) {

        validateAdmin(email);

        Order updatedOrder =
                orderService.updateOrder(
                        id,
                        dto.getPrice(),
                        dto.getStatus()
                );

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("order", updatedOrder);

        return response;
    }

}
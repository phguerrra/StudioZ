package com.studioz.backend.controller;


import com.studioz.backend.model.Order;
import com.studioz.backend.repository.UserRepository;
import com.studioz.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import com.studioz.backend.model.Role;
import com.studioz.backend.model.User;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AdminController {
    private final OrderService orderService;
    private final UserRepository userRepository;

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


}

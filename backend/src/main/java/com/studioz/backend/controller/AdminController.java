package com.studioz.backend.controller;


import com.studioz.backend.model.Order;
import com.studioz.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AdminController {
    private final OrderService orderService;

    @GetMapping("/orders")
    public Map<String, Object> getAllOrders() {
        List<Order> ordersService = orderService.getAllOrders();
        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);
        response.put("orders", ordersService);
        return response;
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> updateOrderStatus(
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
}

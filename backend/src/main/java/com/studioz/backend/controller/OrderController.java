package com.studioz.backend.controller;

import com.studioz.backend.dto.OrderDTO;
import com.studioz.backend.model.Order;
import com.studioz.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@CrossOrigin("*")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public Map<String, Object> createOrder(
            @RequestBody OrderDTO dto
    ) {

        Order savedOrder = orderService.create(dto);

        Map<String, Object> response = new HashMap<>();

        response.put("ok", true);
        response.put("order", savedOrder);

        return response;
    }

    @GetMapping
    public Map<String, Object> getOrdersByEmail(
            @RequestParam String email
    ) {

        List<Order> orders =
                orderService.getOrdersByEmail(email);

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("orders", orders);

        return response;
    }
}
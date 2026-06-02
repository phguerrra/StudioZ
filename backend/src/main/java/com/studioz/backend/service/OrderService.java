package com.studioz.backend.service;


import com.studioz.backend.dto.OrderDTO;
import com.studioz.backend.model.Order;
import com.studioz.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;

    public Order create(OrderDTO dto) {
        Order order = new Order();
        order.setUserEmail(dto.userEmail);
        order.setUserName(dto.userName);

        order.setProductKey(dto.productKey);
        order.setProductName(dto.productName);

        order.setDiameter(dto.diameter);
        order.setHeight(dto.height);

        order.setColor(dto.color);
        order.setText(dto.text);
        order.setFont(dto.font);
        order.setPosition(dto.position);

        order.setImageDataUrl(dto.imageDataUrl);

        order.setPrice(dto.price);

        order.setStatus("EM_ANALISE");

        return orderRepository.save(order);

    }

    public List<Order> getOrdersByEmail(String email) {
        return orderRepository.findByUserEmailOrderByCreatedAtDesc(email);
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public Order updateStatus(Long id, String status) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Pedido não encontrado"));
        order.setStatus(status);
        return orderRepository.save(order);
    }

    public Map<String, Object> getStats() {

        List<Order> orders = orderRepository.findAll();

        long totalOrders = orders.size();

        long pendingOrders =
                orderRepository.countByStatus("EM_ANALISE");

        long completedOrders =
                orderRepository.countByStatus("FINALIZADO");

        double totalRevenue = orders.stream()
                .mapToDouble(order ->
                        order.getPrice() != null
                                ? order.getPrice()
                                : 0
                )
                .sum();

        Map<String, Object> stats =
                new HashMap<>();

        stats.put("totalOrders", totalOrders);
        stats.put("pendingOrders", pendingOrders);
        stats.put("completedOrders", completedOrders);
        stats.put("totalRevenue", totalRevenue);

        return stats;
    }
}

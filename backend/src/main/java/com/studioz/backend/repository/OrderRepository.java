package com.studioz.backend.repository;

import com.studioz.backend.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserEmailOrderByCreatedAtDesc(String email);
    long countByStatus(String status);
}
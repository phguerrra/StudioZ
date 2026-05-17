package com.studioz.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String productKey;

    private String productName;

    private Double basePrice;

    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    public void updateTimestamp() {
        updatedAt = Instant.now();
    }
}
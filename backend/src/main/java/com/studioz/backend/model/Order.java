package com.studioz.backend.model;

import jakarta.persistence.*;

import java.util.Date;

@Entity
@Table(name = "orders")
public class Order {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private long id;
        @ManyToOne
        private User user;
        @ManyToOne
        private Product product;
        private int quantity;
        private double totalPrice;
        private String custonText;
        private Date orderDate;
        private String status;
}

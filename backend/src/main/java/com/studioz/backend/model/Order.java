package com.studioz.backend.model;

import java.util.Date;

public class Order {
        private long id;
        private User user;
        private Product product;
        private int quantity;
        private double totalPrice;
        private String custonText;
        private Date orderDate;
        private String status;
}

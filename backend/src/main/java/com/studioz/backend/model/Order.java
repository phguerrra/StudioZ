package com.studioz.backend.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Date;

@Entity
@Table(name="orders")
public class Order {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;
        private String userEmail;
        private String userName;
        private String productKey;
        private String productName;
        private Double diameter;
        private Double height;
        @Column(length = 50)
        private String color;
        @Lob
        private String text;
        @Column(length = 100)
        private String font;
        @Column(length = 20)
        private String position;
        @Lob
        private String imageDataUrl; // or path to image
        private Double price;
        private String status;
        private Instant createdAt;

        public Long getId() {
                return id;
        }

        public void setId(Long id) {
                this.id = id;
        }

        public String getUserName() {
                return userName;
        }

        public void setUserName(String userName) {
                this.userName = userName;
        }

        public String getUserEmail() {
                return userEmail;
        }

        public void setUserEmail(String userEmail) {
                this.userEmail = userEmail;
        }

        public String getProductKey() {
                return productKey;
        }

        public void setProductKey(String productKey) {
                this.productKey = productKey;
        }

        public String getProductName() {
                return productName;
        }

        public void setProductName(String productName) {
                this.productName = productName;
        }

        public Double getDiameter() {
                return diameter;
        }

        public void setDiameter(Double diameter) {
                this.diameter = diameter;
        }

        public Double getHeight() {
                return height;
        }

        public void setHeight(Double height) {
                this.height = height;
        }

        public String getColor() {
                return color;
        }

        public void setColor(String color) {
                this.color = color;
        }

        public String getText() {
                return text;
        }

        public void setText(String text) {
                this.text = text;
        }

        public String getFont() {
                return font;
        }

        public void setFont(String font) {
                this.font = font;
        }

        public String getPosition() {
                return position;
        }

        public void setPosition(String position) {
                this.position = position;
        }

        public String getImageDataUrl() {
                return imageDataUrl;
        }

        public void setImageDataUrl(String imageDataUrl) {
                this.imageDataUrl = imageDataUrl;
        }

        public Double getPrice() {
                return price;
        }

        public void setPrice(Double price) {
                this.price = price;
        }

        public String getStatus() {
                return status;
        }

        public void setStatus(String status) {
                this.status = status;
        }

        public Instant getCreatedAt() {
                return createdAt;
        }

        public void setCreatedAt(Instant createdAt) {
                this.createdAt = createdAt;
        }
}
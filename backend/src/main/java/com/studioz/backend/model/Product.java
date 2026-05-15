package com.studioz.backend.model;

import jakarta.persistence.Entity;

import java.awt.*;

@Entity
public class Product {
    private long id;
    private String name;
    private String description;
    private double basePrice;
    private Image image;



}

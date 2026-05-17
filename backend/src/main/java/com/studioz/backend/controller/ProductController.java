package com.studioz.backend.controller;

import com.studioz.backend.dto.ProductDTO;
import com.studioz.backend.model.Product;
import com.studioz.backend.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prices")
@RequiredArgsConstructor
@CrossOrigin("*")
public class ProductController {

    private final ProductService productService;

    @PostMapping
    public Map<String, Object> createProduct(
            @RequestBody ProductDTO dto
    ) {

        Product product = productService.create(dto);

        Map<String, Object> response = new HashMap<>();

        response.put("ok", true);
        response.put("product", product);

        return response;
    }

    @GetMapping
    public Map<String, Object> getProducts() {

        List<Product> products =
                productService.getAllProducts();

        Map<String, Object> response =
                new HashMap<>();

        response.put("ok", true);
        response.put("prices", products);

        return response;
    }
}
package com.studioz.backend.service;

import com.studioz.backend.dto.ProductDTO;
import com.studioz.backend.model.Product;
import com.studioz.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    public Product create(ProductDTO dto) {
        Product product = new Product();
        product.setProductKey(dto.productKey);
        product.setProductName(dto.productName);
        product.setBasePrice(dto.basePrice);

        return productRepository.save(product);
    }

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }
}
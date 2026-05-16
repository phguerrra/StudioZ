package com.studioz.backend.dto;

public record LoginRequest(
        String email,
        String password
) {
}
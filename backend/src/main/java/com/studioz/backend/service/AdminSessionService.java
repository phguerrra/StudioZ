package com.studioz.backend.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminSessionService {
    private static final long TOKEN_TTL_SECONDS = 60L * 60L * 8L;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, Instant> tokens = new ConcurrentHashMap<>();

    public Session create() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = "adm_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = Instant.now().plusSeconds(TOKEN_TTL_SECONDS);
        tokens.put(token, expiresAt);
        return new Session(token, expiresAt.toEpochMilli());
    }

    public boolean isValid(String token) {
        if (token == null || token.isBlank()) return false;
        Instant expiresAt = tokens.get(token);
        if (expiresAt == null) return false;
        if (expiresAt.isBefore(Instant.now())) {
            tokens.remove(token);
            return false;
        }
        return true;
    }

    public void revoke(String token) {
        if (token != null) tokens.remove(token);
    }

    public record Session(String token, long expiresAt) {
    }
}

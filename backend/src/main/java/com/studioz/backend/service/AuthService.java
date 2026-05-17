package com.studioz.backend.service;

import com.studioz.backend.dto.LoginRequest;
import com.studioz.backend.dto.RegisterRequest;
import com.studioz.backend.model.User;
import com.studioz.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;

    public User register(RegisterRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("E-mail já cadastrado");
        }
        User user = new User();
        user.setEmail(request.email());
        user.setPassword(request.password());
        return userRepository.save(user);
    }

    public User login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("E-mail ou senha incorretos"));

        if (!user.getPassword().equals(request.password())) {
            throw new RuntimeException("E-mail ou senha incorretos");
        }

        return user;
    }
}

package com.studioz.backend.controller;

import com.studioz.backend.dto.LoginRequest;
import com.studioz.backend.dto.RegisterRequest;
import com.studioz.backend.dto.UserDTO;
import com.studioz.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public UserDTO register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public UserDTO login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
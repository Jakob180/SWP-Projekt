package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.auth.AuthRequest;
import com.Budeget_Tracker.demo.dto.auth.AuthResponse;
import com.Budeget_Tracker.demo.dto.auth.MessageResponse;
import com.Budeget_Tracker.demo.dto.auth.PasswordCodeRequest;
import com.Budeget_Tracker.demo.dto.auth.PasswordResetConfirmRequest;
import com.Budeget_Tracker.demo.dto.auth.RegisterConfirmRequest;
import com.Budeget_Tracker.demo.dto.auth.RegisterRequest;
import com.Budeget_Tracker.demo.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register/request-code")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse requestRegisterCode(@Valid @RequestBody RegisterRequest request) {
        return authService.requestRegistrationCode(request);
    }

    @PostMapping("/register/confirm")
    public AuthResponse confirmRegister(@Valid @RequestBody RegisterConfirmRequest request) {
        return authService.confirmRegistration(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequest request) {
        return authService.login(request);
    }

    @PostMapping("/password/request-code")
    public MessageResponse requestPasswordCode(@Valid @RequestBody PasswordCodeRequest request) {
        return authService.requestPasswordResetCode(request);
    }

    @PostMapping("/password/confirm")
    public MessageResponse confirmPassword(@Valid @RequestBody PasswordResetConfirmRequest request) {
        return authService.confirmPasswordReset(request);
    }
}

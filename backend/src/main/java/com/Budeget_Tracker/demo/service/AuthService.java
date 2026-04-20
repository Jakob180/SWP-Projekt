package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.auth.AuthRequest;
import com.Budeget_Tracker.demo.dto.auth.AuthResponse;
import com.Budeget_Tracker.demo.dto.auth.MessageResponse;
import com.Budeget_Tracker.demo.dto.auth.PasswordCodeRequest;
import com.Budeget_Tracker.demo.dto.auth.PasswordResetConfirmRequest;
import com.Budeget_Tracker.demo.dto.auth.RegisterConfirmRequest;
import com.Budeget_Tracker.demo.dto.auth.RegisterRequest;
import com.Budeget_Tracker.demo.model.AppUser;
import com.Budeget_Tracker.demo.model.UserLoginProfile;
import com.Budeget_Tracker.demo.repository.UserLoginProfileRepository;
import com.Budeget_Tracker.demo.repository.UserRepository;
import com.Budeget_Tracker.demo.security.JwtService;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserLoginProfileRepository userLoginProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final EmailVerificationService emailVerificationService;

    public AuthService(
            UserRepository userRepository,
            UserLoginProfileRepository userLoginProfileRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            EmailVerificationService emailVerificationService
    ) {
        this.userRepository = userRepository;
        this.userLoginProfileRepository = userLoginProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.emailVerificationService = emailVerificationService;
    }

    public MessageResponse requestRegistrationCode(RegisterRequest request) {
        String username = normalizeUsername(request.username());
        String email = normalizeEmail(request.email());

        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is already taken");
        }
        if (userLoginProfileRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already in use");
        }

        String passwordHash = passwordEncoder.encode(request.password());
        emailVerificationService.requestRegistrationCode(username, email, passwordHash);

        return new MessageResponse("Verification code sent");
    }

    public AuthResponse confirmRegistration(RegisterConfirmRequest request) {
        String email = normalizeEmail(request.email());
        EmailVerificationService.PendingRegistration pending = emailVerificationService.confirmRegistration(email, request.code().trim());

        if (userRepository.existsByUsername(pending.username())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is already taken");
        }
        if (userLoginProfileRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already in use");
        }

        AppUser user = new AppUser();
        user.setUsername(pending.username());
        user.setEmail(pending.email());
        user.setPassword(pending.passwordHash());

        AppUser savedUser = userRepository.save(user);
        UserLoginProfile profile = new UserLoginProfile();
        profile.setUsername(savedUser.getUsername());
        profile.setEmail(pending.email());
        userLoginProfileRepository.save(profile);
        return buildAuthResponse(savedUser);
    }

    public AuthResponse login(AuthRequest request) {
        String identifier = request.identifier().trim();
        UserLoginProfile profile = resolveLoginProfile(identifier);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(profile.getUsername(), request.password())
            );
        } catch (BadCredentialsException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username, email or password");
        }

        AppUser user = userRepository.findByUsername(profile.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username, email or password"));
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            user.setEmail(profile.getEmail());
            userRepository.save(user);
        }

        return buildAuthResponse(user);
    }

    private UserLoginProfile resolveLoginProfile(String identifier) {
        if (identifier.contains("@")) {
            return userLoginProfileRepository.findByEmailIgnoreCase(normalizeEmail(identifier))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username, email or password"));
        }

        return userLoginProfileRepository.findByUsername(normalizeUsername(identifier))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username, email or password"));
    }

    public MessageResponse requestPasswordResetCode(PasswordCodeRequest request) {
        String email = normalizeEmail(request.email());
        UserLoginProfile profile = userLoginProfileRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No account found for this email"));

        emailVerificationService.requestPasswordResetCode(profile.getEmail());
        return new MessageResponse("Verification code sent");
    }

    public MessageResponse confirmPasswordReset(PasswordResetConfirmRequest request) {
        String email = normalizeEmail(request.email());
        UserLoginProfile profile = userLoginProfileRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No account found for this email"));

        AppUser user = userRepository.findByUsername(profile.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No account found for this email"));

        emailVerificationService.validatePasswordResetCode(profile.getEmail(), request.code().trim());
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        emailVerificationService.clearPasswordResetCode(profile.getEmail());

        return new MessageResponse("Password updated");
    }

    private AuthResponse buildAuthResponse(AppUser user) {
        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getUsername(), token);
    }

    private String normalizeUsername(String username) {
        return username.trim();
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}

package com.Budeget_Tracker.demo.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordCodeRequest(
        @NotBlank @Email @Size(max = 255) String email
) {
}

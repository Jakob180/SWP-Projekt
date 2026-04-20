package com.Budeget_Tracker.demo.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRequest(
        @NotBlank @Size(min = 3, max = 255) String identifier,
        @NotBlank @Size(min = 6, max = 120) String password
) {
}

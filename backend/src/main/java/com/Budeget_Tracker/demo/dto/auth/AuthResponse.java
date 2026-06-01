package com.Budeget_Tracker.demo.dto.auth;

import com.Budeget_Tracker.demo.model.UserRole;

public record AuthResponse(Long userId, String username, UserRole role, String token) {
}

package com.Budeget_Tracker.demo.dto.admin;

import com.Budeget_Tracker.demo.model.UserRole;

public record AdminUserResponse(
        Long id,
        String username,
        String email,
        UserRole role
) {
}

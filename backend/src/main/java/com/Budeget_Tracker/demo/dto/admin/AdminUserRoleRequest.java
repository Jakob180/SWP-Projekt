package com.Budeget_Tracker.demo.dto.admin;

import com.Budeget_Tracker.demo.model.UserRole;
import jakarta.validation.constraints.NotNull;

public record AdminUserRoleRequest(
        @NotNull UserRole role
) {
}

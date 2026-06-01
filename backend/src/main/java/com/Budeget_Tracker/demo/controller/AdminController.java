package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.admin.AdminUserResponse;
import com.Budeget_Tracker.demo.dto.admin.AdminUserRoleRequest;
import com.Budeget_Tracker.demo.security.CurrentUserProvider;
import com.Budeget_Tracker.demo.service.AdminService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final CurrentUserProvider currentUserProvider;

    public AdminController(AdminService adminService, CurrentUserProvider currentUserProvider) {
        this.adminService = adminService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/users")
    public List<AdminUserResponse> listUsers() {
        return adminService.listUsers();
    }

    @PatchMapping("/users/{userId}/role")
    public AdminUserResponse updateUserRole(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUserRoleRequest request
    ) {
        return adminService.updateUserRole(currentUserProvider.getCurrentUserId(), userId, request.role());
    }

    @DeleteMapping("/users/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long userId) {
        adminService.deleteUser(currentUserProvider.getCurrentUserId(), userId);
    }
}

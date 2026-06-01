package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.admin.AdminUserResponse;
import com.Budeget_Tracker.demo.model.AppUser;
import com.Budeget_Tracker.demo.model.UserRole;
import com.Budeget_Tracker.demo.repository.AssetRepository;
import com.Budeget_Tracker.demo.repository.EmailVerificationCodeRepository;
import com.Budeget_Tracker.demo.repository.FinanceTransactionRepository;
import com.Budeget_Tracker.demo.repository.SubscriptionRepository;
import com.Budeget_Tracker.demo.repository.UserLoginProfileRepository;
import com.Budeget_Tracker.demo.repository.UserRepository;
import jakarta.transaction.Transactional;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {

    private final AssetRepository assetRepository;
    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final FinanceTransactionRepository transactionRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserLoginProfileRepository userLoginProfileRepository;
    private final UserRepository userRepository;

    public AdminService(
            AssetRepository assetRepository,
            EmailVerificationCodeRepository emailVerificationCodeRepository,
            FinanceTransactionRepository transactionRepository,
            SubscriptionRepository subscriptionRepository,
            UserLoginProfileRepository userLoginProfileRepository,
            UserRepository userRepository
    ) {
        this.assetRepository = assetRepository;
        this.emailVerificationCodeRepository = emailVerificationCodeRepository;
        this.transactionRepository = transactionRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.userLoginProfileRepository = userLoginProfileRepository;
        this.userRepository = userRepository;
    }

    public List<AdminUserResponse> listUsers() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(AppUser::getUsername, String.CASE_INSENSITIVE_ORDER))
                .map(this::toResponse)
                .toList();
    }

    public AdminUserResponse updateUserRole(Long currentUserId, Long userId, UserRole role) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getId().equals(currentUserId) && role != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admins cannot remove their own admin role");
        }

        user.setRole(role);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long currentUserId, Long userId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admins cannot delete their own account");
        }

        transactionRepository.deleteByUserId(userId);
        subscriptionRepository.deleteByUserId(userId);
        assetRepository.deleteByUserId(userId);

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            emailVerificationCodeRepository.deleteByEmail(user.getEmail());
        }

        userLoginProfileRepository.deleteByUsername(user.getUsername());
        userRepository.delete(user);
    }

    private AdminUserResponse toResponse(AppUser user) {
        return new AdminUserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole()
        );
    }
}

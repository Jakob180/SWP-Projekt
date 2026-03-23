package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.finance.AssetRequest;
import com.Budeget_Tracker.demo.dto.finance.AssetResponse;
import com.Budeget_Tracker.demo.security.CurrentUserProvider;
import com.Budeget_Tracker.demo.service.AssetService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService assetService;
    private final CurrentUserProvider currentUserProvider;

    public AssetController(AssetService assetService, CurrentUserProvider currentUserProvider) {
        this.assetService = assetService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public List<AssetResponse> getAssets() {
        Long userId = currentUserProvider.getCurrentUserId();
        return assetService.findAssets(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AssetResponse createAsset(@Valid @RequestBody AssetRequest request) {
        Long userId = currentUserProvider.getCurrentUserId();
        return assetService.createAsset(userId, request);
    }

    @PutMapping("/{assetId}")
    public AssetResponse updateAsset(@PathVariable Long assetId, @Valid @RequestBody AssetRequest request) {
        Long userId = currentUserProvider.getCurrentUserId();
        return assetService.updateAsset(userId, assetId, request);
    }

    @DeleteMapping("/{assetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAsset(@PathVariable Long assetId) {
        Long userId = currentUserProvider.getCurrentUserId();
        assetService.deleteAsset(userId, assetId);
    }
}

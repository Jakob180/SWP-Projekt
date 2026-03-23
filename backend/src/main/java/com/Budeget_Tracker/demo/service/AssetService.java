package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.finance.AssetRequest;
import com.Budeget_Tracker.demo.dto.finance.AssetResponse;
import com.Budeget_Tracker.demo.model.Asset;
import com.Budeget_Tracker.demo.repository.AssetRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AssetService {

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    public List<AssetResponse> findAssets(Long userId) {
        return assetRepository.findByUserIdOrderByNameAsc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public AssetResponse createAsset(Long userId, AssetRequest request) {
        Asset asset = new Asset();
        asset.setUserId(userId);
        applyRequestToEntity(asset, request);
        return toResponse(assetRepository.save(asset));
    }

    public AssetResponse updateAsset(Long userId, Long assetId, AssetRequest request) {
        Asset asset = assetRepository.findByIdAndUserId(assetId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found"));

        applyRequestToEntity(asset, request);
        return toResponse(assetRepository.save(asset));
    }

    public void deleteAsset(Long userId, Long assetId) {
        Asset asset = assetRepository.findByIdAndUserId(assetId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found"));

        assetRepository.delete(asset);
    }

    private void applyRequestToEntity(Asset entity, AssetRequest request) {
        entity.setName(request.name().trim());
        entity.setValue(request.value());
    }

    private AssetResponse toResponse(Asset asset) {
        return new AssetResponse(asset.getId(), asset.getName(), asset.getValue());
    }
}

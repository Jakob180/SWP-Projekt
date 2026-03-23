package com.Budeget_Tracker.demo.repository;

import com.Budeget_Tracker.demo.model.Asset;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetRepository extends JpaRepository<Asset, Long> {
    List<Asset> findByUserIdOrderByNameAsc(Long userId);

    Optional<Asset> findByIdAndUserId(Long id, Long userId);
}

package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.finance.FileImportResponse;
import com.Budeget_Tracker.demo.security.CurrentUserProvider;
import com.Budeget_Tracker.demo.service.FileImportService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/import")
public class FileImportController {

    private final FileImportService fileImportService;
    private final CurrentUserProvider currentUserProvider;

    public FileImportController(FileImportService fileImportService, CurrentUserProvider currentUserProvider) {
        this.fileImportService = fileImportService;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping(value = "/transactions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FileImportResponse importTransactions(@RequestParam("file") MultipartFile file) {
        Long userId = currentUserProvider.getCurrentUserId();
        return fileImportService.importTransactions(userId, file);
    }
}

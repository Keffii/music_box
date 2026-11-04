package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.MediaStorage;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/** Uploads files into the local music folder (under uploads/). */
@RestController
@RequestMapping("/api/files")
public class FileUploadController {

    private final MediaStorage storage;

    public FileUploadController(MediaStorage storage) {
        this.storage = storage;
    }

    @PostMapping("/upload/music")
    public ResponseEntity<Map<String, String>> uploadMusicFile(@RequestParam("file") MultipartFile file) {
        return upload(file, "audio/", "music");
    }

    @PostMapping("/upload/cover")
    public ResponseEntity<Map<String, String>> uploadCoverFile(@RequestParam("file") MultipartFile file) {
        return upload(file, "image/", "covers");
    }

    private ResponseEntity<Map<String, String>> upload(MultipartFile file, String typePrefix, String folder) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith(typePrefix)) {
            return ResponseEntity.badRequest().body(Map.of("error", "File must be " + typePrefix + "*"));
        }
        try {
            String url = storage.save(file, folder);
            return ResponseEntity.ok(Map.of("url", url, "message", "File uploaded successfully"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save file"));
        }
    }

    @DeleteMapping("/delete")
    public ResponseEntity<Map<String, String>> deleteFile(@RequestParam("fileUrl") String fileUrl) {
        try {
            return storage.deleteUpload(fileUrl)
                    ? ResponseEntity.ok(Map.of("message", "File deleted successfully"))
                    : ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "No such uploaded file"));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete file"));
        }
    }
}

package com.example.media_controller_iot.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Stores music and cover files on local disk under one root folder, served at {@code /media/**}.
 * Uploads go to {@code uploads/} inside the root so they never overwrite the imported library.
 */
@Service
public class MediaStorage {

    public static final String URL_PREFIX = "/media/";
    private static final String UPLOAD_DIR = "uploads";

    private final Path root;

    public MediaStorage(@Value("${app.media.dir}") String mediaDir) {
        this.root = Paths.get(mediaDir).toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    /** Public URL for a file under the root, e.g. {@code /media/covers/better%20day.jpg}. */
    public String urlFor(Path file) {
        Path relative = root.relativize(file.toAbsolutePath().normalize());
        String encoded = StreamSupport.stream(relative.spliterator(), false)
                .map(part -> UriUtils.encodePathSegment(part.toString(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("/"));
        return URL_PREFIX + encoded;
    }

    /** Maps a {@code /media/...} URL back to a file inside the root, rejecting anything outside it. */
    public Optional<Path> fileFor(String url) {
        if (url == null || !url.startsWith(URL_PREFIX)) return Optional.empty();
        String decoded = UriUtils.decode(url.substring(URL_PREFIX.length()), StandardCharsets.UTF_8);
        Path file = root.resolve(decoded).normalize();
        return file.startsWith(root) ? Optional.of(file) : Optional.empty();
    }

    /** Saves an upload as {@code uploads/<folder>/<uuid>-<sanitized name>} and returns its URL. */
    public String save(MultipartFile file, String folder) throws IOException {
        Path dir = root.resolve(UPLOAD_DIR).resolve(folder).normalize();
        if (!dir.startsWith(root)) throw new IOException("Invalid folder");
        Files.createDirectories(dir);

        Path target = dir.resolve(UUID.randomUUID() + "-" + sanitize(file.getOriginalFilename()));
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target);
        }
        return urlFor(target);
    }

    /** Deletes an uploaded file. Files outside {@code uploads/} (the imported library) are left alone. */
    public boolean deleteUpload(String url) throws IOException {
        Optional<Path> file = fileFor(url);
        if (file.isEmpty() || !file.get().startsWith(root.resolve(UPLOAD_DIR))) return false;
        return Files.deleteIfExists(file.get());
    }

    static String sanitize(String name) {
        if (name == null || name.isBlank()) return "file.bin";
        String base = Paths.get(name).getFileName().toString();
        String clean = base.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("-+", "-").toLowerCase(Locale.ROOT);
        return clean.isBlank() || clean.startsWith(".") ? "file" + clean : clean;
    }
}

package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.SongsRepo;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Stream;

/**
 * Imports the music folder into the songs table on startup.
 *
 * <p>Tracks listed in {@code tracks.json} get their title, artist and category from there. A
 * listed track is matched to an audio file by its {@code file} name, or by its Pixabay id appearing
 * in the file name (Pixabay downloads are named like {@code artist-title-186374.mp3}). Any other
 * audio file in the folder is imported with a title taken from its file name. Existing songs are
 * updated in place (matched by URL), so restarting never creates duplicates.
 */
@Service
public class LibraryImporter {

    private static final Logger log = LoggerFactory.getLogger(LibraryImporter.class);
    static final Set<String> AUDIO = Set.of("mp3", "ogg", "wav", "m4a", "aac", "flac");
    private static final List<String> COVER_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");

    private final MediaStorage storage;
    private final SongsRepo songsRepo;
    private final PlayerService playerService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LibraryImporter(MediaStorage storage, SongsRepo songsRepo, PlayerService playerService) {
        this.storage = storage;
        this.songsRepo = songsRepo;
        this.playerService = playerService;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TrackEntry(String file, Long pixabayId, String title, String artist,
                             String category, String cover, String source) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Catalog(List<TrackEntry> tracks) {}

    public record Result(int imported, int updated, List<String> missing) {}

    @EventListener(ApplicationReadyEvent.class)
    public void importOnStartup() {
        try {
            Result result = importLibrary();
            log.info("Music library: {} new, {} updated, {} listed tracks without a file",
                    result.imported(), result.updated(), result.missing().size());
            if (!result.missing().isEmpty()) {
                log.info("Missing tracks (see music/README.md for downloads): {}", result.missing());
            }
        } catch (IOException e) {
            log.error("Could not import the music folder {}", storage.root(), e);
        }
        playerService.refreshLibrary();
    }

    public synchronized Result importLibrary() throws IOException {
        Path root = storage.root();
        Files.createDirectories(root);

        List<Path> audioFiles = listAudio(root);
        Set<Path> claimed = new HashSet<>();
        List<String> missing = new ArrayList<>();
        int[] counts = new int[2]; // imported, updated

        for (TrackEntry entry : readCatalog(root.resolve("tracks.json"))) {
            Optional<Path> file = match(entry, audioFiles);
            if (file.isEmpty()) {
                missing.add(entry.title() != null ? entry.title() : entry.file());
                continue;
            }
            claimed.add(file.get());
            upsert(file.get(), entry.title(), entry.artist(), entry.category(), cover(root, entry.cover(), file.get()), counts);
        }

        for (Path file : audioFiles) {
            if (claimed.contains(file)) continue;
            upsert(file, titleFromFileName(file), "Unknown artist", "Other", cover(root, null, file), counts);
        }
        return new Result(counts[0], counts[1], missing);
    }

    private List<TrackEntry> readCatalog(Path catalog) throws IOException {
        if (!Files.isRegularFile(catalog)) return List.of();
        Catalog parsed = objectMapper.readValue(catalog.toFile(), Catalog.class);
        return parsed.tracks() == null ? List.of() : parsed.tracks();
    }

    private static List<Path> listAudio(Path root) throws IOException {
        try (Stream<Path> files = Files.list(root)) {
            return files.filter(Files::isRegularFile)
                    .filter(f -> AUDIO.contains(extension(f)))
                    .sorted()
                    .toList();
        }
    }

    static Optional<Path> match(TrackEntry entry, List<Path> audioFiles) {
        if (entry.file() != null) {
            for (Path f : audioFiles) {
                if (f.getFileName().toString().equalsIgnoreCase(entry.file())) return Optional.of(f);
            }
        }
        if (entry.pixabayId() != null) {
            String id = String.valueOf(entry.pixabayId());
            for (Path f : audioFiles) {
                String base = baseName(f);
                // the id as a whole token, so 8303 does not match 183031
                if (base.matches("(?:.*[^0-9])?" + id + "(?:[^0-9].*)?")) return Optional.of(f);
            }
        }
        return Optional.empty();
    }

    private String cover(Path root, String listed, Path audio) {
        if (listed != null && !listed.isBlank()) {
            Path file = root.resolve(listed).normalize();
            if (file.startsWith(root) && Files.isRegularFile(file)) return storage.urlFor(file);
        }
        for (String ext : COVER_EXTENSIONS) {
            Path sibling = audio.resolveSibling(baseName(audio) + "." + ext);
            if (Files.isRegularFile(sibling)) return storage.urlFor(sibling);
        }
        return null;
    }

    private void upsert(Path file, String title, String artist, String category, String coverUrl, int[] counts) {
        String srcUrl = storage.urlFor(file);
        Optional<Songs> existing = songsRepo.findFirstBySrcUrl(srcUrl);
        Songs song = existing.orElseGet(Songs::new);
        song.setSrcUrl(srcUrl);
        song.setTitle(title != null ? title : titleFromFileName(file));
        song.setArtist(artist != null ? artist : "Unknown artist");
        song.setCategory(category);
        song.setCoverUrl(coverUrl);
        songsRepo.save(song);
        counts[existing.isPresent() ? 1 : 0]++;
    }

    static String titleFromFileName(Path file) {
        String spaced = baseName(file).replaceAll("[-_]+", " ").replaceAll("\\s+", " ").trim();
        if (spaced.isEmpty()) return file.getFileName().toString();
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private static String baseName(Path file) {
        String name = file.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String extension(Path file) {
        String name = file.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }
}

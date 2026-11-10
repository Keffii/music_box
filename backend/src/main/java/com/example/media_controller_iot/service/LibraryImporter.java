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
 * <p>The folder can be flat or sorted into subfolders (e.g. {@code music/Lofi/...}), and covers
 * can sit next to the audio or in their own folder tree (e.g. {@code cover/Lofi/...}).
 *
 * <p>Tracks listed in {@code tracks.json} get their title, artist and category from there. A
 * listed track is matched to an audio file by, in this order:
 * <ol>
 *   <li>its {@code file} name,</li>
 *   <li>its Pixabay id as a whole token in the file name ({@code artist-title-186374.mp3}),</li>
 *   <li>its {@code match} keywords as whole words in the file name (Pixabay's current downloads
 *       are named like {@code penguinmusic-better-day.mp3}, without the id),</li>
 *   <li>and only after every track had its chance, its title as whole words.</li>
 * </ol>
 * Any other audio file is imported with a title taken from its file name. Existing songs are
 * updated in place (matched by URL), so restarting never creates duplicates.
 */
@Service
public class LibraryImporter {

    private static final Logger log = LoggerFactory.getLogger(LibraryImporter.class);
    static final Set<String> AUDIO = Set.of("mp3", "ogg", "wav", "m4a", "aac", "flac");
    static final Set<String> IMAGES = Set.of("jpg", "jpeg", "png", "webp");
    /** Uploaded files have their own song rows (see FileUploadController) */
    private static final String UPLOADS = "uploads";

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
                             String category, String cover, List<String> match, String source) {}

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

        List<Path> audioFiles = listFiles(root, AUDIO);
        List<Path> images = listFiles(root, IMAGES);
        List<TrackEntry> catalog = readCatalog(root.resolve("tracks.json"));

        // Pass 1: exact name, Pixabay id, then the listed keywords. Pass 2: the title, for the rest.
        Map<TrackEntry, Path> matched = new LinkedHashMap<>();
        Set<Path> claimed = new HashSet<>();
        for (TrackEntry entry : catalog) {
            match(entry, audioFiles, claimed, false).ifPresent(f -> { matched.put(entry, f); claimed.add(f); });
        }
        for (TrackEntry entry : catalog) {
            if (matched.containsKey(entry)) continue;
            match(entry, audioFiles, claimed, true).ifPresent(f -> { matched.put(entry, f); claimed.add(f); });
        }

        List<String> missing = new ArrayList<>();
        int[] counts = new int[2]; // imported, updated
        for (TrackEntry entry : catalog) {
            Path file = matched.get(entry);
            if (file == null) {
                missing.add(entry.title() != null ? entry.title() : entry.file());
                continue;
            }
            upsert(file, entry.title(), entry.artist(), entry.category(),
                    cover(root, entry, file, images), counts);
        }

        for (Path file : audioFiles) {
            if (claimed.contains(file)) continue;
            upsert(file, titleFromFileName(file), "Unknown artist", "Other", cover(root, null, file, images), counts);
        }
        return new Result(counts[0], counts[1], missing);
    }

    private List<TrackEntry> readCatalog(Path catalog) throws IOException {
        if (!Files.isRegularFile(catalog)) return List.of();
        Catalog parsed = objectMapper.readValue(catalog.toFile(), Catalog.class);
        return parsed.tracks() == null ? List.of() : parsed.tracks();
    }

    /** Every file with one of the extensions, in all subfolders except uploads/ */
    private static List<Path> listFiles(Path root, Set<String> extensions) throws IOException {
        Path uploads = root.resolve(UPLOADS);
        try (Stream<Path> files = Files.walk(root)) {
            return files.filter(Files::isRegularFile)
                    .filter(f -> !f.startsWith(uploads))
                    .filter(f -> extensions.contains(extension(f)))
                    .sorted()
                    .toList();
        }
    }

    static Optional<Path> match(TrackEntry entry, List<Path> audioFiles, Set<Path> claimed, boolean byTitle) {
        List<Path> free = audioFiles.stream().filter(f -> !claimed.contains(f)).toList();
        if (!byTitle) {
            if (entry.file() != null) {
                for (Path f : free) {
                    if (f.getFileName().toString().equalsIgnoreCase(entry.file())) return Optional.of(f);
                }
            }
            if (entry.pixabayId() != null) {
                Optional<Path> byId = findByWords(free, List.of(String.valueOf(entry.pixabayId())));
                if (byId.isPresent()) return byId;
            }
            return findByWords(free, keywords(entry));
        }
        return entry.title() == null ? Optional.empty() : findByWords(free, List.of(normalize(entry.title())));
    }

    /**
     * The first file whose name contains one of the keys as whole words, trying the keys in order.
     * Whole words, so the id 8303 doesn't match a file named "...-183031".
     */
    static Optional<Path> findByWords(List<Path> files, List<String> keys) {
        for (String key : keys) {
            if (key.isEmpty()) continue;
            for (Path f : files) {
                if (("-" + normalize(baseName(f)) + "-").contains("-" + key + "-")) return Optional.of(f);
            }
        }
        return Optional.empty();
    }

    /** The listed keywords, then the short file name without its extension */
    private static List<String> keywords(TrackEntry entry) {
        List<String> keys = new ArrayList<>();
        if (entry.match() != null) entry.match().forEach(m -> keys.add(normalize(m)));
        if (entry.file() != null) keys.add(normalize(baseName(Path.of(entry.file()))));
        keys.removeIf(String::isEmpty);
        return keys;
    }

    /**
     * The cover for an audio file: the one listed in tracks.json, else an image with the same name
     * next to it or anywhere in the folder (e.g. a parallel cover/ tree), else an image whose name
     * contains one of the track's keywords.
     */
    private String cover(Path root, TrackEntry entry, Path audio, List<Path> images) {
        if (entry != null && entry.cover() != null && !entry.cover().isBlank()) {
            Path file = root.resolve(entry.cover()).normalize();
            if (file.startsWith(root) && Files.isRegularFile(file)) return storage.urlFor(file);
        }
        String base = normalize(baseName(audio));
        Optional<Path> sameName = images.stream()
                .filter(img -> normalize(baseName(img)).equals(base))
                .min(Comparator.comparing((Path img) -> !img.getParent().equals(audio.getParent())));
        if (sameName.isPresent()) return storage.urlFor(sameName.get());
        if (entry != null) {
            Optional<Path> byKeyword = findByWords(images, keywords(entry));
            if (byKeyword.isPresent()) return storage.urlFor(byKeyword.get());
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

    /** Lower case, with every run of other characters turned into one dash: "Hip Hop_Beat" -> "hip-hop-beat" */
    static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
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

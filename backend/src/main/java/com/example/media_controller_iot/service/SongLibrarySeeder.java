package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.SongsRepo;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.io.InputStream;
import java.util.*;

/**
 * Fills the songs table from the S3 bucket on startup, so a fresh RDS database
 * doesn't need any manual SQL.
 *
 * Upload audio files to the bucket's music/ folder and cover images to cover/.
 * Files are matched to the metadata in classpath:seed/tracks.json by the keywords
 * in each entry's "match" list (the Pixabay ID first). Covers are matched by the
 * same keywords or by having the same base name as the audio file. Audio files not
 * in the catalog are imported too, titled after their file name.
 *
 * The import is idempotent: songs are matched by URL or title and updated in place.
 * Disable with SEED_FROM_S3=false.
 */
@Component
public class SongLibrarySeeder {

    private static final Logger log = LoggerFactory.getLogger(SongLibrarySeeder.class);
    private static final Set<String> AUDIO = Set.of("mp3", "m4a", "aac", "ogg", "wav", "flac", "webm");
    private static final Set<String> IMAGE = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private final S3Client s3Client;
    private final SongsRepo songsRepo;
    private final PlayerService playerService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${aws.s3.bucket}")
    private String bucket;

    @Value("${app.seed-from-s3:true}")
    private boolean enabled;

    public SongLibrarySeeder(S3Client s3Client, SongsRepo songsRepo, PlayerService playerService) {
        this.s3Client = s3Client;
        this.songsRepo = songsRepo;
        this.playerService = playerService;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TrackInfo(String title, String artist, String category, List<String> match) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Catalog(List<TrackInfo> tracks) {}

    @EventListener(ApplicationReadyEvent.class)
    public void seedOnStartup() {
        if (!enabled) return;
        try {
            int count = seed();
            log.info("Song library seeded from s3://{}: {} song(s)", bucket, count);
        } catch (Exception e) {
            // Never stop the app from starting because of the seed step
            log.error("Could not seed songs from s3://{} (check the bucket name and the instance role's S3 permissions): {}",
                    bucket, e.getMessage());
        }
        playerService.reloadLibrary();
    }

    public int seed() throws Exception {
        List<String> audio = new ArrayList<>();
        List<String> images = new ArrayList<>();
        for (String key : listKeys("music/")) if (AUDIO.contains(extension(key))) audio.add(key);
        for (String key : listKeys("cover/")) if (IMAGE.contains(extension(key))) images.add(key);
        Collections.sort(audio);
        Collections.sort(images);

        Set<String> claimed = new HashSet<>();
        int imported = 0;

        for (TrackInfo track : readCatalog()) {
            List<String> keys = keywords(track);
            Optional<String> file = findMatch(audio, keys, claimed);
            if (file.isEmpty()) {
                log.info("Not in the bucket yet (upload it to music/ to enable): {}", track.title());
                continue;
            }
            claimed.add(file.get());
            upsert(track.title(), orDefault(track.artist(), "Unknown Artist"), orDefault(track.category(), "Other"),
                    file.get(), findCover(file.get(), images, keys));
            imported++;
        }

        for (String key : audio) {
            if (claimed.contains(key)) continue;
            upsert(prettyTitle(baseName(key)), "Unknown Artist", "Other", key, findCover(key, images, List.of()));
            imported++;
        }
        return imported;
    }

    private List<String> listKeys(String prefix) {
        List<String> keys = new ArrayList<>();
        ListObjectsV2Request request = ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build();
        for (var page : s3Client.listObjectsV2Paginator(request)) {
            for (S3Object object : page.contents()) {
                if (!object.key().endsWith("/")) keys.add(object.key());
            }
        }
        return keys;
    }

    private void upsert(String title, String artist, String category, String audioKey, String coverKey) {
        String srcUrl = publicUrl(audioKey);
        String coverUrl = coverKey != null ? publicUrl(coverKey) : null;

        Songs song = songsRepo.findAll().stream()
                .filter(s -> srcUrl.equals(s.getSrcUrl()) || title.equalsIgnoreCase(s.getTitle()))
                .findFirst()
                .orElseGet(Songs::new);
        boolean isNew = song.getId() == null;

        song.setTitle(title);
        song.setArtist(artist);
        song.setCategory(category);
        song.setSrcUrl(srcUrl);
        song.setCoverUrl(coverUrl);
        songsRepo.save(song);
        if (isNew) log.info("Imported \"{}\" ({})", title, category);
    }

    /** Public object URL with the key properly encoded (spaces etc.). */
    private String publicUrl(String key) {
        return s3Client.utilities().getUrl(b -> b.bucket(bucket).key(key)).toString();
    }

    private List<TrackInfo> readCatalog() {
        try (InputStream in = new ClassPathResource("seed/tracks.json").getInputStream()) {
            Catalog catalog = mapper.readValue(in, Catalog.class);
            return catalog.tracks() != null ? catalog.tracks() : List.of();
        } catch (Exception e) {
            log.warn("Could not read seed/tracks.json: {}", e.getMessage());
            return List.of();
        }
    }

    /** Tries the keys in order (most specific first) against all files. */
    private static Optional<String> findMatch(List<String> files, List<String> keys, Set<String> exclude) {
        for (String key : keys) {
            for (String f : files) {
                // Whole-word match, so ID "8303" doesn't match a file named "...-183031"
                String name = "-" + normalize(baseName(f)) + "-";
                if (!exclude.contains(f) && name.contains("-" + key + "-")) return Optional.of(f);
            }
        }
        return Optional.empty();
    }

    private static String findCover(String audioKey, List<String> images, List<String> keys) {
        String base = normalize(baseName(audioKey));
        for (String img : images) {
            if (normalize(baseName(img)).equals(base)) return img;
        }
        return findMatch(images, keys, Set.of()).orElse(null);
    }

    private static List<String> keywords(TrackInfo track) {
        List<String> keys = new ArrayList<>();
        if (track.match() != null) track.match().forEach(m -> keys.add(normalize(m)));
        if (track.title() != null) keys.add(normalize(track.title()));
        keys.removeIf(String::isEmpty);
        return keys;
    }

    static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }

    private static String baseName(String key) {
        String name = key.substring(key.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String extension(String key) {
        int dot = key.lastIndexOf('.');
        return dot > 0 ? key.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private static String prettyTitle(String base) {
        String spaced = base.replaceAll("[-_]+", " ").replaceAll("\\s\\d{4,}$", "").trim();
        if (spaced.isEmpty()) return base;
        StringBuilder sb = new StringBuilder();
        for (String w : spaced.split("\\s+")) {
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(' ');
        }
        return sb.toString().trim();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}

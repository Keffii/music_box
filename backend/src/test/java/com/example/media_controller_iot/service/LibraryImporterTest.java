package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.SongsRepo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LibraryImporterTest {

    @TempDir Path root;

    private final Map<String, Songs> db = new LinkedHashMap<>();
    private long nextId = 1;

    private LibraryImporter importer() {
        SongsRepo repo = mock(SongsRepo.class);
        when(repo.findFirstBySrcUrl(anyString())).thenAnswer(inv -> Optional.ofNullable(db.get((String) inv.getArgument(0))));
        when(repo.save(any(Songs.class))).thenAnswer(inv -> {
            Songs s = inv.getArgument(0);
            if (s.getId() == null) s.setId(nextId++);
            db.put(s.getSrcUrl(), s);
            return s;
        });
        return new LibraryImporter(new MediaStorage(root.toString()), repo, mock(PlayerService.class));
    }

    private void touch(String name) throws Exception {
        Path file = root.resolve(name);
        Files.createDirectories(file.getParent());
        Files.write(file, new byte[]{1, 2, 3});
    }

    /** The real music/tracks.json from the repo */
    private void realCatalog() throws Exception {
        Files.copy(Path.of("..", "music", "tracks.json"), root.resolve("tracks.json"));
    }

    @Test
    void importsGenreFoldersWithPixabaysCurrentNamesAndACoverTree() throws Exception {
        realCatalog();
        // The layout of a real download: genre subfolders, Pixabay's current names (mostly without
        // the id), and covers in a parallel cover/ tree
        String[] audio = {
                "Electronic/alex_makemusic-running-night-393139", "Electronic/grand_project-abstract-beauty",
                "Electronic/nveravetyanmusic-cascade-breathe-future-garage", "Electronic/penguinmusic-better-day",
                "Hip Hop/kontraa-hype-drill-music", "Hip Hop/nastelbom-hip-hop-427992",
                "Hip Hop/onesevenbeatxs-lonewolf-dark-hard-sad-trap-beat-prod-by-onesevenbeatxs",
                "Hip Hop/skilsel-energetic-hip-hop-8303",
                "Lofi/delosound-lofi-lofi-chill-lofi-girl", "Lofi/fassounds-good-night-lofi-cozy-chill-music",
                "Lofi/fassounds-lofi-study-calm-peaceful-chill-hop", "Lofi/lofi_music_library-coffee-lofi-lofi-music-chill-ambient",
                "Trance/djdoblina-pure-trance", "Trance/lnplusmusic-trance-dance-club-music",
                "Trance/playsound-trance", "Trance/the_mountain-smart-factory"};
        for (String a : audio) {
            touch("music/" + a + ".mp3");
            // the one cover without the id in its name
            touch("cover/" + a.replace("-427992", "") + ".jpg");
        }

        LibraryImporter.Result result = importer().importLibrary();

        assertThat(result.missing()).isEmpty();
        assertThat(result.imported()).isEqualTo(16);
        assertThat(db.values()).allSatisfy(s -> {
            assertThat(s.getCategory()).isNotEqualTo("Other");
            assertThat(s.getCoverUrl()).startsWith("/media/cover/");
        });
        // The generic title "Trance" must not take "Pure Trance"'s file
        assertThat(byTitle("Trance").getSrcUrl()).isEqualTo("/media/music/Trance/playsound-trance.mp3");
        assertThat(byTitle("Pure Trance").getSrcUrl()).isEqualTo("/media/music/Trance/djdoblina-pure-trance.mp3");
        assertThat(byTitle("Lonewolf Dark Trap").getCategory()).isEqualTo("Hiphop");
        // Folder names with spaces are encoded in the URL
        assertThat(byTitle("Hip Hop Beat").getSrcUrl()).isEqualTo("/media/music/Hip%20Hop/nastelbom-hip-hop-427992.mp3");
        assertThat(byTitle("Hip Hop Beat").getCoverUrl()).isEqualTo("/media/cover/Hip%20Hop/nastelbom-hip-hop.jpg");
    }

    @Test
    void titleIsOnlyALastResort() throws Exception {
        catalog("""
                {"tracks": [
                  {"title": "Night", "category": "Lofi"},
                  {"title": "Good Night", "match": ["good-night"], "category": "Lofi"}
                ]}""");
        touch("someone-good-night.mp3");
        touch("night.mp3");

        importer().importLibrary();

        // "Good Night" claims its file by keyword before "Night" falls back to its title
        assertThat(byTitle("Good Night").getSrcUrl()).isEqualTo("/media/someone-good-night.mp3");
        assertThat(byTitle("Night").getSrcUrl()).isEqualTo("/media/night.mp3");
    }

    @Test
    void leavesUploadsToTheUploadController() throws Exception {
        touch("uploads/music/abc-upload.mp3");
        touch("song.mp3");

        importer().importLibrary();

        assertThat(db.keySet()).containsExactly("/media/song.mp3");
    }

    private void catalog(String json) throws Exception {
        Files.writeString(root.resolve("tracks.json"), json);
    }

    private Songs byTitle(String title) {
        return db.values().stream().filter(s -> title.equals(s.getTitle())).findFirst().orElseThrow();
    }

    @Test
    void matchesPixabayDownloadsByIdAndExactNames() throws Exception {
        catalog("""
                {"tracks": [
                  {"file": "better-day.mp3", "pixabayId": 186374, "title": "Better Day", "artist": "penguinmusic", "category": "Electronic"},
                  {"file": "trance.mp3", "pixabayId": 123192, "title": "Trance", "artist": "Playsound", "category": "Trance"},
                  {"file": "energetic-hip-hop.mp3", "pixabayId": 8303, "title": "Energetic Hip Hop", "artist": "Skilsel", "category": "Hiphop"}
                ]}""");
        touch("penguinmusic-better-day-186374.mp3");
        touch("trance.mp3");
        touch("someone-else-183031.mp3"); // contains 8303 but not as a whole token

        LibraryImporter.Result result = importer().importLibrary();

        assertThat(result.imported()).isEqualTo(3);
        assertThat(result.missing()).containsExactly("Energetic Hip Hop");
        Songs betterDay = byTitle("Better Day");
        assertThat(betterDay.getArtist()).isEqualTo("penguinmusic");
        assertThat(betterDay.getCategory()).isEqualTo("Electronic");
        assertThat(betterDay.getSrcUrl()).isEqualTo("/media/penguinmusic-better-day-186374.mp3");
        assertThat(byTitle("Someone else 183031").getCategory()).isEqualTo("Other");
    }

    @Test
    void reimportUpdatesInsteadOfDuplicating() throws Exception {
        touch("my song.ogg");
        LibraryImporter importer = importer();
        importer.importLibrary();
        LibraryImporter.Result second = importer.importLibrary();

        assertThat(db).hasSize(1);
        assertThat(second.imported()).isZero();
        assertThat(second.updated()).isEqualTo(1);
        assertThat(db.keySet()).containsExactly("/media/my%20song.ogg");
    }

    @Test
    void picksUpSiblingCoverAndIgnoresNonAudio() throws Exception {
        touch("lofi-study.mp3");
        touch("lofi-study.jpg");
        touch("notes.txt");

        importer().importLibrary();

        assertThat(db).hasSize(1);
        assertThat(byTitle("Lofi study").getCoverUrl()).isEqualTo("/media/lofi-study.jpg");
    }

    @Test
    void emptyOrMissingFolderImportsNothing() throws Exception {
        Files.delete(root);
        LibraryImporter.Result result = importer().importLibrary();
        assertThat(result.imported()).isZero();
        assertThat(Files.isDirectory(root)).isTrue();
    }

    @Test
    void storageRejectsPathsOutsideTheRoot() {
        MediaStorage storage = new MediaStorage(root.toString());
        assertThat(storage.fileFor("/media/../secret.txt")).isEmpty();
        assertThat(storage.fileFor("/media/%2e%2e/secret.txt")).isEmpty();
        assertThat(storage.fileFor("/elsewhere/a.mp3")).isEmpty();
        assertThat(storage.fileFor("/media/a%20b.mp3")).contains(root.toAbsolutePath().normalize().resolve("a b.mp3"));
    }

    @Test
    void sanitizeStripsDirectoriesAndOddCharacters() {
        assertThat(MediaStorage.sanitize("../../etc/passwd")).isEqualTo("passwd");
        assertThat(MediaStorage.sanitize("My Song (1).MP3")).isEqualTo("my-song-1-.mp3");
        assertThat(MediaStorage.sanitize(null)).isEqualTo("file.bin");
    }
}

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
        Files.write(root.resolve(name), new byte[]{1, 2, 3});
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

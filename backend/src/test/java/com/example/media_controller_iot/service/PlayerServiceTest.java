package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.SongsRepo;
import com.example.media_controller_iot.repository.VolumeLogRepo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlayerServiceTest {

    private final SongsRepo songsRepo = mock(SongsRepo.class);
    private final List<Songs> library = new ArrayList<>();
    private final PlayerService player;

    PlayerServiceTest() {
        when(songsRepo.findAll(any(Sort.class))).thenAnswer(inv -> new ArrayList<>(library));
        when(songsRepo.findById(anyLong())).thenAnswer(inv -> library.stream()
                .filter(s -> s.getId().equals(inv.getArgument(0))).findFirst());
        player = new PlayerService(songsRepo, mock(PlayerCommandLogRepo.class), mock(VolumeLogRepo.class));
    }

    private void addSongs(int count) {
        for (long i = 1; i <= count; i++) {
            library.add(Songs.builder().id(i).title("Song " + i).artist("Artist").category("Lofi").build());
        }
    }

    private Object currentId() {
        return player.getState().get("currentSongId");
    }

    @Test
    void emptyLibraryReturnsStateWithoutSong() {
        Map<String, Object> state = player.getState();
        assertThat(state.get("currentSongId")).isNull();
        assertThat(state.get("title")).isNull();
        assertThat(state.get("isPlaying")).isEqualTo(false);
    }

    @Test
    void commandsOnEmptyLibraryDoNotCrashOrStartPlaying() {
        for (String cmd : List.of("PLAY", "PLAY_PAUSE", "NEXT", "PREV", "SHUFFLE", "SEEK_FORWARD", "VOLUME:30")) {
            assertThat(player.mediaCommands(cmd, null)).isTrue();
        }
        assertThat(player.getState().get("isPlaying")).isEqualTo(false);
        assertThat(player.getState().get("volume")).isEqualTo(30);
    }

    @Test
    @Timeout(2)
    void shuffleWithSingleSongTerminatesAndKeepsSong() {
        addSongs(1);
        player.mediaCommands("SHUFFLE", null);
        player.mediaCommands("NEXT", null);
        assertThat(currentId()).isEqualTo(1L);
    }

    @Test
    @Timeout(2)
    void shuffleWithSingleSongQueueTerminates() {
        addSongs(1);
        player.setPlaylistQueue(List.of(1L), null);
        player.mediaCommands("SHUFFLE", null);
        player.mediaCommands("NEXT", null);
        assertThat(currentId()).isEqualTo(1L);
    }

    @Test
    void shuffleNeverRepeatsCurrentSong() {
        addSongs(3);
        player.mediaCommands("SHUFFLE", null);
        for (int i = 0; i < 50; i++) {
            Object before = currentId();
            player.mediaCommands("NEXT", null);
            assertThat(currentId()).isNotEqualTo(before);
        }
    }

    @Test
    void nextAndPrevWrapAround() {
        addSongs(3);
        assertThat(currentId()).isEqualTo(1L);
        player.mediaCommands("PREV", null);
        assertThat(currentId()).isEqualTo(3L);
        player.mediaCommands("NEXT", null);
        assertThat(currentId()).isEqualTo(1L);
        player.mediaCommands("NEXT", null);
        assertThat(currentId()).isEqualTo(2L);
    }

    @Test
    void songsAreMatchedByIdEvenIfOtherFieldsChange() {
        addSongs(2);
        player.getState();
        library.set(0, Songs.builder().id(1L).title("Renamed").artist("Artist").build());
        player.mediaCommands("NEXT", null);
        assertThat(currentId()).isEqualTo(2L);
    }

    @Test
    void unknownCommandsAreRejectedWithoutChangingSeq() {
        addSongs(1);
        long seq = (long) player.getState().get("seq");
        assertThat(player.mediaCommands("FORMAT_DISK", null)).isFalse();
        assertThat(player.mediaCommands("VOLUME:abc", null)).isFalse();
        assertThat(player.mediaCommands(null, null)).isFalse();
        assertThat(player.getState().get("seq")).isEqualTo(seq);
    }

    @Test
    void everyCommandIncrementsSeqSoReplaysCanBeIgnored() {
        addSongs(1);
        player.mediaCommands("SEEK_FORWARD", null);
        Map<String, Object> first = player.getState();
        Map<String, Object> replay = player.getState();
        assertThat(replay.get("seq")).isEqualTo(first.get("seq"));

        player.mediaCommands("SEEK_FORWARD", null);
        assertThat((long) player.getState().get("seq")).isEqualTo((long) first.get("seq") + 1);
    }

    @Test
    void volumeIsClampedAndMuteRestoresIt() {
        addSongs(1);
        player.mediaCommands("VOLUME:150", null);
        assertThat(player.getState().get("volume")).isEqualTo(100);
        player.mediaCommands("VOLUME:40", null);
        player.mediaCommands("MUTE", null);
        assertThat(player.getState().get("volume")).isEqualTo(0);
        assertThat(player.getState().get("isMuted")).isEqualTo(true);
        player.mediaCommands("MUTE", null);
        assertThat(player.getState().get("volume")).isEqualTo(40);
    }

    @Test
    void stateIncludesTheCategory() {
        addSongs(1);
        assertThat(player.getState().get("category")).isEqualTo("Lofi");
    }

    @Test
    void playPauseToggles() {
        addSongs(1);
        player.mediaCommands("PLAY_PAUSE", null);
        assertThat(player.getState().get("isPlaying")).isEqualTo(true);
        player.mediaCommands("PLAY_PAUSE", null);
        assertThat(player.getState().get("isPlaying")).isEqualTo(false);
    }

    @Test
    void randomOtherIndexHandlesEdgeCases() {
        assertThat(PlayerService.randomOtherIndex(1, 0)).isZero();
        assertThat(PlayerService.randomOtherIndex(2, 0)).isEqualTo(1);
        assertThat(PlayerService.randomOtherIndex(2, 1)).isZero();
        assertThat(PlayerService.randomOtherIndex(5, -1)).isBetween(0, 4);
    }
}

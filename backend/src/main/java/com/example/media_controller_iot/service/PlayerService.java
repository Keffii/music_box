package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.PlayerCommandLog;
import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.models.VolumeLog;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.SongsRepo;
import com.example.media_controller_iot.repository.VolumeLogRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Holds the shared player state. The web UI and the ESP32 remote both send
 * commands here, and every change is broadcast to SSE subscribers.
 */
@Service
public class PlayerService {

    private static final Logger log = LoggerFactory.getLogger(PlayerService.class);

    public static final Set<String> COMMANDS = Set.of(
            "PLAY", "PAUSE", "PLAY_PAUSE", "NEXT", "PREV", "MUTE",
            "SHUFFLE", "REPEAT", "SEEK_FORWARD");

    private final SongsRepo songsRepo;
    private final PlayerCommandLogRepo playerCommandLogRepo;
    private final VolumeLogRepo volumeLogRepo;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    private List<Long> playlistQueue = new ArrayList<>();
    private int currentQueueIndex = -1;

    private boolean shuffleEnabled = false;
    private boolean repeatEnabled = false;
    private boolean isPlaying = false;
    private boolean isMuted = false;
    private boolean wasPlayingBeforeMute = false;
    private int volume = 50;
    private int previousVolume = 50;
    private String lastCommand = "NONE";
    /** Increases on every command, so clients can tell a new command from a replayed state. */
    private long seq = 0;

    private Songs currentSong;

    public PlayerService(SongsRepo songsRepo,
                         PlayerCommandLogRepo playerCommandLogRepo,
                         VolumeLogRepo volumeLogRepo) {
        this.songsRepo = songsRepo;
        this.playerCommandLogRepo = playerCommandLogRepo;
        this.volumeLogRepo = volumeLogRepo;
    }

    public static boolean isValidCommand(String cmd) {
        if (cmd == null) return false;
        if (COMMANDS.contains(cmd)) return true;
        if (cmd.startsWith("VOLUME:")) {
            try {
                Integer.parseInt(cmd.substring("VOLUME:".length()));
                return true;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }

    public void addEmitter(SseEmitter emitter) { emitters.add(emitter); }
    public void removeEmitter(SseEmitter emitter) { emitters.remove(emitter); }

    private void broadcastState() {
        Map<String, Object> state = getState();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(state);
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    private List<Songs> allSongs() {
        return songsRepo.findAll(Sort.by("id"));
    }

    private int indexOfCurrent(List<Songs> songs) {
        if (currentSong == null) return -1;
        for (int i = 0; i < songs.size(); i++) {
            if (Objects.equals(songs.get(i).getId(), currentSong.getId())) return i;
        }
        return -1;
    }

    /** Picks a random index other than {@code current}, or {@code current} when there is only one. */
    static int randomOtherIndex(int size, int current) {
        if (size <= 1) return 0;
        if (current < 0 || current >= size) return ThreadLocalRandom.current().nextInt(size);
        int pick = ThreadLocalRandom.current().nextInt(size - 1);
        return pick >= current ? pick + 1 : pick;
    }

    private void nextSong() {
        if (repeatEnabled) return; // repeat restarts the same song

        if (!playlistQueue.isEmpty() && currentQueueIndex >= 0) {
            currentQueueIndex = shuffleEnabled
                    ? randomOtherIndex(playlistQueue.size(), currentQueueIndex)
                    : (currentQueueIndex + 1) % playlistQueue.size();
            loadQueueSong();
            return;
        }

        List<Songs> songs = allSongs();
        if (songs.isEmpty()) return;
        int idx = indexOfCurrent(songs);
        int next = shuffleEnabled ? randomOtherIndex(songs.size(), idx) : (idx + 1) % songs.size();
        currentSong = songs.get(next);
    }

    private void prevSong() {
        if (!playlistQueue.isEmpty() && currentQueueIndex >= 0) {
            currentQueueIndex = (currentQueueIndex - 1 + playlistQueue.size()) % playlistQueue.size();
            loadQueueSong();
            return;
        }

        List<Songs> songs = allSongs();
        if (songs.isEmpty()) return;
        int idx = indexOfCurrent(songs);
        currentSong = songs.get(idx <= 0 ? songs.size() - 1 : idx - 1);
    }

    private void loadQueueSong() {
        Long songId = playlistQueue.get(currentQueueIndex);
        if (songId != null) songsRepo.findById(songId).ifPresent(song -> currentSong = song);
    }

    private void toggleMute() {
        if (!isMuted) {
            previousVolume = volume > 0 ? volume : previousVolume;
            volume = 0;
            isMuted = true;
            wasPlayingBeforeMute = isPlaying;
            isPlaying = false;
        } else {
            volume = previousVolume;
            isMuted = false;
            isPlaying = wasPlayingBeforeMute;
        }
    }

    private void handleVolume(String cmd) {
        try {
            int newVolume = Integer.parseInt(cmd.substring("VOLUME:".length()));
            volume = Math.max(0, Math.min(newVolume, 100));
            isMuted = (volume == 0);
            volumeLogRepo.save(new VolumeLog(volume));
        } catch (NumberFormatException e) {
            log.warn("Invalid VOLUME command: {}", cmd);
        }
    }

    public void mediaCommands(String cmd) {
        mediaCommands(cmd, null);
    }

    /**
     * Applies a command and broadcasts the new state.
     *
     * @return false when the command is unknown (nothing changes)
     */
    public synchronized boolean mediaCommands(String cmd, String userId) {
        if (!isValidCommand(cmd)) {
            log.warn("Ignoring unknown command: {}", cmd);
            return false;
        }
        if (currentSong == null) loadInitialSong();

        switch (cmd) {
            case "PLAY" -> isPlaying = currentSong != null;
            case "PAUSE" -> isPlaying = false;
            case "PLAY_PAUSE" -> isPlaying = !isPlaying && currentSong != null;
            case "NEXT" -> nextSong();
            case "PREV" -> prevSong();
            case "MUTE" -> toggleMute();
            case "SHUFFLE" -> shuffleEnabled = !shuffleEnabled;
            case "REPEAT" -> repeatEnabled = !repeatEnabled;
            case "SEEK_FORWARD" -> { /* applied once by the web player, keyed on seq */ }
            default -> handleVolume(cmd);
        }

        lastCommand = cmd;
        seq++;
        playerCommandLogRepo.save(new PlayerCommandLog(cmd, currentSong, userId));
        broadcastState();
        return true;
    }

    public synchronized void setPlaylistQueue(List<Long> songIds, String userId) {
        if (songIds == null || songIds.isEmpty()) {
            playlistQueue.clear();
            currentQueueIndex = -1;
        } else {
            playlistQueue = new ArrayList<>(songIds);
            currentQueueIndex = 0;
            Long firstSongId = playlistQueue.get(0);
            if (firstSongId != null) {
                songsRepo.findById(firstSongId).ifPresent(song -> {
                    currentSong = song;
                    isPlaying = true;
                    lastCommand = "PLAY";
                    seq++;
                    playerCommandLogRepo.save(new PlayerCommandLog("PLAY", song, userId));
                });
            }
        }
        broadcastState();
    }

    /** Re-reads the library, e.g. after songs were imported or uploaded. */
    public synchronized void refreshLibrary() {
        if (currentSong == null) loadInitialSong();
        broadcastState();
    }

    private void loadInitialSong() {
        List<Songs> songs = allSongs();
        currentSong = songs.isEmpty() ? null : songs.get(0);
    }

    /** The current state. Song fields are null when the library is empty. */
    public synchronized Map<String, Object> getState() {
        if (currentSong == null) loadInitialSong();

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("isPlaying", isPlaying);
        state.put("currentSongId", currentSong != null ? currentSong.getId() : null);
        state.put("title", currentSong != null ? currentSong.getTitle() : null);
        state.put("artist", currentSong != null ? currentSong.getArtist() : null);
        state.put("srcUrl", currentSong != null ? currentSong.getSrcUrl() : null);
        state.put("coverUrl", currentSong != null ? currentSong.getCoverUrl() : null);
        state.put("volume", volume);
        state.put("isMuted", isMuted);
        state.put("lastCommand", lastCommand);
        state.put("seq", seq);
        state.put("shuffle", shuffleEnabled);
        state.put("repeat", repeatEnabled);
        return state;
    }
}

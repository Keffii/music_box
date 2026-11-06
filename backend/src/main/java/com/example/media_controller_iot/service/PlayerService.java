package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.PlayerCommandLog;
import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.models.VolumeLog;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.SongsRepo;
import com.example.media_controller_iot.repository.VolumeLogRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One player per signed-in user: what is playing, the queue, volume, shuffle and repeat.
 * Each browser tab of a user follows that user's player over SSE, so two tabs (or a phone
 * and a laptop) stay in sync, while different users never affect each other.
 *
 * Commands without a user (the ESP32 Bluetooth remote) go to the player of the account in
 * REMOTE_USER_ID, so the remote controls that person's browser. Without it they go to a
 * separate "remote" player.
 */
@Service
public class PlayerService {

    static final String REMOTE_PLAYER = "remote";

    private final SongsRepo songsRepo;
    private final PlayerCommandLogRepo playerCommandLogRepo;
    private final VolumeLogRepo volumeLogRepo;

    @Value("${app.remote-user-id:}")
    private String remoteUserId;

    private final Map<String, Player> players = new ConcurrentHashMap<>();

    /** The state of one user's player. Access it only while holding its lock (synchronized). */
    private static final class Player {
        final List<SseEmitter> emitters = new ArrayList<>();
        Songs currentSong;
        List<Long> playlistQueue = new ArrayList<>();
        int currentQueueIndex = -1;
        boolean shuffleEnabled = false;
        boolean repeatEnabled = false;
        double playbackPosition = 0;
        boolean isPlaying = false;
        boolean isMuted = false;
        int previousVolume = 50;
        boolean wasPlayingBeforeMute = false;
        int volume = 50;
        String lastCommand = "NONE";
        // Increments on every command, so the browser can tell a new SEEK_FORWARD from a replayed state
        long commandSeq = 0;
    }

    public PlayerService(SongsRepo songsRepo,
                         PlayerCommandLogRepo playerCommandLogRepo,
                         VolumeLogRepo volumeLogRepo) {
        this.songsRepo = songsRepo;
        this.playerCommandLogRepo = playerCommandLogRepo;
        this.volumeLogRepo = volumeLogRepo;
    }

    // ---------- Which player ----------

    private boolean hasRemoteUser() {
        return remoteUserId != null && !remoteUserId.isBlank();
    }

    private String keyFor(String userId) {
        if (userId != null && !userId.isBlank()) return userId;
        return hasRemoteUser() ? remoteUserId.trim() : REMOTE_PLAYER;
    }

    private Player player(String userId) {
        return players.computeIfAbsent(keyFor(userId), k -> new Player());
    }

    // ---------- Streams ----------

    public void addEmitter(String userId, SseEmitter emitter) {
        Player p = player(userId);
        synchronized (p) {
            p.emitters.add(emitter);
        }
    }

    public void removeEmitter(String userId, SseEmitter emitter) {
        Player p = players.get(keyFor(userId));
        if (p == null) return;
        synchronized (p) {
            p.emitters.remove(emitter);
        }
    }

    /**
     * Sends an SSE comment to every client every 15 s. Without it, idle streams are
     * cut by Elastic Beanstalk's nginx (60 s) and CloudFront (60 s origin read timeout).
     */
    @Scheduled(fixedRate = 15000)
    public void heartbeat() {
        for (Player p : players.values()) {
            synchronized (p) {
                p.emitters.removeIf(emitter -> {
                    try {
                        emitter.send(SseEmitter.event().comment("ping"));
                        return false;
                    } catch (Exception e) {
                        return true;
                    }
                });
            }
        }
    }

    private void broadcastState(Player p) {
        Map<String, Object> state = stateOf(p);
        p.emitters.removeIf(emitter -> {
            try {
                emitter.send(state);
                return false;
            } catch (Exception e) {
                return true;
            }
        });
    }

    /** Called after the song library is seeded, so every player is on a real song. */
    public void reloadLibrary() {
        for (Player p : players.values()) {
            synchronized (p) {
                if (p.currentSong == null || !songsRepo.existsById(p.currentSong.getId())) {
                    p.currentSong = null;
                    loadInitialSong(p);
                }
                broadcastState(p);
            }
        }
    }

    // ---------- Commands ----------

    public void mediaCommands(String cmd) {
        mediaCommands(cmd, null);
    }

    public void mediaCommands(String cmd, String userId) {
        if (cmd == null || cmd.isBlank()) return;
        Player p = player(userId);
        synchronized (p) {
            if (p.currentSong == null) loadInitialSong(p);

            switch (cmd) {
                case "PLAY" -> p.isPlaying = true;
                case "PAUSE" -> p.isPlaying = false;
                case "NEXT" -> nextSong(p);
                case "PREV" -> prevSong(p);
                case "MUTE" -> toggleMute(p);
                case "PLAY_PAUSE" -> p.isPlaying = !p.isPlaying;
                case "SHUFFLE" -> p.shuffleEnabled = !p.shuffleEnabled;
                case "REPEAT" -> p.repeatEnabled = !p.repeatEnabled;
                case "SEEK_FORWARD" -> p.playbackPosition += 10;
                default -> {
                    if (cmd.startsWith("VOLUME:")) handleVolume(p, cmd);
                }
            }

            p.lastCommand = cmd;
            p.commandSeq++;
            playerCommandLogRepo.save(new PlayerCommandLog(cmd, p.currentSong, logUser(userId)));
            broadcastState(p);
        }
    }

    public void setPlaylistQueue(List<Long> songIds, String userId) {
        Player p = player(userId);
        synchronized (p) {
            if (songIds == null || songIds.isEmpty()) {
                p.playlistQueue.clear();
                p.currentQueueIndex = -1;
            } else {
                p.playlistQueue = new ArrayList<>(songIds);
                p.currentQueueIndex = 0;
                Long firstSongId = p.playlistQueue.get(0);
                songsRepo.findById(Objects.requireNonNull(firstSongId)).ifPresent(song -> {
                    p.currentSong = song;
                    p.isPlaying = true;
                    // Log the command so it appears in recently played
                    p.lastCommand = "PLAY";
                    p.commandSeq++;
                    playerCommandLogRepo.save(new PlayerCommandLog("PLAY", song, logUser(userId)));
                });
                p.playbackPosition = 0;
            }
            broadcastState(p);
        }
    }

    public @NonNull Map<String, Object> getState(String userId) {
        Player p = player(userId);
        synchronized (p) {
            return stateOf(p);
        }
    }

    /** Remote commands count towards the remote owner's recently played list. */
    private String logUser(String userId) {
        if (userId != null && !userId.isBlank()) return userId;
        return hasRemoteUser() ? remoteUserId.trim() : null;
    }

    // ---------- Player logic (caller holds the player's lock) ----------

    /** Position of the current song by ID (entity equals() breaks when metadata changes). */
    private int indexOfCurrent(Player p, List<Songs> songs) {
        if (p.currentSong == null) return -1;
        for (int i = 0; i < songs.size(); i++) {
            if (Objects.equals(songs.get(i).getId(), p.currentSong.getId())) return i;
        }
        return -1;
    }

    private void loadInitialSong(Player p) {
        List<Songs> songs = songsRepo.findAll();
        if (!songs.isEmpty()) {
            p.currentSong = songs.get(0);
        }
    }

    private void nextSong(Player p) {
        // If a playlist queue is active, move within it
        if (!p.playlistQueue.isEmpty() && p.currentQueueIndex >= 0) {
            if (p.repeatEnabled) {
                p.playbackPosition = 0;
                return;
            }
            if (p.shuffleEnabled) {
                Random r = new Random();
                int newIndex;
                do {
                    newIndex = r.nextInt(p.playlistQueue.size());
                } while (newIndex == p.currentQueueIndex && p.playlistQueue.size() > 1);
                p.currentQueueIndex = newIndex;
            } else {
                p.currentQueueIndex = (p.currentQueueIndex + 1) % p.playlistQueue.size();
            }
            Long songId = p.playlistQueue.get(p.currentQueueIndex);
            songsRepo.findById(Objects.requireNonNull(songId)).ifPresent(song -> p.currentSong = song);
            p.playbackPosition = 0;
            return;
        }

        // Otherwise use all songs
        List<Songs> songs = songsRepo.findAll();
        if (songs.isEmpty()) return;

        // Repeat (without shuffle) restarts the current song
        if (p.repeatEnabled && !p.shuffleEnabled) {
            p.playbackPosition = 0;
            return;
        }

        if (p.shuffleEnabled) {
            Random r = new Random();
            Songs newSong;
            do {
                newSong = songs.get(r.nextInt(songs.size()));
            } while (p.currentSong != null && Objects.equals(newSong.getId(), p.currentSong.getId()) && songs.size() > 1);
            p.currentSong = newSong;
        } else {
            int idx = indexOfCurrent(p, songs);
            p.currentSong = songs.get((idx + 1) % songs.size());
        }
        p.playbackPosition = 0;
    }

    private void prevSong(Player p) {
        if (!p.playlistQueue.isEmpty() && p.currentQueueIndex >= 0) {
            p.currentQueueIndex = (p.currentQueueIndex - 1 + p.playlistQueue.size()) % p.playlistQueue.size();
            Long songId = p.playlistQueue.get(p.currentQueueIndex);
            songsRepo.findById(Objects.requireNonNull(songId)).ifPresent(song -> p.currentSong = song);
            p.playbackPosition = 0;
            return;
        }

        List<Songs> songs = songsRepo.findAll();
        if (songs.isEmpty()) return;

        int index = indexOfCurrent(p, songs);
        p.currentSong = songs.get((index - 1 + songs.size()) % songs.size());
        p.playbackPosition = 0;
    }

    private void toggleMute(Player p) {
        if (!p.isMuted) {
            p.previousVolume = p.volume;
            p.volume = 0;
            p.isMuted = true;
            p.wasPlayingBeforeMute = p.isPlaying;
            p.isPlaying = false;
        } else {
            p.volume = p.previousVolume;
            p.isMuted = false;
            p.isPlaying = p.wasPlayingBeforeMute;
        }
    }

    private void handleVolume(Player p, String cmd) {
        try {
            int newVolume = Integer.parseInt(cmd.split(":")[1]);
            p.volume = Math.max(0, Math.min(newVolume, 100));
            p.isMuted = (p.volume == 0);
            volumeLogRepo.save(new VolumeLog(p.volume));
        } catch (Exception e) {
            System.err.println("Invalid VOLUME command: " + cmd);
        }
    }

    private @NonNull Map<String, Object> stateOf(Player p) {
        if (p.currentSong == null) loadInitialSong(p);
        boolean hasSong = p.currentSong != null;

        // HashMap, not Map.of: values are null while the library is still empty
        Map<String, Object> state = new HashMap<>();
        state.put("isPlaying", p.isPlaying);
        state.put("currentSongId", hasSong ? p.currentSong.getId() : null);
        state.put("title", hasSong ? p.currentSong.getTitle() : "No songs yet");
        state.put("artist", hasSong ? p.currentSong.getArtist() : "Upload music to the S3 bucket");
        state.put("srcUrl", hasSong ? p.currentSong.getSrcUrl() : null);
        state.put("coverUrl", hasSong ? p.currentSong.getCoverUrl() : null);
        state.put("volume", p.volume);
        state.put("isMuted", p.isMuted);
        state.put("lastCommand", p.lastCommand);
        state.put("commandSeq", p.commandSeq);
        state.put("shuffle", p.shuffleEnabled);
        state.put("repeat", p.repeatEnabled);
        state.put("position", p.playbackPosition);
        state.put("duration", 0);
        return state;
    }
}

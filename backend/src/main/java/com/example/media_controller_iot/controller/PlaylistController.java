package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.Playlist;
import com.example.media_controller_iot.models.PlaylistSong;
import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.PlaylistRepository;
import com.example.media_controller_iot.repository.PlaylistSongRepository;
import com.example.media_controller_iot.repository.SongsRepo;
import com.example.media_controller_iot.service.PlaylistEventService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/playlists")
public class PlaylistController {

    private final PlaylistRepository playlistRepository;
    private final PlaylistSongRepository playlistSongRepository;
    private final SongsRepo songsRepository;
    private final PlaylistEventService playlistEventService;

    public PlaylistController(PlaylistRepository playlistRepository,
                              PlaylistSongRepository playlistSongRepository,
                              SongsRepo songsRepository,
                              PlaylistEventService playlistEventService) {
        this.playlistRepository = playlistRepository;
        this.playlistSongRepository = playlistSongRepository;
        this.songsRepository = songsRepository;
        this.playlistEventService = playlistEventService;
    }

    // SSE stream for playlist updates
    @GetMapping("/stream")
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        playlistEventService.addEmitter(emitter);

        emitter.onCompletion(() -> playlistEventService.removeEmitter(emitter));
        emitter.onTimeout(() -> playlistEventService.removeEmitter(emitter));

        return emitter;
    }

    // Get all playlists for current user
    @GetMapping
    public List<Playlist> getUserPlaylists(Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        return playlistRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // Create a new playlist
    @PostMapping
    public ResponseEntity<Playlist> createPlaylist(@RequestBody Map<String, String> request,
                                                    Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        String name = request.get("name");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Playlist playlist = Playlist.builder()
                .name(name.trim())
                .userId(userId)
                .build();

        Playlist savedPlaylist = playlistRepository.save(Objects.requireNonNull(playlist));
        playlistEventService.broadcastPlaylistCreated(savedPlaylist.getId(), savedPlaylist.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPlaylist);
    }

    // Rename a playlist
    @PutMapping("/{playlistId}")
    public ResponseEntity<Playlist> renamePlaylist(@PathVariable Long playlistId,
                                                   @RequestBody Map<String, String> request,
                                                   Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        String name = request.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        return playlistRepository.findById(Objects.requireNonNull(playlistId))
                .map(playlist -> {
                    if (!playlist.getUserId().equals(userId)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Playlist>build();
                    }
                    playlist.setName(name.trim());
                    return ResponseEntity.ok(playlistRepository.save(playlist));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Delete a playlist
    @DeleteMapping("/{playlistId}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> deletePlaylist(@PathVariable Long playlistId,
                                                                Authentication authentication) {
        String userId = getCurrentUserId(authentication);

        return playlistRepository.findById(Objects.requireNonNull(playlistId))
                .map(playlist -> {
                    if (!playlist.getUserId().equals(userId)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Map<String, Boolean>>build();
                    }

                    // Delete all songs in playlist first
                    playlistSongRepository.deleteByPlaylistId(Objects.requireNonNull(playlistId));
                    // Delete playlist
                    playlistRepository.delete(Objects.requireNonNull(playlist));
                    playlistEventService.broadcastPlaylistDeleted(playlistId);

                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Get songs in a playlist
    @GetMapping("/{playlistId}/songs")
    public ResponseEntity<List<Songs>> getPlaylistSongs(@PathVariable Long playlistId,
                                                         Authentication authentication) {
        String userId = getCurrentUserId(authentication);

        return playlistRepository.findById(Objects.requireNonNull(playlistId))
                .map(playlist -> {
                    if (!playlist.getUserId().equals(userId)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<List<Songs>>build();
                    }

                    List<Long> songIds = playlistSongRepository.findSongIdsByPlaylistId(playlistId);
                    List<Songs> songs = songsRepository.findAllById(Objects.requireNonNull(songIds));

                    return ResponseEntity.ok(songs);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Add song to playlist
    @PostMapping("/{playlistId}/songs/{songId}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> addSongToPlaylist(@PathVariable Long playlistId,
                                                                   @PathVariable Long songId,
                                                                   Authentication authentication) {
        String userId = getCurrentUserId(authentication);

        return playlistRepository.findById(Objects.requireNonNull(playlistId))
                .map(playlist -> {
                    if (!playlist.getUserId().equals(userId)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Map<String, Boolean>>build();
                    }

                    // Check if song exists
                    if (!songsRepository.existsById(Objects.requireNonNull(songId))) {
                        return ResponseEntity.notFound().<Map<String, Boolean>>build();
                    }

                    // Check if already in playlist
                    if (playlistSongRepository.existsByPlaylistIdAndSongId(
                            Objects.requireNonNull(playlistId), 
                            Objects.requireNonNull(songId))) {
                        return ResponseEntity.ok(Map.of("success", true, "alreadyExists", true));
                    }

                    PlaylistSong playlistSong = PlaylistSong.builder()
                            .playlistId(playlistId)
                            .songId(songId)
                            .build();

                    playlistSongRepository.save(Objects.requireNonNull(playlistSong));
                    playlistEventService.broadcastSongAdded(playlistId, songId);

                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Remove song from playlist
    @DeleteMapping("/{playlistId}/songs/{songId}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> removeSongFromPlaylist(@PathVariable Long playlistId,
                                                                        @PathVariable Long songId,
                                                                        Authentication authentication) {
        String userId = getCurrentUserId(authentication);

        return playlistRepository.findById(Objects.requireNonNull(playlistId))
                .map(playlist -> {
                    if (!playlist.getUserId().equals(userId)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Map<String, Boolean>>build();
                    }

                    playlistSongRepository.deleteByPlaylistIdAndSongId(
                            Objects.requireNonNull(playlistId), 
                            Objects.requireNonNull(songId));
                    playlistEventService.broadcastSongRemoved(playlistId, songId);

                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Get playlist with song count
    @GetMapping("/with-counts")
    public ResponseEntity<List<Map<String, Object>>> getPlaylistsWithCounts(Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        List<Playlist> playlists = playlistRepository.findByUserIdOrderByCreatedAtDesc(userId);

        List<Map<String, Object>> playlistsWithCounts = playlists.stream()
                .map(playlist -> {
                    Map<String, Object> playlistData = new HashMap<>();
                    playlistData.put("id", playlist.getId());
                    playlistData.put("name", playlist.getName());
                    playlistData.put("userId", playlist.getUserId());
                    playlistData.put("createdAt", playlist.getCreatedAt());

                    int songCount = playlistSongRepository.findByPlaylistId(playlist.getId()).size();
                    playlistData.put("songCount", songCount);

                    return playlistData;
                })
                .toList();

        return ResponseEntity.ok(playlistsWithCounts);
    }

    private String getCurrentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return "default-user";
    }
}

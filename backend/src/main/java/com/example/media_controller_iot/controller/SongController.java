package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.SongsRepo;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/player")
public class SongController {

    private final SongsRepo songRepository;
    private final PlayerCommandLogRepo commandLogRepository;

    public SongController(SongsRepo songRepository, PlayerCommandLogRepo commandLogRepository) {
        this.songRepository = songRepository;
        this.commandLogRepository = commandLogRepository;
    }

    @GetMapping("/songs")
    public List<Songs> getAllSongs() {
        return songRepository.findAll();
    }
    
    @GetMapping("/songs/category/{category}")
    public List<Songs> getSongsByCategory(@PathVariable String category) {
        return songRepository.findByCategory(category);
    }
    
    @GetMapping("/songs/search")
    public List<Songs> searchSongs(@RequestParam String query) {
        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }
        return songRepository.searchByTitleArtistOrCategory(query.trim());
    }

    @GetMapping("/recently-played")
    public List<Songs> getRecentlyPlayed(Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        return commandLogRepository.findRecentlyPlayedSongsByUserId(userId);
    }

    private String getCurrentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        throw new IllegalStateException("User is not authenticated");
    }
}

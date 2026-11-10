package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.SongsRepo;
import com.example.media_controller_iot.service.DemoUser;
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

    /** Matches the title, the artist or the genre */
    @GetMapping("/songs/search")
    public List<Songs> searchSongs(@RequestParam String query) {
        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }
        return songRepository.searchByTitleArtistOrCategory(query.trim());
    }

    /** The shared player's history (the web player and the remote together) */
    @GetMapping("/recently-played")
    public List<Songs> getRecentlyPlayed() {
        return commandLogRepository.findRecentlyPlayedSongsByUserId(DemoUser.ID);
    }
}

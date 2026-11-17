package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.PlayerService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/player")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    @PostMapping("/command")
    public void playCommand(@RequestBody Map<String, String> body, Authentication authentication) {
        String command = body.get("command");
        String userId = getCurrentUserId(authentication);
        playerService.mediaCommands(command, userId);
    }

    private String getCurrentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return null; // Allow anonymous commands (e.g., Bluetooth listener)
    }

    @GetMapping("/state")
    public @NonNull Map<String, Object> getState(Authentication authentication) {
        return playerService.getState(getCurrentUserId(authentication));
    }

    /** Live updates of the signed-in user's own player (requires the Authorization header). */
    @GetMapping("/stream")
    public SseEmitter stream(HttpServletResponse response, Authentication authentication) {
        // Stop nginx (Elastic Beanstalk) from buffering the stream, and any cache from storing it
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache");

        String userId = getCurrentUserId(authentication);
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        playerService.addEmitter(userId, emitter);

        try {
            emitter.send(playerService.getState(userId));
        } catch (Exception ignored) {
        }

        emitter.onCompletion(() -> playerService.removeEmitter(userId, emitter));
        emitter.onTimeout(() -> playerService.removeEmitter(userId, emitter));
        emitter.onError(e -> playerService.removeEmitter(userId, emitter));

        return emitter;
    }

    @PostMapping("/playlist-queue")
    public void setPlaylistQueue(@RequestBody Map<String, Object> body, Authentication authentication) {
        String userId = getCurrentUserId(authentication);
        @SuppressWarnings("unchecked")
        List<Integer> songIdsInt = (List<Integer>) body.get("songIds");
        
        if (songIdsInt == null) {
            playerService.setPlaylistQueue(null, userId);
        } else {
            List<Long> songIds = songIdsInt.stream()
                    .map(Integer::longValue)
                    .toList();
            playerService.setPlaylistQueue(songIds, userId);
        }
    }
}

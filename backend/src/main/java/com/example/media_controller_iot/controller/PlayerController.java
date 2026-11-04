package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.PlayerService;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<Void> playCommand(@RequestBody Map<String, String> body, Authentication authentication) {
        String command = body.get("command");
        String userId = getCurrentUserId(authentication);
        return playerService.mediaCommands(command, userId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.badRequest().build();
    }

    private String getCurrentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return null;
    }

    @GetMapping("/state")
    public Map<String, Object> getState() {
        return playerService.getState();
    }

    @GetMapping("/stream")
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        playerService.addEmitter(emitter);

        try {
            emitter.send(playerService.getState());
        } catch (Exception ignored) {
        }

        emitter.onCompletion(() -> playerService.removeEmitter(emitter));
        emitter.onTimeout(() -> playerService.removeEmitter(emitter));
        emitter.onError(e -> playerService.removeEmitter(emitter));

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

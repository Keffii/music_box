package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.DemoUser;
import com.example.media_controller_iot.service.PlayerService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * The web player's API. There are no accounts in the local demo: every browser and the ESP32
 * remote control the same shared player (see DemoUser).
 */
@RestController
@RequestMapping("/api/player")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    @PostMapping("/command")
    public ResponseEntity<Void> playCommand(@RequestBody Map<String, String> body) {
        String command = body.get("command");
        return playerService.mediaCommands(command, DemoUser.ID)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.badRequest().build();
    }

    @GetMapping("/state")
    public Map<String, Object> getState() {
        return playerService.getState();
    }

    /** Live player updates (server-sent events), plus a heartbeat comment every 15 s */
    @GetMapping("/stream")
    public SseEmitter stream(HttpServletResponse response) {
        // Don't let a proxy buffer the stream: nginx reads X-Accel-Buffering, and no-transform
        // stops gzip (e.g. the React dev server's proxy), which would otherwise hold events back
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache, no-transform");

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
    public void setPlaylistQueue(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Integer> songIdsInt = (List<Integer>) body.get("songIds");

        if (songIdsInt == null) {
            playerService.setPlaylistQueue(null, DemoUser.ID);
        } else {
            List<Long> songIds = songIdsInt.stream()
                    .map(Integer::longValue)
                    .toList();
            playerService.setPlaylistQueue(songIds, DemoUser.ID);
        }
    }
}

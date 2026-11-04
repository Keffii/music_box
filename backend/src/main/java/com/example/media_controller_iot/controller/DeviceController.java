package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.PlayerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HTTP API for the ESP32 WiFi remote. Every request needs the {@code X-Device-Key} header
 * (see DeviceKeyFilter).
 *
 * <pre>
 * POST /api/device/command   {"command":"PLAY_PAUSE"}  or  {"command":"VOLUME:42"}
 * GET  /api/device/state
 * </pre>
 * Both return the compact now-playing state that the remote shows on its OLED.
 */
@RestController
@RequestMapping("/api/device")
public class DeviceController {

    private final PlayerService playerService;

    public DeviceController(PlayerService playerService) {
        this.playerService = playerService;
    }

    @PostMapping("/command")
    public ResponseEntity<Map<String, Object>> command(@RequestBody Map<String, String> body) {
        String command = body.get("command");
        if (!playerService.mediaCommands(command, null)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unknown command"));
        }
        return ResponseEntity.ok(compactState());
    }

    @GetMapping("/state")
    public Map<String, Object> state() {
        return compactState();
    }

    /** Only the fields the remote needs, to keep responses small for the ESP32. */
    private Map<String, Object> compactState() {
        Map<String, Object> full = playerService.getState();
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("title", full.get("title") != null ? full.get("title") : "");
        state.put("artist", full.get("artist") != null ? full.get("artist") : "");
        state.put("isPlaying", full.get("isPlaying"));
        state.put("volume", full.get("volume"));
        state.put("isMuted", full.get("isMuted"));
        state.put("shuffle", full.get("shuffle"));
        state.put("repeat", full.get("repeat"));
        state.put("lastCommand", full.get("lastCommand"));
        state.put("seq", full.get("seq"));
        return state;
    }
}

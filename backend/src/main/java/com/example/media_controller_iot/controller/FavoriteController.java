package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.service.DemoUser;
import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.service.FavoriteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {
    
    @Autowired
    private FavoriteService favoriteService;

    // No accounts in the local demo: everyone shares the demo user's favourites (see DemoUser)

    /**
     * GET /api/favorites - Get all favorite songs for current user
     */
    @GetMapping
    public ResponseEntity<List<Songs>> getUserFavorites() {
        try {
            String userId = DemoUser.ID;
            List<Songs> favorites = favoriteService.getUserFavorites(userId);
            return ResponseEntity.ok(favorites);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * POST /api/favorites/{songId} - Add a song to favorites
     */
    @PostMapping("/{songId}")
    public ResponseEntity<Map<String, Object>> addFavorite(@PathVariable Long songId) {
        try {
            String userId = DemoUser.ID;
            favoriteService.addFavorite(userId, songId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Song added to favorites");
            response.put("songId", songId);
            
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to add favorite");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * DELETE /api/favorites/{songId} - Remove a song from favorites
     */
    @DeleteMapping("/{songId}")
    public ResponseEntity<Map<String, Object>> removeFavorite(@PathVariable Long songId) {
        try {
            String userId = DemoUser.ID;
            favoriteService.removeFavorite(userId, songId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Song removed from favorites");
            response.put("songId", songId);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to remove favorite");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * GET /api/favorites/check/{songId} - Check if a song is favorited
     */
    @GetMapping("/check/{songId}")
    public ResponseEntity<Map<String, Boolean>> checkFavorite(@PathVariable Long songId) {
        try {
            String userId = DemoUser.ID;
            boolean isFavorite = favoriteService.isFavorite(userId, songId);
            
            Map<String, Boolean> response = new HashMap<>();
            response.put("isFavorite", isFavorite);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * GET /api/favorites/count - Get count of user's favorites
     */
    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getFavoriteCount() {
        try {
            String userId = DemoUser.ID;
            long count = favoriteService.getFavoriteCount(userId);
            
            Map<String, Long> response = new HashMap<>();
            response.put("count", count);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * DELETE /api/favorites - Clear all favorites for current user
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> clearAllFavorites() {
        try {
            String userId = DemoUser.ID;
            favoriteService.clearAllFavorites(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "All favorites cleared");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to clear favorites");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}

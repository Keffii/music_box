package com.example.media_controller_iot.service;

import com.example.media_controller_iot.models.Favorite;
import com.example.media_controller_iot.repository.FavoriteRepository;
import com.example.media_controller_iot.repository.PlayerCommandLogRepo;
import com.example.media_controller_iot.repository.PlaylistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Moves what a visitor did as a guest (playlists, favourites, play history) to the account
 * they then sign in to or create, so nothing is lost by making an account.
 */
@Service
public class GuestClaimService {

    private final PlaylistRepository playlistRepository;
    private final FavoriteRepository favoriteRepository;
    private final PlayerCommandLogRepo commandLogRepository;

    public GuestClaimService(PlaylistRepository playlistRepository,
                             FavoriteRepository favoriteRepository,
                             PlayerCommandLogRepo commandLogRepository) {
        this.playlistRepository = playlistRepository;
        this.favoriteRepository = favoriteRepository;
        this.commandLogRepository = commandLogRepository;
    }

    @Transactional
    public Map<String, Integer> moveGuestData(String guestUserId, String userId) {
        int playlists = playlistRepository.reassignUser(guestUserId, userId);

        // A song can be a favourite only once per user: move the guest's favourites the account
        // doesn't have yet, and drop the duplicates
        int favorites = 0;
        for (Favorite favorite : favoriteRepository.findByUserId(guestUserId)) {
            Long songId = favorite.getSong().getId();
            if (favoriteRepository.existsByUserIdAndSongId(userId, songId)) {
                favoriteRepository.delete(favorite);
            } else {
                favorite.setUserId(userId);
                favoriteRepository.save(favorite);
                favorites++;
            }
        }

        int plays = commandLogRepository.reassignUser(guestUserId, userId);
        return Map.of("playlists", playlists, "favorites", favorites, "plays", plays);
    }
}

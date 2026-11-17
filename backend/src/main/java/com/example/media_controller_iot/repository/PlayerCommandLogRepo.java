package com.example.media_controller_iot.repository;

import com.example.media_controller_iot.models.PlayerCommandLog;
import com.example.media_controller_iot.models.Songs;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlayerCommandLogRepo extends JpaRepository<PlayerCommandLog, Long> {
    
    // Find recently played songs for a specific user (most recent play of each unique song)
    // Include PLAY, NEXT, and PREV commands to capture all song changes
    @Query("SELECT c.song FROM PlayerCommandLog c " +
           "WHERE c.userId = :userId AND c.command IN ('PLAY', 'NEXT', 'PREV') AND c.song IS NOT NULL " +
           "AND c.timestamp = (SELECT MAX(c2.timestamp) FROM PlayerCommandLog c2 " +
           "                   WHERE c2.userId = :userId AND c2.song = c.song " +
           "                   AND c2.command IN ('PLAY', 'NEXT', 'PREV')) " +
           "ORDER BY c.timestamp DESC")
    List<Songs> findRecentlyPlayedSongsByUserId(@Param("userId") String userId);

    /** Moves one user's play history to another (a guest's history to their new account) */
    @Modifying
    @Query("UPDATE PlayerCommandLog c SET c.userId = :toUserId WHERE c.userId = :fromUserId")
    int reassignUser(@Param("fromUserId") String fromUserId, @Param("toUserId") String toUserId);
}

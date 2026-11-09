package com.example.media_controller_iot.repository;

import com.example.media_controller_iot.models.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Long> {
    List<Playlist> findByUserIdOrderByCreatedAtDesc(String userId);

    /** Moves every playlist of one user to another (a guest's playlists to their new account) */
    @Modifying
    @Query("UPDATE Playlist p SET p.userId = :toUserId WHERE p.userId = :fromUserId")
    int reassignUser(@Param("fromUserId") String fromUserId, @Param("toUserId") String toUserId);
}

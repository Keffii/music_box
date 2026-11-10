package com.example.media_controller_iot.repository;

import com.example.media_controller_iot.models.Songs;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SongsRepo extends JpaRepository<Songs, Long> {
    List<Songs> findByCategory(String category);

    Optional<Songs> findFirstBySrcUrl(String srcUrl);

    /** Search box: matches the title, the artist or the genre */
    @Query("SELECT s FROM Songs s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(s.artist) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(s.category) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Songs> searchByTitleArtistOrCategory(@Param("query") String query);
}
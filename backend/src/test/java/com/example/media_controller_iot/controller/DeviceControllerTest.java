package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.Songs;
import com.example.media_controller_iot.repository.SongsRepo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeviceControllerTest {

    private static final String KEY = "test-device-key";

    @Autowired MockMvc mvc;
    @Autowired SongsRepo songsRepo;

    private String command(String cmd) {
        return "{\"command\":\"" + cmd + "\"}";
    }

    private void deviceCommand(String cmd) throws Exception {
        mvc.perform(post("/api/device/command").header("X-Device-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(command(cmd)))
                .andExpect(status().isOk());
    }

    @Test
    void stateNeedsTheDeviceKey() throws Exception {
        mvc.perform(get("/api/device/state")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/device/state").header("X-Device-Key", "wrong")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/device/state").header("X-Device-Key", KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").isString())
                .andExpect(jsonPath("$.artist").isString())
                .andExpect(jsonPath("$.category").isString())
                .andExpect(jsonPath("$.isPlaying").isBoolean())
                .andExpect(jsonPath("$.volume").isNumber())
                .andExpect(jsonPath("$.isMuted").isBoolean())
                .andExpect(jsonPath("$.shuffle").isBoolean())
                .andExpect(jsonPath("$.repeat").isBoolean())
                .andExpect(jsonPath("$.lastCommand").isString())
                .andExpect(jsonPath("$.seq").isNumber());
    }

    @Test
    void commandsNeedTheDeviceKey() throws Exception {
        mvc.perform(post("/api/device/command")
                        .contentType(MediaType.APPLICATION_JSON).content(command("NEXT")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void commandsChangeStateAndReturnIt() throws Exception {
        mvc.perform(post("/api/device/command").header("X-Device-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(command("VOLUME:42")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.volume").value(42))
                .andExpect(jsonPath("$.lastCommand").value("VOLUME:42"));

        mvc.perform(post("/api/device/command").header("X-Device-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(command("SELF_DESTRUCT")))
                .andExpect(status().isBadRequest());
    }

    /** No accounts: the remote and the web player control one shared player */
    @Test
    void theRemoteControlsTheSamePlayerAsTheWebPage() throws Exception {
        deviceCommand("VOLUME:17");
        mvc.perform(get("/api/player/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.volume").value(17))
                .andExpect(jsonPath("$.lastCommand").value("VOLUME:17"));

        // ...and the other way round
        mvc.perform(post("/api/player/command")
                        .contentType(MediaType.APPLICATION_JSON).content(command("VOLUME:63")))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/device/state").header("X-Device-Key", KEY))
                .andExpect(jsonPath("$.volume").value(63));
    }

    @Test
    void songsPlayedFromTheRemoteShowInRecentlyPlayed() throws Exception {
        Songs song = new Songs();
        song.setTitle("Remote Test Song");
        song.setArtist("Test");
        song.setCategory("Lofi");
        song.setSrcUrl("/media/remote-test.mp3");
        songsRepo.save(song);

        deviceCommand("NEXT");
        deviceCommand("PLAY");

        mvc.perform(get("/api/player/recently-played"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void theWebPlayerApiNeedsNoAccount() throws Exception {
        mvc.perform(get("/api/player/songs")).andExpect(status().isOk());
        mvc.perform(get("/api/playlists")).andExpect(status().isOk());
        mvc.perform(get("/api/favorites")).andExpect(status().isOk());
    }
}

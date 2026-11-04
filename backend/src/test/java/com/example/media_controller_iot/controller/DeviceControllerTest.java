package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.AppUser;
import com.example.media_controller_iot.repository.AppUserRepository;
import com.example.media_controller_iot.security.JwtService;
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
    @Autowired JwtService jwtService;
    @Autowired AppUserRepository users;

    private String command(String cmd) {
        return "{\"command\":\"" + cmd + "\"}";
    }

    @Test
    void stateNeedsTheDeviceKey() throws Exception {
        mvc.perform(get("/api/device/state")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/device/state").header("X-Device-Key", "wrong")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/device/state").header("X-Device-Key", KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.volume").isNumber())
                .andExpect(jsonPath("$.seq").isNumber())
                .andExpect(jsonPath("$.title").isString());
    }

    @Test
    void userTokenIsNotEnoughForTheDeviceApi() throws Exception {
        AppUser user = users.save(AppUser.builder().username("devtest").passwordHash("x").build());
        mvc.perform(get("/api/device/state").header("Authorization", "Bearer " + jwtService.issue(user)))
                .andExpect(status().isForbidden());
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

    @Test
    void deviceKeyDoesNotUnlockUserEndpoints() throws Exception {
        mvc.perform(get("/api/player/songs").header("X-Device-Key", KEY)).andExpect(status().isUnauthorized());
    }
}

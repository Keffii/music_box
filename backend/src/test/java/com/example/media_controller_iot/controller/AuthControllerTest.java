package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.repository.AppUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired MockMvc mvc;
    @Autowired AppUserRepository users;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void clean() {
        users.deleteAll();
    }

    private String body(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    }

    private String register(String username, String password) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body(username, password)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(response);
        return node.get("token").asText();
    }

    @Test
    void registerStoresBcryptHashAndReturnsWorkingToken() throws Exception {
        String token = register("kevin", "correct-horse");

        String hash = users.findByUsernameIgnoreCase("kevin").orElseThrow().getPasswordHash();
        assertThat(hash).startsWith("$2").doesNotContain("correct-horse");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("kevin"));
    }

    @Test
    void duplicateUsernameIsRejectedCaseInsensitively() throws Exception {
        register("kevin", "correct-horse");
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body("KEVIN", "another-pass")))
                .andExpect(status().isConflict());
    }

    @Test
    void invalidRegistrationsAreRejected() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body("ab", "correct-horse")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body("kevin", "short")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginChecksPassword() throws Exception {
        register("kevin", "correct-horse");

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(body("kevin", "correct-horse")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(body("kevin", "wrong-password")))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(body("nobody", "correct-horse")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointsNeedAValidToken() throws Exception {
        mvc.perform(get("/api/player/songs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/player/songs").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());

        String token = register("kevin", "correct-horse");
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("A") ? "BB" : "AA");
        mvc.perform(get("/api/player/songs").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/player/songs").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}

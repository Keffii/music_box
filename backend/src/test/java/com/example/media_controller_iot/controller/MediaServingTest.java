package com.example.media_controller_iot.controller;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MediaServingTest {

    @Autowired MockMvc mvc;

    @BeforeAll
    static void createFile() throws Exception {
        Path dir = Path.of("target/test-music");
        Files.createDirectories(dir);
        Files.write(dir.resolve("tone.mp3"), new byte[1000]);
    }

    @Test
    void mediaIsPublicAndSupportsRangeRequests() throws Exception {
        mvc.perform(get("/media/tone.mp3")).andExpect(status().isOk());
        mvc.perform(get("/media/tone.mp3").header("Range", "bytes=100-199"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Length", "100"));
    }

    @Test
    void missingMediaIs404AndTraversalIsBlocked() throws Exception {
        mvc.perform(get("/media/nope.mp3")).andExpect(status().isNotFound());
        mvc.perform(get("/media/../pom.xml")).andExpect(status().is4xxClientError());
    }
}

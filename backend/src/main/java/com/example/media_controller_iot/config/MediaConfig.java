package com.example.media_controller_iot.config;

import com.example.media_controller_iot.service.MediaStorage;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/** Serves the music folder at /media/** (with Range support, so seeking works). */
@Configuration
public class MediaConfig implements WebMvcConfigurer {

    private final MediaStorage storage;

    public MediaConfig(MediaStorage storage) {
        this.storage = storage;
    }

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        String location = storage.root().toUri().toString();
        if (!location.endsWith("/")) location += "/";
        registry.addResourceHandler(MediaStorage.URL_PREFIX + "**")
                .addResourceLocations(location)
                .setCacheControl(CacheControl.maxAge(1, TimeUnit.HOURS));
    }
}

package com.example.media_controller_iot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MediaControllerIotApplication {
	public static void main(String[] args) {
		SpringApplication.run(MediaControllerIotApplication.class, args);
	}
}

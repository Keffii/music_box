package com.example.media_controller_iot.service;

/**
 * The local demo has no accounts: everyone who opens the web player, and the ESP32 remote, share
 * one player and one library. Playlists, favourites and the play history are stored under this ID.
 */
public final class DemoUser {

    public static final String ID = "demo";

    private DemoUser() {
    }
}

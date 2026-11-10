# Music Box backend

Spring Boot 3 (Java 21) REST API for the Music Box player. The [main README](../README.md)
covers running the whole thing.

There are no accounts: every browser and the ESP32 remote control one shared player, and every
change is pushed to all of them over the player stream.

| Path | What it does |
|---|---|
| `GET /api/player/stream` | Server-sent events with the shared player's state, plus a heartbeat every 15 s |
| `GET /api/player/state` | The shared player's state |
| `POST /api/player/command` | `{"command":"NEXT"}` from the web player |
| `POST /api/player/playlist-queue` | Play a list of songs in order |
| `GET /api/player/songs`, `/songs/category/{c}`, `/songs/search?query=` | Library; search matches title, artist or genre |
| `GET /api/player/recently-played` | The shared play history (web player and remote together) |
| `/api/playlists/**`, `/api/favorites/**` | The shared playlists (create, rename, add, remove, delete) and favourites |
| `POST /api/files/upload/music`, `/upload/cover` | Upload into `<music folder>/uploads/` |
| `GET /media/**` | Files from the music folder (supports Range, for seeking) |
| `POST /api/device/command`, `GET /api/device/state` | ESP32 remote; needs the `X-Device-Key` header (else `401`) |

Configuration is in [`src/main/resources/application.properties`](src/main/resources/application.properties).
Every value can be overridden with an environment variable: `SPRING_DATASOURCE_*`, `MUSIC_DIR`,
`DEVICE_KEY` and `CORS_ALLOWED_ORIGINS`. By default the database is an H2 file in `data/`, so no
database server is needed.

```bash
./mvnw spring-boot:run     # http://localhost:8080, embedded database in data/
./mvnw test                # in-memory H2
```

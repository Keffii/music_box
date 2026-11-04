# Music Box backend

Spring Boot 3 (Java 21) REST API for the Music Box player. The [main README](../README.md)
covers running the whole stack.

| Path | What it does |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account or sign in. Both return `{token, userId, username}`. |
| `GET /api/auth/me` | The signed-in user |
| `GET /api/player/stream` | Server-sent events with the player state (public) |
| `POST /api/player/command` | `{"command":"NEXT"}` from the web player |
| `GET /api/player/songs`, `/songs/category/{c}`, `/songs/search?query=` | Library |
| `/api/playlists/**`, `/api/favorites/**` | Per-user playlists and favorites |
| `POST /api/files/upload/music`, `/upload/cover` | Upload into `music/uploads/` |
| `GET /media/**` | Files from the music folder (public, supports Range) |
| `POST /api/device/command`, `GET /api/device/state` | ESP32 remote; needs the `X-Device-Key` header |

Configuration is in [`src/main/resources/application.properties`](src/main/resources/application.properties).
Every value can be overridden with an environment variable: `SPRING_DATASOURCE_*`, `MUSIC_DIR`,
`DEVICE_KEY`, `JWT_SECRET`, `JWT_TTL_HOURS` and `CORS_ALLOWED_ORIGINS`.

```bash
./mvnw spring-boot:run     # needs MySQL, see the main README
./mvnw test                # in-memory H2, no MySQL needed
```

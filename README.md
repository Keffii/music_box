<p align="center">
  <img
    src="https://github.com/user-attachments/assets/c6afa18b-e0f7-463c-9f81-14609c0139a9"
    alt="Music Box logo"
    width="220"
    height="202"
  />
</p>
<h1 align="center">Music Box</h1>
<p align="center">
  <strong>A self-hosted music player for the browser, with a physical ESP32 WiFi remote for playback and volume.</strong>
</p>

Music Box runs entirely on your own machine: one `docker compose up` starts the database, the backend
and the web player, with no cloud accounts and no setup. A small ESP32 remote with five buttons, a
volume knob and a colour OLED controls the player over WiFi and shows what's playing.

> Music Box first ran on AWS (Amplify, Elastic Beanstalk, RDS, S3, Cognito). This version replaces
> each of those with a local equivalent, so it runs at no cost.

## Preview
<img src="https://github.com/user-attachments/assets/9fcbcc33-5b61-4bd5-86a5-4694c5369077" alt="Music Box application preview" width="100%"/>

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
git clone https://github.com/Keffii/music_box.git
cd music_box
docker compose up --build
```

Open <http://localhost:8080>, create an account (just a username and password) and you're in.

The library starts empty. To add the demo tracks, download them from Pixabay into the
[`music/`](music/) folder, following [music/README.md](music/README.md), then run
`docker compose restart backend`. Any other audio file you drop into `music/` is imported too.

To stop the stack, run `docker compose down`. Accounts, playlists and favorites are kept in a Docker volume.
`docker compose down -v` deletes them as well.

## Features
- Stream music from a local folder, imported automatically on startup
- Accounts with username and password (BCrypt hashes, JWT sessions)
- Playlists, favorites, search, genres and recently played
- Real-time sync: every open browser and the remote see the same player state (server-sent events)
- ESP32 WiFi remote: play/pause, next, previous, mute, seek +10 s, a volume knob, and a 128x96
  colour OLED showing the track, play state, volume and an animated equalizer
- Command and volume history logged to MySQL

## Architecture

```
 Browser ──http──▶ nginx (frontend container, :8080)
                    ├── /            React app (static files)
                    ├── /api/*  ──▶  Spring Boot backend ──▶ MySQL
                    └── /media/* ──▶       │
                                           └── ./music folder (mounted)
 ESP32 remote ──WiFi/http──▶ :8080/api/device/*  (X-Device-Key header)
```

| Part | Technology | Replaces |
|---|---|---|
| Web player | React + TypeScript, served by nginx | AWS Amplify |
| API | Spring Boot 3, Java 21 | Elastic Beanstalk |
| Database | MySQL 8 in Docker | RDS |
| Music files | Local `music/` folder, served at `/media` with Range support | S3 |
| Accounts | Users table with BCrypt, HS256 JWTs signed by the backend | Cognito |
| Remote | ESP32 over WiFi/HTTP with a shared device key | Bluetooth serial |

nginx serves the app and the API on one origin, so the browser needs no CORS setup, and the remote
can reach the API on the same port.

## Configuration

Everything works with the defaults. To change something, copy [`.env.example`](.env.example) to `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `WEB_PORT` | `8080` | Port for the web player and the remote |
| `DEVICE_KEY` | `musicbox-demo-key` | Shared key for the ESP32 remote. Change it if others share your network. |
| `JWT_SECRET` | random per start | Signing key for logins, at least 32 characters. Set it so logins survive backend restarts. |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | `musicbox` / `musicbox` / `musicbox-root` | Database credentials |

## ESP32 WiFi remote

<img width="695" alt="ESP32 Controller Diagram" src="https://github.com/user-attachments/assets/f7d478de-0e7f-420b-b9a4-987a25af09f8" />

The firmware is in [`esp32/`](esp32/): C on ESP-IDF, configured with `idf.py menuconfig` (WiFi,
server URL, device key, pins). [esp32/README.md](esp32/README.md) covers wiring, setup and
flashing.

You can drive the player the same way the remote does, with curl:

```bash
curl -X POST http://localhost:8080/api/device/command \
     -H "X-Device-Key: musicbox-demo-key" -H "Content-Type: application/json" \
     -d '{"command":"NEXT"}'
```

The commands are `PLAY`, `PAUSE`, `PLAY_PAUSE`, `NEXT`, `PREV`, `MUTE`, `SHUFFLE`, `REPEAT`,
`SEEK_FORWARD` and `VOLUME:<0-100>`. `GET /api/device/state` returns what's playing.

## Database
<img width="1539" alt="Database ER Diagram" src="https://github.com/user-attachments/assets/bbe7cc1b-f81e-4a0e-93bc-e209d112d77e" />

Hibernate creates the tables on startup. Users are now stored in the `app_users` table, with
BCrypt password hashes, instead of in Cognito.

## Security
- Passwords are hashed with BCrypt. Logins return a JWT signed with HS256 that expires after 7 days.
- Every API endpoint except login, register, the player event stream and `/media` needs a valid token.
- The remote authenticates with a shared key, compared in constant time. That key works only on
  `/api/device/*`, and a user token doesn't grant access there.
- This setup is meant for a home network. It serves plain HTTP, so put it behind a reverse proxy with
  TLS before exposing it to the internet.

## Development without Docker

```bash
# a MySQL to develop against (or point SPRING_DATASOURCE_URL / _USERNAME / _PASSWORD at your own)
docker run -d --name musicbox-dev-db -p 3307:3306 -e MYSQL_DATABASE=music_box \
  -e MYSQL_USER=musicbox -e MYSQL_PASSWORD=musicbox -e MYSQL_ROOT_PASSWORD=musicbox-root mysql:8.0

cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
./mvnw test                     # tests use an in-memory H2 database

cd frontend
npm install
npm start                       # http://localhost:3000, proxies /api and /media to :8080
```

For local runs, `application.properties` expects MySQL on `localhost:3307` with user and password
`musicbox`. The music folder is `../music` relative to `backend/`.

## Music
All demo tracks are royalty-free from Pixabay. The repository lists them in
[`music/tracks.json`](music/tracks.json) but doesn't contain the audio. See
[music/README.md](music/README.md) for the list and the download steps.

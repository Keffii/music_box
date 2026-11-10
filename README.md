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
  <strong>A self-hosted music player for the browser, with a physical ESP32 WiFi remote, all in sync.</strong>
</p>

Music Box runs entirely on your own machine. A small ESP32 remote with five buttons, a volume knob
and a colour OLED controls the player over WiFi. There are no accounts: every open browser and the
remote control **one shared player**, so pressing Next on the remote changes the song on its OLED
and on every website at once, and the other way round.

## Preview
<img src="https://github.com/user-attachments/assets/9fcbcc33-5b61-4bd5-86a5-4694c5369077" alt="Music Box application preview" width="100%"/>

## Quick start (no Docker)

You need Java 21 and Node.js 20. Nothing else: the backend uses an embedded database.

```bash
git clone https://github.com/Keffii/music_box.git
cd music_box

# terminal 1: the backend on http://localhost:8080
cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run

# terminal 2: the web player on http://localhost:3000
cd frontend
npm install
npm start
```

Open <http://localhost:3000>. The player opens straight away, with no sign-in.

The library starts empty. Put the demo tracks in the [`music/`](music/) folder, following
[music/README.md](music/README.md), and restart the backend. To use music somewhere else, point
`MUSIC_DIR` at that folder:

```bash
MUSIC_DIR=/path/to/my/music ./mvnw spring-boot:run              # macOS / Linux
set MUSIC_DIR=D:\my\music && mvnw.cmd spring-boot:run            # Windows (cmd)
```

Playlists, favourites and the play history are kept in `backend/data/` between restarts. Delete that
folder to start fresh.

### With Docker instead

`docker compose up --build` starts MySQL, the backend and nginx, and serves everything on
<http://localhost:8080>. `docker compose down -v` deletes the database volume.

## Features
- One shared player: the website, any number of browsers and the ESP32 remote stay in sync live
  (server-sent events). Every action on the remote shows up on the website, and the other way round.
- Genre pages, the whole library, search (by title, artist or genre), playlists you can rename and
  trim, favourites and recently played
- Page addresses for every page (`/genre/lofi`, `/playlist/3`, `/search?q=...`), with Back/Forward
- Works on phones and tablets
- Media keys, headphone buttons and the phone lock screen control the player
- Keyboard shortcuts: Space, arrows for seek and volume, M, S, R, L, `/` and `?` for the list
- Music imported from a local folder on startup, sorted into genre subfolders or not, with covers
- ESP32 WiFi remote: play/pause, next, previous, mute, seek +10 s, a volume knob, and a 128x96
  colour OLED showing the track, genre, play state, volume and an animated equalizer

## Architecture

```
 Browser ──http──▶ React app (dev server :3000, or nginx :8080 with Docker)
                    ├── /api/*   ──▶ Spring Boot backend :8080 ──▶ H2 file database (or MySQL)
                    └── /media/* ──▶       │
                                           └── music folder (MUSIC_DIR)
 ESP32 remote ──WiFi/http──▶ :8080/api/device/*  (X-Device-Key header)
```

| Part | Technology |
|---|---|
| Web player | React + TypeScript |
| API | Spring Boot 3, Java 21 |
| Database | H2 in a file by default, MySQL 8 with Docker |
| Music files | A local folder, served at `/media` with Range support for seeking |
| Remote | ESP32 over WiFi/HTTP with a shared device key |

The ESP32 talks to the backend directly on port 8080, so it works the same with or without Docker.

## Configuration

Everything works with the defaults. Set these as environment variables for the backend (or in a
`.env` file next to `docker-compose.yml`, see [`.env.example`](.env.example)):

| Variable | Default | Purpose |
|---|---|---|
| `MUSIC_DIR` | `../music` (relative to `backend/`) | The music folder to import and serve |
| `DEVICE_KEY` | `musicbox-demo-key` | Shared key for the ESP32 remote. It must match the firmware. Change it if others share your network. |
| `SPRING_DATASOURCE_URL` | H2 file in `backend/data/` | A MySQL URL to use MySQL instead |
| `WEB_PORT` | `8080` | Docker only: the port for the web player and the remote |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | `musicbox` / `musicbox` / `musicbox-root` | Docker only: database credentials |

## ESP32 WiFi remote

<img width="695" alt="ESP32 Controller Diagram" src="https://github.com/user-attachments/assets/f7d478de-0e7f-420b-b9a4-987a25af09f8" />

The firmware is in [`esp32/`](esp32/): C on ESP-IDF, configured with `idf.py menuconfig` (WiFi,
server URL, device key, pins). [esp32/README.md](esp32/README.md) covers wiring, setup and
flashing. Point it at `http://<this computer's LAN IP>:8080`.

The remote controls the same shared player as the website, so you can try it without the hardware,
with curl, and watch the website follow:

```bash
curl -X POST http://localhost:8080/api/device/command \
     -H "X-Device-Key: musicbox-demo-key" -H "Content-Type: application/json" \
     -d '{"command":"NEXT"}'
```

The commands are `PLAY`, `PAUSE`, `PLAY_PAUSE`, `NEXT`, `PREV`, `MUTE`, `SHUFFLE`, `REPEAT`,
`SEEK_FORWARD` and `VOLUME:<0-100>`. `GET /api/device/state` returns what the OLED shows: `title`,
`artist`, `category`, `isPlaying`, `volume`, `isMuted`, `shuffle`, `repeat`, `lastCommand` and
`seq`.

## Database
<img width="1539" alt="Database ER Diagram" src="https://github.com/user-attachments/assets/bbe7cc1b-f81e-4a0e-93bc-e209d112d77e" />

Hibernate creates the tables on startup. There are no user accounts: playlists, favourites and the
play history belong to one shared demo user.

## Security
- This is a demo for a home network. The web player's API has no login, and it serves plain HTTP.
  Don't expose it to the internet.
- The remote authenticates with a shared key, compared in constant time. A missing or wrong key
  gets `401`.

## Tests

```bash
cd backend && ./mvnw test        # an in-memory H2 database
cd frontend && npm test
```

## Music
All demo tracks are royalty-free from Pixabay. The repository lists them in
[`music/tracks.json`](music/tracks.json) but doesn't contain the audio. See
[music/README.md](music/README.md) for the list and the download steps.

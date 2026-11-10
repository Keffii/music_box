# Music folder

The backend imports this folder into the library every time it starts, and serves the files at `/media/...`.
To use a folder elsewhere, set `MUSIC_DIR` for the backend. Docker mounts this one at `/music`.

The repository has **no audio files**. The demo tracks are royalty-free from Pixabay, but the
[Pixabay Content License](https://pixabay.com/service/license-summary/) doesn't allow
redistributing them on their own, so each person downloads them from Pixabay.

## Getting the demo tracks

1. Open each link below and click **Download**. This is free, but Pixabay may ask you to sign in.
2. Put the `.mp3` files in this folder (`music/`), either directly or sorted into subfolders such
   as `music/Lofi/`. You don't need to rename them. The importer matches each file to its entry in
   [`tracks.json`](tracks.json) by, in order: the `file` name, the Pixabay id in the name (older
   downloads look like `penguinmusic-better-day-186374.mp3`), the `match` keywords or the short
   `file` name as whole words (current downloads look like `penguinmusic-better-day.mp3`), and
   last the title.
3. Restart the backend. New files show up in the library.

| Genre | Track | Artist | Link |
|---|---|---|---|
| Electronic | Better Day | penguinmusic | <https://pixabay.com/music/beats-better-day-186374/> |
| Electronic | Abstract Beauty | Grand_Project | <https://pixabay.com/music/upbeat-abstract-beauty-378257/> |
| Electronic | Cascade Breathe | NverAvetyanMusic | <https://pixabay.com/music/beats-cascade-breathe-future-garage-412839/> |
| Electronic | Running Night | Alex_MakeMusic | <https://pixabay.com/music/funk-running-night-393139/> |
| Lofi | Coffee Lofi | Lofi_Music_Library | <https://pixabay.com/music/lofi-coffee-lofi-lofi-music-chill-ambient-458900/> |
| Lofi | Good Night Lofi | FASSounds | <https://pixabay.com/music/beats-good-night-lofi-cozy-chill-music-160166/> |
| Lofi | Lofi Study | FASSounds | <https://pixabay.com/music/beats-lofi-study-calm-peaceful-chill-hop-112191/> |
| Lofi | Lofi Chill | DELOSound | <https://pixabay.com/music/lofi-lofi-lofi-chill-lofi-girl-456265/> |
| Hiphop | Hype Drill Music | kontraa | <https://pixabay.com/music/trap-hype-drill-music-438398/> |
| Hiphop | Lonewolf Dark Trap | onesevenbeatxs | <https://pixabay.com/music/trap-lonewolf-dark-hard-sad-trap-beat-prod-by-onesevenbeatxs-156895/> |
| Hiphop | Hip Hop Beat | NastelBom | <https://pixabay.com/music/beats-hiphop-427992/> |
| Hiphop | Energetic Hip Hop | Skilsel | <https://pixabay.com/music/beats-energetic-hip-hop-8303/> |
| Trance | Trance Dance Club | lNPLUSMUSIC | <https://pixabay.com/music/upbeat-trance-dance-club-music-409571/> |
| Trance | Trance | Playsound | <https://pixabay.com/music/techno-trance-trance-123192/> |
| Trance | Smart Factory | The_Mountain | <https://pixabay.com/music/dance-trance-137032/> |
| Trance | Pure Trance | DJDoblina | <https://pixabay.com/music/electro-pure-trance-459528/> |

You don't need all 16. Tracks without a file are skipped, and the backend log lists which ones are missing.

## Covers (optional)

To give a track a cover, use one of these (`jpg`, `jpeg`, `png` or `webp`):

- an image with the same base name, next to the audio or anywhere else in the folder, for example a
  parallel tree: `music/Lofi/fassounds-lofi-study-calm-peaceful-chill-hop.mp3` and
  `cover/Lofi/fassounds-lofi-study-calm-peaceful-chill-hop.jpg`
- an image whose name contains one of the track's `match` keywords
- `"cover": "covers/better-day.jpg"` in `tracks.json`

Tracks without a cover show a generated placeholder.

## Your own music

Any other audio file (`mp3`, `ogg`, `wav`, `m4a`, `aac`, `flac`) in this folder is imported too. Its title
comes from the file name and it goes under the category "Other". To set a proper title, artist and
category, add an entry for it to `tracks.json`.

Files uploaded through the API are saved in `uploads/`. This folder's audio files, images and
`uploads/` are all git-ignored.

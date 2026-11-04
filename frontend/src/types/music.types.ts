export interface Song {
  id: number;
  title: string;
  artist: string;
  srcUrl: string;
  coverUrl: string;
  category?: string;
}

export interface ServerState {
  title: string | null;
  artist: string | null;
  shuffle: boolean;
  repeat: boolean;
  volume: number;
  isMuted: boolean;
  currentSongId: number | null;
  isPlaying: boolean;
  lastCommand?: string;
  seq: number;
}

export interface PlayerState {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  shuffleEnabled: boolean;
  repeatEnabled: boolean;
  songTitle: string;
  songArtist: string;
  coverUrl: string;
}

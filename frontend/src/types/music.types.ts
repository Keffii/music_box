export interface Song {
  id: number;
  title: string;
  artist: string;
  srcUrl: string;
  coverUrl: string;
  category?: string;
}

export interface ServerState {
  title: string;
  artist: string;
  shuffle: boolean;
  repeat: boolean;
  volume: number;
  isMuted: boolean;
  currentSongId: number;
  isPlaying: boolean;
  lastCommand?: string;
  commandSeq?: number;
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

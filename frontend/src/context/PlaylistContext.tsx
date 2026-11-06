import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getPlaylists, createPlaylist as createPlaylistAPI, deletePlaylist as deletePlaylistAPI, renamePlaylist as renamePlaylistAPI } from '../services/playerService';

interface Playlist {
  id: number;
  name: string;
  userId: string;
  createdAt: string;
  songCount: number;
}

interface PlaylistContextType {
  playlists: Playlist[];
  loading: boolean;
  createPlaylist: (name: string) => Promise<boolean>;
  deletePlaylist: (playlistId: number) => Promise<boolean>;
  renamePlaylist: (playlistId: number, name: string) => Promise<boolean>;
  refreshPlaylists: () => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export const PlaylistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPlaylists = async () => {
    setLoading(true);
    const data = await getPlaylists();
    setPlaylists(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const createPlaylist = async (name: string): Promise<boolean> => {
    const success = await createPlaylistAPI(name);
    if (success) {
      await loadPlaylists();
    }
    return success;
  };

  const deletePlaylist = async (playlistId: number): Promise<boolean> => {
    const success = await deletePlaylistAPI(playlistId);
    if (success) {
      await loadPlaylists();
    }
    return success;
  };

  const renamePlaylist = async (playlistId: number, name: string): Promise<boolean> => {
    const success = await renamePlaylistAPI(playlistId, name);
    if (success) {
      await loadPlaylists();
    }
    return success;
  };

  const refreshPlaylists = async () => {
    await loadPlaylists();
  };

  return (
    <PlaylistContext.Provider value={{ playlists, loading, createPlaylist, deletePlaylist, renamePlaylist, refreshPlaylists }}>
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylists = (): PlaylistContextType => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistProvider');
  }
  return context;
};

import { API_BASE } from '../utils/constants';
import { authFetch } from './authService';

export const sendCommand = async (cmd: string): Promise<void> => {
  try {
    await authFetch(`${API_BASE}/api/player/command`, {
      method: 'POST',
      body: JSON.stringify({ command: cmd })
    });
    console.log('Command sent:', cmd);
  } catch (error) {
    console.error('Failed to send command:', error);
  }
};

export const loadSongs = async () => {
  try {
    const res = await authFetch(`${API_BASE}/api/player/songs`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to load songs:', error);
    return [];
  }
};

export const loadSongsByCategory = async (category: string) => {
  try {
    const res = await authFetch(`${API_BASE}/api/player/songs/category/${encodeURIComponent(category)}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Failed to load songs for category ${category}:`, error);
    return [];
  }
};

export const searchSongs = async (query: string) => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const res = await authFetch(`${API_BASE}/api/player/songs/search?query=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Failed to search songs for query "${query}":`, error);
    return [];
  }
};

export const getRecentlyPlayed = async () => {
  try {
    const res = await authFetch(`${API_BASE}/api/player/recently-played`);
    if (!res.ok) {
      throw new Error(`Failed to fetch recently played: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Failed to load recently played:', error);
    return [];
  }
};

// Favorites API
export const getFavorites = async () => {
  try {
    const res = await authFetch(`${API_BASE}/api/favorites`);
    if (!res.ok) {
      throw new Error(`Failed to fetch favorites: ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Failed to load favorites:', error);
    return [];
  }
};

export const addFavorite = async (songId: number): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/favorites/${songId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to add favorite: ${res.status}`);
    }
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Failed to add favorite:', error);
    return false;
  }
};

export const removeFavorite = async (songId: number): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/favorites/${songId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to remove favorite: ${res.status}`);
    }
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return false;
  }
};

export const checkFavorite = async (songId: number): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/favorites/check/${songId}`);
    if (!res.ok) {
      throw new Error(`Failed to check favorite: ${res.status}`);
    }
    const data = await res.json();
    return data.isFavorite;
  } catch (error) {
    console.error('Failed to check favorite:', error);
    return false;
  }
};

// Playlist API
export const getPlaylists = async () => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists/with-counts`);
    if (!res.ok) {
      throw new Error(`Failed to fetch playlists: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Failed to load playlists:', error);
    return [];
  }
};

export const createPlaylist = async (name: string): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to create playlist:', error);
    return false;
  }
};

export const deletePlaylist = async (playlistId: number): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists/${playlistId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to delete playlist:', error);
    return false;
  }
};

export const addSongToPlaylist = async (playlistId: number, songId: number): Promise<{ success: boolean; playlistName?: string; alreadyExists?: boolean }> => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists/${playlistId}/songs/${songId}`, {
      method: 'POST',
    });
    
    if (res.ok) {
      const data = await res.json();
      // Fetch the playlist name for the toast
      const playlistsRes = await authFetch(`${API_BASE}/api/playlists`);
      if (playlistsRes.ok) {
        const playlists = await playlistsRes.json();
        const playlist = playlists.find((p: any) => p.id === playlistId);
        return { 
          success: true, 
          playlistName: playlist?.name,
          alreadyExists: data.alreadyExists || false
        };
      }
      return { success: true, alreadyExists: data.alreadyExists || false };
    }
    return { success: false };
  } catch (error) {
    console.error('Failed to add song to playlist:', error);
    return { success: false };
  }
};

export const removeSongFromPlaylist = async (playlistId: number, songId: number): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to remove song from playlist:', error);
    return false;
  }
};

export const getPlaylistSongs = async (playlistId: number) => {
  try {
    const res = await authFetch(`${API_BASE}/api/playlists/${playlistId}/songs`);
    if (!res.ok) {
      throw new Error(`Failed to fetch playlist songs: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Failed to load playlist songs:', error);
    return [];
  }
};

export const setPlaylistQueue = async (songIds: number[]): Promise<boolean> => {
  try {
    const res = await authFetch(`${API_BASE}/api/player/playlist-queue`, {
      method: 'POST',
      body: JSON.stringify({ songIds })
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to set playlist queue:', error);
    return false;
  }
};

export const playSpecificSong = async (songId: number, queueSongIds: number[]): Promise<boolean> => {
  try {
    
    // Reorder the queue so the clicked song is first
    const clickedIndex = queueSongIds.indexOf(songId);
    if (clickedIndex === -1) return false;
    
    // Create new queue with clicked song first, followed by rest of the songs
    const reorderedQueue = [
      queueSongIds[clickedIndex],
      ...queueSongIds.slice(clickedIndex + 1),
      ...queueSongIds.slice(0, clickedIndex)
    ];
    
    // Set the reordered queue - backend will automatically start playing the first song
    const res = await authFetch(`${API_BASE}/api/player/playlist-queue`, {
      method: 'POST',
      body: JSON.stringify({ songIds: reorderedQueue })
    });
    
    return res.ok;
  } catch (error) {
    console.error('Failed to play specific song:', error);
    return false;
  }
};


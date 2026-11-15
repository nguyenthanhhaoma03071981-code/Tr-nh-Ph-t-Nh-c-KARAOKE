export interface PlayedSong {
  id: string; // YouTube video ID
  url: string; // Original or canonical YouTube URL
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // in seconds
  playedAt: number;
}

export type RepeatMode = 'off' | 'one' | 'all';
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export type ViewMode = 'audio' | 'video';

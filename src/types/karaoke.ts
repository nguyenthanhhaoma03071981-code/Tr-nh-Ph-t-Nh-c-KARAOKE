export type KaraokeGrade = 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B';

export interface KaraokeScore {
  id: string;
  songId: string;
  songTitle: string;
  singerName?: string;
  totalScore: number; // 80 - 100
  grade: KaraokeGrade;
  rankTitle: string;
  feedback: string;
  pitchScore: number;
  rhythmScore: number;
  energyScore: number;
  emotionScore: number;
  singingDurationSeconds: number;
  scoredAt: number;
}

export interface KaraokeConfig {
  autoScoreEnabled: boolean; // Tự động chấm khi hết bài (mặc định Bật)
  soundEffectsEnabled: boolean; // Âm thanh chúc mừng / vỗ tay (mặc định Bật)
  micEnabled: boolean; // Sử dụng micro thật
  strictness: 'easy' | 'standard' | 'pro'; // Độ khó chấm điểm
}

export interface MicAudioStats {
  volume: number; // 0 - 100
  pitchHz: number; // 0 - 1000 Hz
  pitchConfidence: number; // 0 - 1
  isSinging: boolean;
  totalSingingFrames: number;
  totalSongFrames: number;
  averageVolume: number;
  peakVolume: number;
  pitchStability: number; // 0 - 100
  goodNotesCount: number;
}

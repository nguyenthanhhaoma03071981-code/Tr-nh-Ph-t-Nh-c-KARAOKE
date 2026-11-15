import React from 'react';
import { Trophy, Award, Power } from 'lucide-react';
import { KaraokeConfig, MicAudioStats } from '../types/karaoke';

interface KaraokeScoreControlProps {
  config: KaraokeConfig;
  onUpdateConfig: (newConfig: Partial<KaraokeConfig>) => void;
  audioStats?: MicAudioStats;
  isMicActive?: boolean;
  onToggleMic?: () => void;
  onInstantScore: (singerName?: string) => void;
  onOpenLeaderboard: () => void;
  scoresCount: number;
  isSongPlaying: boolean;
}

export const KaraokeScoreControl: React.FC<KaraokeScoreControlProps> = ({
  config,
  onUpdateConfig,
  onInstantScore,
  onOpenLeaderboard,
  scoresCount
}) => {
  const isEnabled = config.autoScoreEnabled;

  const handleToggleScoring = () => {
    onUpdateConfig({ autoScoreEnabled: !isEnabled });
  };

  return (
    <div
      className={`rounded-2xl px-4 py-3 shadow-lg border transition-all duration-200 flex flex-wrap items-center justify-between gap-3 ${
        isEnabled
          ? 'bg-neutral-900/95 border-amber-500/50 shadow-amber-950/20'
          : 'bg-neutral-900/60 border-neutral-800/80'
      }`}
    >
      {/* Left: "Chấm điểm" + Nút Tắt / Mở */}
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            isEnabled
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              : 'bg-neutral-800 border border-neutral-700 text-neutral-500'
          }`}
        >
          <Trophy className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-white">Chấm điểm</span>

          {/* Nút Công Tắc TẮT / MỞ */}
          <button
            type="button"
            onClick={handleToggleScoring}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
              isEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-md shadow-emerald-950/50'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border-neutral-700'
            }`}
            title={isEnabled ? 'Nhấn để TẮT chấm điểm' : 'Nhấn để MỞ chấm điểm khi hát'}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isEnabled ? 'ĐANG MỞ' : 'ĐANG TẮT'}</span>
          </button>

          <span className="hidden sm:inline text-xs text-neutral-400">
            {isEnabled
              ? 'Tự động chấm điểm khi hết bài'
              : 'Khi nào hát hãy bấm MỞ để chấm điểm'}
          </span>
        </div>
      </div>

      {/* Right: Nút Chấm Điểm Ngay & Bảng Điểm (Chỉ hiện nổi bật khi Mở) */}
      <div className="flex items-center gap-2 ml-auto">
        {isEnabled && (
          <button
            type="button"
            onClick={() => onInstantScore()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            title="Chấm điểm ngay lập tức"
          >
            <Trophy className="w-3.5 h-3.5 text-neutral-950" />
            <span>Chấm điểm ngay</span>
          </button>
        )}

        {scoresCount > 0 && (
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-medium transition-all cursor-pointer"
            title="Xem lịch sử điểm"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Bảng điểm ({scoresCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};

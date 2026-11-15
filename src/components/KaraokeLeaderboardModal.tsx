import React from 'react';
import { Trophy, Award, Trash2, X, Music, Calendar, Flame, Star } from 'lucide-react';
import { KaraokeScore } from '../types/karaoke';

interface KaraokeLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  scores: KaraokeScore[];
  onClearScores: () => void;
  onSelectSongToPlay?: (songId: string, songTitle: string) => void;
}

export const KaraokeLeaderboardModal: React.FC<KaraokeLeaderboardModalProps> = ({
  isOpen,
  onClose,
  scores,
  onClearScores,
  onSelectSongToPlay
}) => {
  if (!isOpen) return null;

  // Sort descending by totalScore
  const sortedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Bảng Vàng Điểm Số Karaoke</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {scores.length} lượt hát
                </span>
              </h3>
              <p className="text-xs text-neutral-400">Thành tích các ca sĩ trong buổi tiệc</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="my-4 max-h-[55vh] overflow-y-auto space-y-2.5 pr-1">
          {sortedScores.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Music className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-300">Chưa có bài hát nào được chấm điểm</p>
              <p className="text-xs text-neutral-500 mt-1">
                Hãy bật nhạc và hát một bài, hệ thống sẽ tự động chấm điểm và vinh danh tại đây!
              </p>
            </div>
          ) : (
            sortedScores.map((item, idx) => {
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;

              let rankBadgeClass = 'bg-neutral-800 text-neutral-400';
              if (isTop1) rankBadgeClass = 'bg-amber-500 text-neutral-950 font-black shadow-lg shadow-amber-500/30';
              else if (isTop2) rankBadgeClass = 'bg-neutral-300 text-neutral-900 font-bold';
              else if (isTop3) rankBadgeClass = 'bg-amber-700 text-amber-100 font-bold';

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isTop1
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                      : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadgeClass}`}>
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                        {item.songTitle}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                        <span className="text-emerald-400 font-medium">
                          {item.singerName || 'Ca sĩ'}
                        </span>
                        <span>•</span>
                        <span>{new Date(item.scoredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="text-amber-300 font-medium">{item.grade}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-xl font-black text-amber-400">
                        {item.totalScore}
                      </span>
                      <span className="text-[10px] text-neutral-500 block font-mono">/100</span>
                    </div>

                    {onSelectSongToPlay && (
                      <button
                        onClick={() => {
                          onSelectSongToPlay(item.songId, item.songTitle);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium cursor-pointer"
                        title="Hát lại bài này"
                      >
                        Hát lại
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs">
          {scores.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc muốn xoá lịch sử điểm số karaoke này không?')) {
                  onClearScores();
                }
              }}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa lịch sử</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

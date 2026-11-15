import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Star, Sparkles, Award, Music, RotateCcw, SkipForward, X, Volume2, VolumeX, Flame } from 'lucide-react';
import { KaraokeScore } from '../types/karaoke';
import { soundEffects } from '../utils/karaokeAudio';
import { triggerKaraokeConfetti } from '../utils/confetti';

interface KaraokeScoreModalProps {
  score: KaraokeScore | null;
  isOpen: boolean;
  onClose: () => void;
  onReplay?: () => void;
  onNextSong?: () => void;
  soundEnabled?: boolean;
  autoDismissSeconds?: number;
}

export const KaraokeScoreModal: React.FC<KaraokeScoreModalProps> = ({
  score,
  isOpen,
  onClose,
  onReplay,
  onNextSong,
  soundEnabled = true,
  autoDismissSeconds = 12
}) => {
  const [displayedScore, setDisplayedScore] = useState<number>(0);
  const [isCountingFinished, setIsCountingFinished] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(autoDismissSeconds);
  const [isPausedCountdown, setIsPausedCountdown] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !score) {
      setDisplayedScore(0);
      setIsCountingFinished(false);
      setCountdown(autoDismissSeconds);
      return;
    }

    setCountdown(autoDismissSeconds);
    setIsPausedCountdown(false);
    setIsCountingFinished(false);

    const targetScore = score.totalScore;
    const duration = 2000;
    const startTime = performance.now();

    const animateRoll = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(eased * targetScore);

      setDisplayedScore(currentVal);

      if (progress < 1) {
        if (soundEnabled && Math.random() > 0.4) {
          soundEffects.playTick(500 + currentVal * 8);
        }
        animFrameRef.current = requestAnimationFrame(animateRoll);
      } else {
        setDisplayedScore(targetScore);
        setIsCountingFinished(true);

        triggerConfetti(targetScore);
        if (soundEnabled) {
          soundEffects.playFanfare(targetScore);
          setTimeout(() => {
            soundEffects.playApplause();
          }, 600);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animateRoll);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, score, soundEnabled, autoDismissSeconds]);

  useEffect(() => {
    if (!isOpen || !isCountingFinished || isPausedCountdown || autoDismissSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isCountingFinished, isPausedCountdown, autoDismissSeconds, onClose]);

  const triggerConfetti = (totalScore: number) => {
    try {
      const isPerfect = totalScore >= 96;
      triggerKaraokeConfetti(isPerfect);
      if (isPerfect) {
        setTimeout(() => triggerKaraokeConfetti(true), 400);
      }
    } catch {}
  };

  if (!isOpen || !score) return null;

  const isGoldScore = score.totalScore >= 95;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 select-none overflow-y-auto"
      onClick={() => setIsPausedCountdown(true)}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full blur-[120px] opacity-40 transition-all duration-700 ${
          isGoldScore ? 'bg-amber-500/40' : 'bg-emerald-500/35'
        }`} />
      </div>

      <div className="relative w-full max-w-xl bg-gradient-to-b from-neutral-900 via-neutral-900/95 to-neutral-950 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(245,158,11,0.25)] text-white text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer z-10"
          title="Đóng (ESC)"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs uppercase tracking-widest shadow-inner mb-3 animate-pulse">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>KẾT QUẢ CHẤM ĐIỂM KARAOKE</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-1 max-w-md mx-auto mb-1">
          {score.songTitle}
        </h2>
        <p className="text-xs text-neutral-400 font-medium mb-4 flex items-center justify-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-emerald-400" />
          <span>Biểu diễn: <strong className="text-neutral-200">{score.singerName || 'Ca sĩ bạn thân'}</strong></span>
        </p>

        <div className="relative my-4 py-5 px-6 rounded-2xl bg-neutral-950/80 border border-neutral-800 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />

          <span className="text-xs uppercase tracking-wider text-neutral-400 font-mono font-semibold mb-1">
            Tổng Điểm Đạt Được
          </span>

          <div className="flex items-baseline justify-center gap-2">
            <span
              className={`font-mono text-7xl sm:text-8xl font-black tracking-tight drop-shadow-[0_0_35px_rgba(245,158,11,0.6)] ${
                isGoldScore ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {displayedScore}
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-neutral-500 font-mono">
              /100
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-xl text-sm font-black border uppercase shadow-lg ${
              score.grade === 'S+' || score.grade === 'S'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-amber-500/20'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-emerald-500/20'
            }`}>
              <Award className="w-4 h-4" />
              <span>Hạng {score.grade}</span>
            </span>

            <span className="text-xs font-bold text-amber-200 flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
              <span>{score.rankTitle}</span>
            </span>
          </div>
        </div>

        <div className="my-3 px-4 py-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-xs sm:text-sm text-neutral-200 italic font-medium leading-relaxed">
          &ldquo;{score.feedback}&rdquo;
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col">
            <span className="text-[11px] text-neutral-400 font-medium">🎵 Cao Độ</span>
            <span className="text-base font-bold text-sky-400 font-mono mt-0.5">{score.pitchScore}%</span>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-sky-400 h-full rounded-full transition-all duration-1000" style={{ width: `${score.pitchScore}%` }} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col">
            <span className="text-[11px] text-neutral-400 font-medium">⏱️ Nhịp Điệu</span>
            <span className="text-base font-bold text-emerald-400 font-mono mt-0.5">{score.rhythmScore}%</span>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full transition-all duration-1000" style={{ width: `${score.rhythmScore}%` }} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col">
            <span className="text-[11px] text-neutral-400 font-medium">⚡ Nội Lực</span>
            <span className="text-base font-bold text-amber-400 font-mono mt-0.5">{score.energyScore}%</span>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full transition-all duration-1000" style={{ width: `${score.energyScore}%` }} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex flex-col">
            <span className="text-[11px] text-neutral-400 font-medium">💖 Cảm Xúc</span>
            <span className="text-base font-bold text-rose-400 font-mono mt-0.5">{score.emotionScore}%</span>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-rose-400 h-full rounded-full transition-all duration-1000" style={{ width: `${score.emotionScore}%` }} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {onReplay && (
            <button
              onClick={() => {
                onClose();
                onReplay();
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Hát Lại Bài Này</span>
            </button>
          )}

          {onNextSong && (
            <button
              onClick={() => {
                onClose();
                onNextSong();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <span>Hát Bài Tiếp Theo</span>
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>

        {autoDismissSeconds > 0 && isCountingFinished && (
          <p className="mt-3 text-[11px] text-neutral-500">
            {isPausedCountdown ? (
              <span>Đã tạm dừng tự động đóng • Bấm Đóng khi sẵn sàng</span>
            ) : (
              <span>Tự động chuyển tiếp sau <strong className="text-amber-400 font-mono">{countdown}s</strong> (Bấm chuột để dừng đếm ngược)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
};

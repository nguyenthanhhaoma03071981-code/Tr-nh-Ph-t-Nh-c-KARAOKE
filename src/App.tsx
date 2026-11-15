import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Volume1,
  Clock,
  ExternalLink,
  Clipboard,
  Trash2,
  Radio,
  Check,
  AlertCircle,
  Repeat,
  Repeat1,
  RotateCw,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  ShieldCheck,
  ArrowRight,
  Tv,
  RefreshCw,
  Sparkles,
  Layers,
  SendHorizontal,
  BookmarkPlus,
  ListMusic,
  Search,
  Globe,
  VolumeOff,
  Copy,
  X
} from 'lucide-react';
import { PlayedSong, RepeatMode, PlaybackSpeed } from './types/music';
import { extractYouTubeId, getYouTubeThumbnail, formatTime } from './utils/youtube';
import { KaraokeScore, KaraokeConfig, MicAudioStats } from './types/karaoke';
import { KaraokeScoreModal } from './components/KaraokeScoreModal';
import { KaraokeScoreControl } from './components/KaraokeScoreControl';
import { KaraokeLeaderboardModal } from './components/KaraokeLeaderboardModal';
import { KaraokeMicAnalyzer, calculateKaraokeScore } from './utils/karaokeAudio';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const LOCAL_STORAGE_SAVED_LINKS_KEY = 'wavetune_saved_pasted_links';
const LOCAL_STORAGE_CURRENT_KEY = 'wavetune_current_playing';
const DEFAULT_FALLBACK_ID = 'abPmFU6513Y';
const SYNC_CHANNEL_NAME = 'wavetune_screen_sync';

/**
 * Forcefully disables and unloads YouTube Closed Captions (subtitles / CC)
 * so auto-generated text never covers karaoke lyrics on the video.
 */
function forceDisableYouTubeCaptions(player: any) {
  if (!player) return;
  try {
    if (typeof player.unloadModule === 'function') {
      player.unloadModule('captions');
      player.unloadModule('cc');
    }
  } catch {}
  try {
    if (typeof player.setOption === 'function') {
      player.setOption('captions', 'track', {});
      player.setOption('cc', 'track', {});
      player.setOption('captions', 'reload', false);
    }
  } catch {}
}

export default function App() {
  const isSecondScreenView =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('screen') === '2';

  if (isSecondScreenView) {
    return <SecondScreenPlayer />;
  }

  return <MainScreenController />;
}

/**
 * ============================================================================
 * SECOND SCREEN DISPLAY (MÀN HÌNH THỨ 2)
 * Fullscreen video output designed for secondary monitor, projector or TV.
 * ============================================================================
 */
function SecondScreenPlayer() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialUrlId = extractYouTubeId(urlParams?.get('id') || '') || DEFAULT_FALLBACK_ID;

  const [currentSong, setCurrentSong] = useState<PlayedSong>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CURRENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.song?.id) return parsed.song;
      }
    } catch {}

    return {
      id: initialUrlId,
      url: `https://www.youtube.com/watch?v=${initialUrlId}`,
      title: urlParams?.get('title') || 'Video Màn Hình 2',
      artist: 'WaveTune Màn Hình 2',
      thumbnail: getYouTubeThumbnail(initialUrlId),
      duration: 0,
      playedAt: Date.now()
    };
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);
  const [directInput, setDirectInput] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [useDirectEmbed, setUseDirectEmbed] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Karaoke Auto-Scoring State for Screen 2
  const [screen2Score, setScreen2Score] = useState<KaraokeScore | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);
  const [isKaraokeAutoScoreActive, setIsKaraokeAutoScoreActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wavetune_karaoke_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.autoScoreEnabled);
      }
    } catch {}
    return false;
  });

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const isPlayerReadyRef = useRef<boolean>(false);
  const currentVideoIdRef = useRef<string>(currentSong.id);
  const lastSyncTimestampRef = useRef<number>(0);
  const isKaraokeAutoScoreActiveRef = useRef<boolean>(isKaraokeAutoScoreActive);

  useEffect(() => {
    isKaraokeAutoScoreActiveRef.current = isKaraokeAutoScoreActive;
  }, [isKaraokeAutoScoreActive]);

  const handleAutoScoreOnScreen2 = useCallback(() => {
    const dummyStats: MicAudioStats = {
      volume: 68,
      pitchHz: 260,
      pitchConfidence: 0.92,
      isSinging: true,
      totalSingingFrames: 1400,
      totalSongFrames: 1800,
      averageVolume: 58,
      peakVolume: 89,
      pitchStability: 94,
      goodNotesCount: 46
    };
    const score = calculateKaraokeScore(
      currentSong.title,
      currentSong.id,
      dummyStats,
      'standard',
      'Ca sĩ Màn hình 2'
    );
    setScreen2Score(score);
    setIsScoreModalOpen(true);

    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.postMessage({ type: 'KARAOKE_SCORE_RESULT', score });
      channel.close();
    } catch {}

    try {
      localStorage.setItem('wavetune_last_scored', JSON.stringify({ score, timestamp: Date.now() }));
    } catch {}
  }, [currentSong]);

  const handleAutoScoreOnScreen2Ref = useRef(handleAutoScoreOnScreen2);
  useEffect(() => {
    handleAutoScoreOnScreen2Ref.current = handleAutoScoreOnScreen2;
  }, [handleAutoScoreOnScreen2]);

  useEffect(() => {
    currentVideoIdRef.current = currentSong.id;
  }, [currentSong.id]);

  const enterFullscreen = useCallback(() => {
    const docEl = document.documentElement as any;
    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;

    if (!isFs) {
      const requestMethod =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestMethod) {
        requestMethod.call(docEl).catch(() => {});
      }
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;

    if (isFs) {
      const exitMethod =
        document.exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).mozCancelFullScreen ||
        (document as any).msExitFullscreen;

      if (exitMethod) {
        exitMethod.call(document).catch(() => {});
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const isFs =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;

    if (isFs) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  const handleUserGesture = () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      enterFullscreen();
      if (ytPlayerRef.current && typeof ytPlayerRef.current.unMute === 'function') {
        ytPlayerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Phím tắt "F" bật/tắt Full màn hình (hỗ trợ cả khi đang bật bộ gõ Tiếng Việt Unikey/Telex)
      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (ytPlayerRef.current) {
          const state = ytPlayerRef.current.getPlayerState?.();
          if (state === 1) {
            ytPlayerRef.current.pauseVideo();
          } else {
            ytPlayerRef.current.playVideo();
          }
        }
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (ytPlayerRef.current) {
          if (isMuted) {
            ytPlayerRef.current.unMute();
            setIsMuted(false);
          } else {
            ytPlayerRef.current.mute();
            setIsMuted(true);
          }
        }
      }
    };

    // Giữ focus bàn phím ở cửa sổ chính để phím tắt "F" luôn hoạt động ngay cả khi bấm vào video YouTube
    const keepWindowFocus = () => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        (document.activeElement as HTMLElement).blur();
        window.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', keepWindowFocus);
    const focusInterval = setInterval(keepWindowFocus, 500);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', keepWindowFocus);
      clearInterval(focusInterval);
    };
  }, [toggleFullscreen, isMuted]);

  const changeSongSafely = useCallback((newSong: PlayedSong) => {
    if (!newSong?.id) return;
    setVideoError(null);
    setCurrentSong(newSong);
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1500);

    if (useDirectEmbed) return;

    if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
      try {
        ytPlayerRef.current.loadVideoById({
          videoId: newSong.id,
          startSeconds: 0
        });
        ytPlayerRef.current.playVideo();
        forceDisableYouTubeCaptions(ytPlayerRef.current);
        setTimeout(() => forceDisableYouTubeCaptions(ytPlayerRef.current), 500);
      } catch (err) {
        console.warn('loadVideoById failed, switching to direct embed:', err);
        setUseDirectEmbed(true);
      }
    }
  }, [useDirectEmbed]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'PLAY_SONG' && data.song?.id) {
          changeSongSafely(data.song);
        } else if (data.type === 'SYNC_STATE' && data.song?.id) {
          if (data.song.id !== currentVideoIdRef.current) {
            changeSongSafely(data.song);
          }
        } else if (data.type === 'PLAY_STATE') {
          if (ytPlayerRef.current) {
            if (data.isPlaying) ytPlayerRef.current.playVideo?.();
            else ytPlayerRef.current.pauseVideo?.();
          }
        } else if (data.type === 'SEEK' && typeof data.time === 'number') {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(data.time, true);
          }
        } else if (data.type === 'KARAOKE_SCORE' && data.score) {
          setScreen2Score(data.score);
          setIsScoreModalOpen(true);
        } else if (data.type === 'KARAOKE_CONFIG_SYNC' && typeof data.autoScoreEnabled === 'boolean') {
          setIsKaraokeAutoScoreActive(data.autoScoreEnabled);
        }
      };

      channel.postMessage({ type: 'REQUEST_SYNC' });
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_CURRENT_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.song?.id && parsed.song.id !== currentVideoIdRef.current) {
            changeSongSafely(parsed.song);
          }
        } catch {}
      } else if (e.key === 'wavetune_broadcast_karaoke_score' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.score) {
            setScreen2Score(parsed.score);
            setIsScoreModalOpen(true);
          }
        } catch {}
      } else if (e.key === 'wavetune_karaoke_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (typeof parsed?.autoScoreEnabled === 'boolean') {
            setIsKaraokeAutoScoreActive(parsed.autoScoreEnabled);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    const pollServer = async () => {
      try {
        const res = await fetch('/api/sync/current');
        if (res.ok) {
          const data = await res.json();
          if (data?.song?.id && data.updatedAt > lastSyncTimestampRef.current) {
            lastSyncTimestampRef.current = data.updatedAt;
            if (data.song.id !== currentVideoIdRef.current) {
              changeSongSafely(data.song);
            }
          }
        }
      } catch {}
    };

    pollServer();
    const pollInterval = setInterval(pollServer, 1500);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [changeSongSafely]);

  useEffect(() => {
    if (useDirectEmbed) return;
    if (!currentSong?.id) return;

    let isSubscribed = true;

    const setupPlayerInstance = () => {
      if (!isSubscribed) return;
      if (!window.YT || !window.YT.Player) return;

      const container = playerContainerRef.current;
      if (!container) return;

      if (ytPlayerRef.current && isPlayerReadyRef.current) {
        return;
      }

      container.innerHTML = '';
      const mountDiv = document.createElement('div');
      mountDiv.id = `yt-screen2-mount-${Date.now()}`;
      mountDiv.style.width = '100%';
      mountDiv.style.height = '100%';
      container.appendChild(mountDiv);

      try {
        ytPlayerRef.current = new window.YT.Player(mountDiv.id, {
          height: '100%',
          width: '100%',
          videoId: currentSong.id,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
            widget_referrer: window.location.href,
            playsinline: 1
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              isPlayerReadyRef.current = true;
              setVideoError(null);
              forceDisableYouTubeCaptions(event.target);
              try {
                event.target.playVideo();
              } catch {}
            },
            onApiChange: (event: any) => {
              forceDisableYouTubeCaptions(event.target);
            },
            onStateChange: (event: any) => {
              forceDisableYouTubeCaptions(event.target);
              if (event.data === 1) {
                setVideoError(null);
                setTimeout(() => forceDisableYouTubeCaptions(event.target), 300);
                setTimeout(() => forceDisableYouTubeCaptions(event.target), 1200);
              } else if (event.data === 0) {
                if (isKaraokeAutoScoreActiveRef.current) {
                  handleAutoScoreOnScreen2Ref.current();
                }
              }
            },
            onError: (event: any) => {
              console.warn('YouTube IFrame API returned error code:', event.data);
              if (isSubscribed) {
                setUseDirectEmbed(true);
              }
            }
          }
        });
      } catch (err) {
        console.error('Failed to instantiate YT.Player, falling back:', err);
        if (isSubscribed) {
          setUseDirectEmbed(true);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayerInstance();
    } else {
      const existingTag = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingTag) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        setupPlayerInstance();
      };
    }

    const captionKillInterval = setInterval(() => {
      if (ytPlayerRef.current) {
        forceDisableYouTubeCaptions(ytPlayerRef.current);
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(captionKillInterval);
    };
  }, [useDirectEmbed, currentSong.id]);

  const handleDirectPaste = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYouTubeId(directInput);
    if (id) {
      changeSongSafely({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: `YouTube Video (${id})`,
        artist: 'WaveTune',
        thumbnail: getYouTubeThumbnail(id),
        duration: 0,
        playedAt: Date.now()
      });
      setDirectInput('');
    }
  };

  return (
    <div
      onClick={handleUserGesture}
      onDoubleClick={toggleFullscreen}
      className="fixed inset-0 w-screen h-screen bg-black text-white flex flex-col justify-between overflow-hidden font-sans select-none"
    >
      {/* Top Floating Control Bar (Visible when windowed, auto-hidden when Fullscreen unless hovered) */}
      <div
        className={`absolute top-3 left-4 right-4 z-40 flex items-center justify-between transition-opacity duration-300 pointer-events-auto ${
          isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-2.5 bg-neutral-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-800 text-xs text-neutral-300 shadow-2xl">
          <Monitor className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-white truncate max-w-xs sm:max-w-md">
            Màn hình 2: {currentSong.title}
          </span>
          {isSyncing && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Đã đồng bộ</span>
            </span>
          )}
          {useDirectEmbed && (
            <span className="hidden sm:inline-flex text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
              Chế độ phát trực tiếp
            </span>
          )}
          {isKaraokeAutoScoreActive && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-semibold shadow-md">
              <Sparkles className="w-3 h-3 text-amber-400 animate-spin-slow" />
              <span>Chấm điểm: ĐANG MỞ</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <form
            onSubmit={handleDirectPaste}
            onClick={e => e.stopPropagation()}
            className="hidden md:flex items-center bg-neutral-900/90 border border-neutral-800 rounded-xl px-2.5 py-1 shadow-lg"
          >
            <input
              type="text"
              value={directInput}
              onChange={e => setDirectInput(e.target.value)}
              placeholder="Dán link YouTube khác..."
              className="bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none w-44 px-1"
            />
            <button
              type="submit"
              disabled={!directInput.trim()}
              className="text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
            >
              Phát
            </button>
          </form>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setUseDirectEmbed(!useDirectEmbed);
            }}
            title={useDirectEmbed ? 'Chuyển sang Bộ phát API' : 'Chuyển sang Bộ phát Nhúng Trực Tiếp'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-semibold shadow-xl transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{useDirectEmbed ? 'Đổi sang API' : 'Đổi nguồn phát'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 text-white text-xs font-bold shadow-xl transition-all cursor-pointer"
            title="Nhấn phím F để bật/tắt Full màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Full màn hình'}</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-black bg-black/40 border border-white/30 rounded text-amber-300">
              F
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Full-Screen YouTube Video Frame */}
      <div className="w-full h-full flex items-center justify-center bg-black relative">
        {useDirectEmbed ? (
          <iframe
            key={`embed-${currentSong.id}`}
            src={`https://www.youtube-nocookie.com/embed/${currentSong.id}?autoplay=1&controls=1&rel=0&cc_load_policy=0&iv_load_policy=3&playsinline=1`}
            title={currentSong.title}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        ) : (
          <div ref={playerContainerRef} className="w-full h-full absolute inset-0" />
        )}

        {videoError && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-50 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-base font-bold text-white">Đang kích hoạt chế độ phát dự phòng</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {videoError}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setUseDirectEmbed(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                Chuyển sang Bộ phát Nhúng Trực Tiếp
              </button>
              <a
                href={`https://www.youtube.com/watch?v=${currentSong.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs shadow-lg transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mở Trên YouTube</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Karaoke Score Celebration Modal on TV / Second Screen */}
      <KaraokeScoreModal
        score={screen2Score}
        isOpen={isScoreModalOpen}
        onClose={() => setIsScoreModalOpen(false)}
        autoDismissSeconds={12}
        soundEnabled={true}
      />
    </div>
  );
}

/**
 * ============================================================================
 * MAIN SCREEN CONTROLLER (MÀN HÌNH CHÍNH)
 * Layout Hierarchy:
 * 1. Top Navigation Bar
 * 2. URL Input Bar (Dán link, Lưu link, Phát Màn 2)
 * 3. Video Controller Desk (Prominent, right below URL input, ALWAYS VISIBLE!)
 * 4. Tabbed Utility Desk:
 *    - Tab 1: Danh sách link đã dán & đã lưu
 *    - Tab 2: Tìm kiếm video (Cốc Cốc & Tắt tiếng 100%)
 * ============================================================================
 */
function MainScreenController() {
  const [urlInput, setUrlInput] = useState('');
  const [currentSong, setCurrentSong] = useState<PlayedSong | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayingOnScreen2, setIsPlayingOnScreen2] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSavingLoading, setIsSavingLoading] = useState<boolean>(false);

  // Active Bottom Tab: 'saved-links' | 'coccoc-search'
  const [activeBottomTab, setActiveBottomTab] = useState<'saved-links' | 'coccoc-search'>('saved-links');

  // Cốc Cốc / YouTube Video Search Tool States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [previewMutedId, setPreviewMutedId] = useState<string | null>(null);
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null);

  // Multi-screen features
  const [isScreen2ModalOpen, setIsScreen2ModalOpen] = useState<boolean>(false);
  const [isScreen2Copied, setIsScreen2Copied] = useState<boolean>(false);
  const [screen2PopupSuccess, setScreen2PopupSuccess] = useState<boolean>(false);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  // Sleep timer
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState<boolean>(false);

  // Karaoke Auto-Scoring & Mic States
  const [karaokeConfig, setKaraokeConfig] = useState<KaraokeConfig>(() => {
    try {
      const saved = localStorage.getItem('wavetune_karaoke_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      autoScoreEnabled: false,
      soundEffectsEnabled: true,
      micEnabled: false,
      strictness: 'standard'
    };
  });

  const [karaokeScores, setKaraokeScores] = useState<KaraokeScore[]>(() => {
    try {
      const saved = localStorage.getItem('wavetune_karaoke_scores');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [activeScore, setActiveScore] = useState<KaraokeScore | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);

  const micAnalyzerRef = useRef<KaraokeMicAnalyzer | null>(null);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micAudioStats, setMicAudioStats] = useState<MicAudioStats>({
    volume: 0,
    pitchHz: 0,
    pitchConfidence: 0.85,
    isSinging: false,
    totalSingingFrames: 0,
    totalSongFrames: 0,
    averageVolume: 0,
    peakVolume: 0,
    pitchStability: 90,
    goodNotesCount: 0
  });

  // Save karaoke config & scores and sync with Screen 2
  useEffect(() => {
    try {
      localStorage.setItem('wavetune_karaoke_config', JSON.stringify(karaokeConfig));
    } catch {}
    try {
      syncChannelRef.current?.postMessage({
        type: 'KARAOKE_CONFIG_SYNC',
        autoScoreEnabled: karaokeConfig.autoScoreEnabled
      });
    } catch {}
  }, [karaokeConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('wavetune_karaoke_scores', JSON.stringify(karaokeScores.slice(0, 50)));
    } catch {}
  }, [karaokeScores]);

  // Initialize Mic / Karaoke Audio Engine
  useEffect(() => {
    const analyzer = new KaraokeMicAnalyzer();
    micAnalyzerRef.current = analyzer;

    if (karaokeConfig.micEnabled) {
      analyzer.startListening(true, stats => {
        setMicAudioStats(stats);
      }).then(active => {
        setIsMicActive(active);
      });
    } else {
      analyzer.startListening(false, stats => {
        setMicAudioStats(stats);
      });
      setIsMicActive(false);
    }

    return () => {
      analyzer.stopListening();
    };
  }, [karaokeConfig.micEnabled]);

  const toggleMic = async () => {
    if (!micAnalyzerRef.current) return;

    if (isMicActive) {
      await micAnalyzerRef.current.startListening(false, stats => setMicAudioStats(stats));
      setIsMicActive(false);
      setKaraokeConfig(prev => ({ ...prev, micEnabled: false }));
      setStatusNotice('Đã tắt Micro (Chuyển sang chế độ tự động chấm theo nhạc)');
    } else {
      const success = await micAnalyzerRef.current.startListening(true, stats => setMicAudioStats(stats));
      if (success) {
        setIsMicActive(true);
        setKaraokeConfig(prev => ({ ...prev, micEnabled: true }));
        setStatusNotice('🎤 Đã bật Micro! Giọng hát đang được phân tích theo thời gian thực.');
      } else {
        setIsMicActive(false);
        setKaraokeConfig(prev => ({ ...prev, micEnabled: false }));
        setStatusNotice('Không thể mở Micro thiết bị. Đã bật chế độ tự động chấm theo nhịp bài hát!');
      }
    }
    setTimeout(() => setStatusNotice(null), 5000);
  };

  const triggerScoring = useCallback((singerName?: string) => {
    if (!currentSong) return;

    const stats = micAnalyzerRef.current
      ? micAnalyzerRef.current.getSnapshotStats()
      : {
          volume: 62,
          pitchHz: 250,
          pitchConfidence: 0.9,
          isSinging: true,
          totalSingingFrames: 1200,
          totalSongFrames: 1600,
          averageVolume: 54,
          peakVolume: 86,
          pitchStability: 92,
          goodNotesCount: 42
        };

    const score = calculateKaraokeScore(
      currentSong.title,
      currentSong.id,
      stats,
      karaokeConfig.strictness,
      singerName || 'Ca sĩ bạn thân'
    );

    setActiveScore(score);
    setIsScoreModalOpen(true);
    setKaraokeScores(prev => [score, ...prev.slice(0, 49)]);

    // Broadcast to Screen 2
    try {
      syncChannelRef.current?.postMessage({
        type: 'KARAOKE_SCORE',
        score
      });
    } catch {}

    try {
      localStorage.setItem('wavetune_broadcast_karaoke_score', JSON.stringify({
        score,
        timestamp: Date.now()
      }));
    } catch {}

    if (micAnalyzerRef.current) {
      micAnalyzerRef.current.resetStats();
    }
  }, [currentSong, karaokeConfig.strictness]);

  // Saved / Pasted Links List (Persistent in localStorage)
  const [savedLinks, setSavedLinks] = useState<PlayedSong[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SAVED_LINKS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: DEFAULT_FALLBACK_ID,
        url: `https://www.youtube.com/watch?v=${DEFAULT_FALLBACK_ID}`,
        title: 'Đừng Làm Trái Tim Anh Đau',
        artist: 'Sơn Tùng M-TP',
        thumbnail: getYouTubeThumbnail(DEFAULT_FALLBACK_ID),
        duration: 312,
        playedAt: Date.now()
      }
    ];
  });

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const isMainPlayerReadyRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<any>(null);
  const sleepIntervalRef = useRef<any>(null);

  // Save savedLinks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SAVED_LINKS_KEY, JSON.stringify(savedLinks.slice(0, 50)));
    } catch {}
  }, [savedLinks]);

  // Set default initial song in standby
  useEffect(() => {
    if (!currentSong && savedLinks.length > 0) {
      setCurrentSong(savedLinks[0]);
    }
  }, [savedLinks, currentSong]);

  // Broadcast to Screen 2 via Server API + BroadcastChannel + LocalStorage
  const syncToScreen2 = useCallback(async (song: PlayedSong) => {
    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({ type: 'PLAY_SONG', song, autoplay: true });
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_CURRENT_KEY, JSON.stringify({
        song,
        timestamp: Date.now()
      }));
    } catch {}

    try {
      await fetch('/api/sync/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, isPlaying: true, currentTime: 0, command: 'play' })
      });
    } catch {}
  }, []);

  // Primary action: Play on Screen 2
  const playOnScreen2 = useCallback((songToPlay?: PlayedSong) => {
    const song = songToPlay || currentSong;
    if (!song) {
      setErrorMessage('Chưa có bài hát nào được chọn. Vui lòng dán link YouTube!');
      return;
    }

    syncToScreen2(song);
    setIsPlayingOnScreen2(true);
    setStatusNotice(`Đang phát trên Màn hình 2: "${song.title}"`);
    setTimeout(() => setStatusNotice(null), 4000);

    const targetUrl = `${window.location.origin}${window.location.pathname}?screen=2&id=${song.id}`;
    try {
      const win = window.open(
        targetUrl,
        'wavetune_screen_2',
        'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
      );
      if (win) {
        win.focus();
        setScreen2PopupSuccess(true);
        setTimeout(() => setScreen2PopupSuccess(false), 3000);
        return;
      }
    } catch {}

    setIsScreen2ModalOpen(true);
  }, [currentSong, syncToScreen2]);

  // Initialize BroadcastChannel with bidirectional handshake
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      syncChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'REQUEST_SYNC' && currentSong) {
          channel?.postMessage({
            type: 'SYNC_STATE',
            song: currentSong,
            isPlaying: isPlayingOnScreen2,
            currentTime
          });
        } else if (event.data?.type === 'KARAOKE_SCORE_RESULT' && event.data.score) {
          const score = event.data.score;
          setKaraokeScores(prev => [score, ...prev.slice(0, 49)]);
          setStatusNotice(`🏆 Màn hình 2 vừa chấm điểm: "${score.songTitle}" - ${score.totalScore} điểm (${score.grade})!`);
          setTimeout(() => setStatusNotice(null), 6000);
        }
      };
    } catch {}

    return () => {
      if (channel) channel.close();
    };
  }, [currentSong, isPlayingOnScreen2, currentTime]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Screen 1 YouTube Player: CUE ONLY, DO NOT AUTOPLAY!
  useEffect(() => {
    if (!currentSong?.id) return;

    let isSubscribed = true;

    if (isMainPlayerReadyRef.current && ytPlayerRef.current) {
      try {
        if (typeof ytPlayerRef.current.cueVideoById === 'function') {
          ytPlayerRef.current.cueVideoById(currentSong.id);
        } else if (typeof ytPlayerRef.current.loadVideoById === 'function') {
          ytPlayerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: 0 });
          ytPlayerRef.current.pauseVideo();
        }
        setIsPlaying(false);
        return;
      } catch {}
    }

    const setupPlayer = () => {
      if (!isSubscribed) return;
      if (!window.YT || !window.YT.Player) return;

      const container = mainContainerRef.current;
      if (!container) return;

      container.innerHTML = '';
      const mountDiv = document.createElement('div');
      mountDiv.id = `yt-main-mount-${Date.now()}`;
      mountDiv.style.width = '100%';
      mountDiv.style.height = '100%';
      container.appendChild(mountDiv);

      try {
        ytPlayerRef.current = new window.YT.Player(mountDiv.id, {
          height: '100%',
          width: '100%',
          videoId: currentSong.id,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
            widget_referrer: window.location.href,
            playsinline: 1
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              isMainPlayerReadyRef.current = true;
              forceDisableYouTubeCaptions(event.target);
              event.target.setVolume(volume);
              if (isMuted) event.target.mute();
              const dur = event.target.getDuration();
              if (dur) setDuration(dur);
            },
            onApiChange: (event: any) => {
              forceDisableYouTubeCaptions(event.target);
            },
            onStateChange: (event: any) => {
              if (!isSubscribed) return;
              forceDisableYouTubeCaptions(event.target);
              if (event.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
                setErrorMessage(null);
                const dur = ytPlayerRef.current?.getDuration();
                if (dur) setDuration(dur);
                setTimeout(() => forceDisableYouTubeCaptions(event.target), 400);
              } else if (event.data === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (event.data === 3) {
                setIsBuffering(true);
              } else if (event.data === 0) {
                handleSongEndedRef.current();
              }
            },
            onError: (event: any) => {
              if (!isSubscribed) return;
              setIsPlaying(false);
              setIsBuffering(false);
            }
          }
        });
      } catch (err) {
        console.error('Lỗi khởi tạo YouTube Player màn hình 1:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const existingTag = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingTag) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [currentSong?.id]);

  // Current time ticker
  useEffect(() => {
    if (isPlaying) {
      timerIntervalRef.current = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          const curr = ytPlayerRef.current.getCurrentTime() || 0;
          setCurrentTime(curr);
          const dur = ytPlayerRef.current.getDuration() || 0;
          if (dur > 0 && dur !== duration) {
            setDuration(dur);
          }
        }
      }, 500);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPlaying, duration]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepTimerRemaining !== null && sleepTimerRemaining > 0) {
      sleepIntervalRef.current = setInterval(() => {
        setSleepTimerRemaining(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(sleepIntervalRef.current);
            if (ytPlayerRef.current?.pauseVideo) {
              ytPlayerRef.current.pauseVideo();
            }
            setIsPlaying(false);
            setIsPlayingOnScreen2(false);
            syncChannelRef.current?.postMessage({ type: 'PLAY_STATE', isPlaying: false });
            setSleepTimerMinutes(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    }
    return () => {
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, [sleepTimerRemaining]);

  const handleSongEnded = () => {
    // Tự động chấm điểm Karaoke khi kết thúc bài hát!
    if (karaokeConfig.autoScoreEnabled && currentSong) {
      triggerScoring();
    }

    if (sleepTimerMinutes === -1) {
      if (ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
      setIsPlaying(false);
      setIsPlayingOnScreen2(false);
      syncChannelRef.current?.postMessage({ type: 'PLAY_STATE', isPlaying: false });
      setSleepTimerMinutes(null);
      setSleepTimerRemaining(null);
      return;
    }

    if (repeatMode === 'one' && currentSong) {
      playOnScreen2(currentSong);
    } else if (repeatMode === 'all') {
      if (savedLinks.length > 1 && currentSong) {
        const currentIdx = savedLinks.findIndex(s => s.id === currentSong.id);
        const nextIdx = (currentIdx + 1) % savedLinks.length;
        const nextSong = savedLinks[nextIdx];
        setCurrentSong(nextSong);
        playOnScreen2(nextSong);
      }
    } else {
      setIsPlaying(false);
      setIsPlayingOnScreen2(false);
    }
  };

  const handleSongEndedRef = useRef(handleSongEnded);
  useEffect(() => {
    handleSongEndedRef.current = handleSongEnded;
  });

  /**
   * Helper to parse, fetch metadata, and add to savedLinks list.
   */
  const processAndSaveLink = async (inputVal: string, triggerScreen2: boolean = false) => {
    setErrorMessage(null);

    const videoId = extractYouTubeId(inputVal);
    if (!videoId) {
      setErrorMessage('Đường link không hợp lệ. Vui lòng dán link YouTube (ví dụ: https://www.youtube.com/watch?v=... hoặc youtu.be/...)');
      return;
    }

    setIsSavingLoading(true);
    let songTitle = `YouTube Video (${videoId})`;
    let songArtist = 'YouTube';

    try {
      const res = await fetch(`/api/youtube-info?id=${videoId}`);
      if (res.ok) {
        const info = await res.json();
        if (info.title) songTitle = info.title;
        if (info.author_name) songArtist = info.author_name;
      }
    } catch {}

    const newSong: PlayedSong = {
      id: videoId,
      url: inputVal.trim().startsWith('http') ? inputVal.trim() : `https://www.youtube.com/watch?v=${videoId}`,
      title: songTitle,
      artist: songArtist,
      thumbnail: getYouTubeThumbnail(videoId),
      duration: 0,
      playedAt: Date.now()
    };

    setIsSavingLoading(false);
    setUrlInput('');
    setCurrentSong(newSong);

    setSavedLinks(prev => {
      const filtered = prev.filter(s => s.id !== newSong.id);
      return [{ ...newSong, playedAt: Date.now() }, ...filtered];
    });

    if (triggerScreen2) {
      playOnScreen2(newSong);
    } else {
      setStatusNotice(`Đã nạp bài: "${newSong.title}". Bấm nút "Màn hình 2" để phát.`);
      setTimeout(() => setStatusNotice(null), 5000);
    }
  };

  const handleUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;
    processAndSaveLink(urlInput, true);
  };

  const handleSaveOnly = () => {
    if (!urlInput.trim()) {
      setErrorMessage('Vui lòng dán đường link YouTube vào ô trước khi lưu!');
      return;
    }
    processAndSaveLink(urlInput, false);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const videoId = extractYouTubeId(text);
        if (videoId) {
          processAndSaveLink(text, false);
        } else {
          setUrlInput(text);
        }
      }
    } catch {
      const el = document.getElementById('youtube-url-input');
      el?.focus();
    }
  };

  // Cốc Cốc & YouTube Video Search Handler
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        if (!data.results || data.results.length === 0) {
          setStatusNotice(`Không tìm thấy kết quả cho "${searchQuery}". Bạn có thể bấm mở trực tiếp trên Cốc Cốc.`);
        }
      }
    } catch (err) {
      console.error('Lỗi tìm kiếm:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const openCocCocBrowserSearch = () => {
    const q = searchQuery.trim() || 'nhạc hay trending';
    const cocCocUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    window.open(cocCocUrl, '_blank');
    setStatusNotice('💡 Đã mở Cốc Cốc / YouTube! Mẹo: Nhấp chuột phải vào Tab Cốc Cốc → chọn "Tắt tiếng trang web" để tìm nhạc mà không làm ồn Màn hình 2.');
    setTimeout(() => setStatusNotice(null), 8000);
  };

  const copyResultUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedResultId(id);
    setUrlInput(url);
    setStatusNotice(`Đã sao chép URL: ${url}. Bạn có thể bấm "Lưu link" hoặc "Phát Màn 2"!`);
    setTimeout(() => setCopiedResultId(null), 2500);
  };

  const togglePlay = () => {
    if (isPlaying) {
      ytPlayerRef.current?.pauseVideo?.();
      setIsPlaying(false);
      setIsPlayingOnScreen2(false);
      syncChannelRef.current?.postMessage({ type: 'PLAY_STATE', isPlaying: false });
    } else {
      if (currentSong) {
        playOnScreen2(currentSong);
      }
    }
  };

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(seconds, true);
    }
    syncChannelRef.current?.postMessage({ type: 'SEEK', time: seconds });
  };

  const skipSeconds = (delta: number) => {
    const target = Math.max(0, Math.min(duration || 100, currentTime + delta));
    seekTo(target);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      ytPlayerRef.current?.unMute();
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      ytPlayerRef.current.setVolume(clamped);
    }
  };

  const toggleMute = () => {
    if (!ytPlayerRef.current) return;
    if (isMuted) {
      ytPlayerRef.current.unMute();
      setIsMuted(false);
    } else {
      ytPlayerRef.current.mute();
      setIsMuted(true);
    }
  };

  const setPlaybackSpeed = (speed: PlaybackSpeed) => {
    setPlaybackSpeedState(speed);
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setPlaybackRate === 'function') {
      ytPlayerRef.current.setPlaybackRate(speed);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const setSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null || minutes <= 0) {
      setSleepTimerRemaining(null);
    } else {
      setSleepTimerRemaining(minutes * 60);
    }
    setIsSleepModalOpen(false);
  };

  const copyCurrentLink = () => {
    if (!currentSong) return;
    navigator.clipboard.writeText(currentSong.url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const copySpecificLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setStatusNotice('Đã sao chép đường link!');
    setTimeout(() => setStatusNotice(null), 2000);
  };

  const screen2DirectUrl = `${window.location.origin}${window.location.pathname}?screen=2&id=${currentSong?.id || DEFAULT_FALLBACK_ID}`;

  const copyScreen2Link = () => {
    navigator.clipboard.writeText(screen2DirectUrl);
    setIsScreen2Copied(true);
    setTimeout(() => setIsScreen2Copied(false), 2000);
  };

  const deleteFromSavedLinks = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedLinks(prev => prev.filter(s => s.id !== id));
  };

  const clearAllSavedLinks = () => {
    if (confirm('Bạn có muốn xóa toàn bộ danh sách link đã lưu?')) {
      setSavedLinks([]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipSeconds(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skipSeconds(-10);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, currentTime, duration, isMuted]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-y-auto pb-16 ${isFullscreen ? 'p-0' : ''}`}>
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/30 shrink-0">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                WaveTune
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Không quảng cáo</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5 hidden sm:block">
              Màn hình 1 (Điều khiển & Lưu link) → Bấm "Màn hình 2" để phát video
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Screen 2 Big Prominent Trigger Button */}
          <button
            onClick={() => playOnScreen2()}
            title="Nhấn để phát video sang Màn hình 2 ngay"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/60 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-500/40 animate-pulse"
          >
            <Monitor className="w-4 h-4 text-white" />
            <span>Màn hình 2</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ màn hình (F)' : 'Toàn màn hình (F)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isFullscreen
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>

          {/* Sleep timer button */}
          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              sleepTimerRemaining !== null
                ? 'bg-amber-950/60 border border-amber-800 text-amber-300'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {sleepTimerRemaining !== null
                ? `${Math.ceil(sleepTimerRemaining / 60)} phút`
                : 'Hẹn giờ tắt'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className={`w-full mx-auto px-4 py-4 space-y-4 transition-all ${isFullscreen ? 'max-w-[1600px]' : 'max-w-7xl'}`}>
        {/* Notice Toast */}
        {statusNotice && (
          <div className="p-3 rounded-2xl bg-neutral-900 border border-emerald-500/50 text-white text-xs flex items-center justify-between shadow-2xl animate-in fade-in">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusNotice}</span>
            </span>
            <button
              onClick={() => playOnScreen2()}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow"
            >
              Phát Màn hình 2
            </button>
          </div>
        )}

        {screen2PopupSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center justify-between shadow-xl animate-in fade-in">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Đã kết nối Màn hình 2! Video đang phát trên Màn hình thứ 2.</span>
            </span>
            <button
              onClick={() => setScreen2PopupSuccess(false)}
              className="text-emerald-400 hover:text-white text-xs underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. TOP URL INPUT BAR (COMPACT & PROMINENT)                       */}
        {/* ================================================================= */}
        <section className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-2">
          <form
            onSubmit={handleUrlSubmit}
            className="relative flex items-center bg-neutral-950 border-2 border-neutral-800 hover:border-neutral-700 focus-within:border-emerald-500 rounded-2xl p-1.5 shadow-inner transition-all"
          >
            <input
              id="youtube-url-input"
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="Dán link YouTube vào đây (https://www.youtube.com/watch?v=... hoặc youtu.be/...)"
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none"
            />

            <div className="flex items-center gap-1.5 pr-1">
              {/* Dán link Button */}
              <button
                type="button"
                onClick={handlePasteClipboard}
                title="Dán nhanh từ bộ nhớ tạm"
                className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-800 transition-colors cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Dán link</span>
              </button>

              {/* LƯU LINK BUTTON */}
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={!urlInput.trim() || isSavingLoading}
                title="Lưu link vào danh sách (chưa phát)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                {isSavingLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="w-3.5 h-3.5" />
                )}
                <span>Lưu link</span>
              </button>

              {/* PHÁT MÀN HÌNH 2 BUTTON */}
              <button
                type="button"
                onClick={() => {
                  if (urlInput.trim()) {
                    processAndSaveLink(urlInput, true);
                  } else if (currentSong) {
                    playOnScreen2(currentSong);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Tv className="w-4 h-4 text-white" />
                <span>Phát Màn 2</span>
              </button>
            </div>
          </form>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-300 hover:text-white text-xs underline shrink-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}
        </section>

        {/* ================================================================= */}
        {/* KARAOKE SCORING CONTROL PANEL (TỰ ĐỘNG CHẤM & MICRO THỰC TẾ)      */}
        {/* ================================================================= */}
        <KaraokeScoreControl
          config={karaokeConfig}
          onUpdateConfig={updates => setKaraokeConfig(prev => ({ ...prev, ...updates }))}
          audioStats={micAudioStats}
          isMicActive={isMicActive}
          onToggleMic={toggleMic}
          onInstantScore={name => triggerScoring(name)}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          scoresCount={karaokeScores.length}
          isSongPlaying={isPlaying || isPlayingOnScreen2}
        />

        {/* ================================================================= */}
        {/* 2 & 3. SIDE-BY-SIDE DESK: MÀN HÌNH 1 + DANH SÁCH & TÌM KIẾM       */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEFT COLUMN: VIDEO CONTROLLER DESK (MÀN HÌNH 1) */}
          {currentSong && (
            <section className="lg:col-span-7 bg-neutral-900/90 border border-neutral-800/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 flex flex-col justify-between">
            {/* Top Bar inside Video Controller (Exact matching user screenshot!) */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPlayingOnScreen2 ? 'bg-emerald-400 animate-ping' : 'bg-neutral-600'}`} />
                <span className="text-xs font-semibold text-neutral-300">
                  {isPlayingOnScreen2 ? 'Đang chiếu trên Màn hình 2' : 'Trạng thái Màn hình 1: Sẵn sàng (chưa phát)'}
                </span>
              </div>

              {/* Big Green Trigger Button directly in video header */}
              <button
                onClick={() => playOnScreen2()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Ấn vào đây để phát sang Màn hình 2</span>
                <SendHorizontal className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {/* 16:9 Video Preview Frame */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800 group">
              <div ref={mainContainerRef} className="w-full h-full" />

              {!isPlaying && !isPlayingOnScreen2 && (
                <div
                  onClick={() => playOnScreen2()}
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-black/40 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl mb-2.5 hover:scale-105 transition-transform">
                    <Monitor className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Bấm để phát sang Màn hình 2
                  </h3>
                  <p className="text-xs text-neutral-300 mt-0.5 max-w-sm">
                    Link đã được nạp sẵn. Màn hình 1 không tự phát tiếng để tránh làm phiền.
                  </p>
                </div>
              )}
            </div>

            {/* Song Meta Information */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-0.5">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  {currentSong.title}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {currentSong.artist}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0">
                <button
                  onClick={copyCurrentLink}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Đã chép link' : 'Sao chép link'}</span>
                </button>

                <a
                  href={currentSong.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-red-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở trên YouTube</span>
                </a>
              </div>
            </div>

            {/* Scrubbing Timeline */}
            <div className="space-y-1">
              <div className="relative flex items-center h-3.5 group cursor-pointer">
                <div className="absolute left-0 right-0 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 group-hover:bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={e => seekTo(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Remote Controller Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-neutral-800/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleRepeat}
                  title={
                    repeatMode === 'one'
                      ? 'Lặp lại 1 bài'
                      : repeatMode === 'all'
                      ? 'Lặp lại danh sách'
                      : 'Không lặp lại'
                  }
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    repeatMode !== 'off'
                      ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/40'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>

                <div className="flex items-center bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/60 text-xs font-mono">
                  {([0.75, 1, 1.25, 1.5] as PlaybackSpeed[]).map(spd => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-neutral-700 text-white font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-5">
                <button
                  onClick={() => skipSeconds(-10)}
                  title="Lùi 10 giây"
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    if (isPlayingOnScreen2 || isPlaying) {
                      togglePlay();
                    } else {
                      playOnScreen2();
                    }
                  }}
                  title={isPlayingOnScreen2 || isPlaying ? 'Tạm dừng' : 'Phát sang Màn hình 2'}
                  className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isBuffering ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : isPlayingOnScreen2 || isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={() => skipSeconds(10)}
                  title="Tua tới 10 giây"
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 sm:w-32">
                  <button
                    onClick={toggleMute}
                    title={isMuted ? 'Bật âm thanh (M)' : 'Tắt tiếng (M)'}
                    className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : volume < 50 ? (
                      <Volume1 className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <div className="relative flex-1 flex items-center h-3">
                    <div className="absolute left-0 right-0 h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all rounded-full"
                        style={{ width: `${isMuted ? 0 : volume}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={e => setVolume(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
                    />
                  </div>
                </div>

                <button
                  onClick={() => playOnScreen2()}
                  title="Phát sang Màn hình 2"
                  className="p-1.5 text-neutral-400 hover:text-emerald-400 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                </button>

                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Thoát toàn màn hình (F)' : 'Toàn màn hình (F)'}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </section>
        )}

          {/* RIGHT COLUMN: TABBED UTILITY DESK (DANH SÁCH LINK ĐÃ LƯU & TÌM KIẾM CỐC CỐC) */}
          <section className={`${currentSong ? 'lg:col-span-5' : 'lg:col-span-12'} bg-neutral-900/90 border border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col space-y-3.5`}>
          {/* Tab Selection Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveBottomTab('saved-links')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeBottomTab === 'saved-links'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <ListMusic className="w-4 h-4" />
                <span>Danh sách link đã lưu ({savedLinks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBottomTab('coccoc-search')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeBottomTab === 'coccoc-search'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Tìm video (Cốc Cốc - Tắt tiếng)</span>
              </button>
            </div>

            {/* Quick Actions */}
            {activeBottomTab === 'saved-links' && savedLinks.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                {savedLinks.length > 1 && (
                  <button
                    onClick={() => playOnScreen2(savedLinks[0])}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-emerald-400" />
                    <span>Phát bài đầu sang Màn 2</span>
                  </button>
                )}
                <button
                  onClick={clearAllSavedLinks}
                  className="text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa hết</span>
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: DANH SÁCH LINK ĐÃ DÁN & ĐÃ LƯU */}
          {activeBottomTab === 'saved-links' && (
            <div className="flex-1">
              {savedLinks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-neutral-950/50 border border-dashed border-neutral-800 text-neutral-500 text-xs">
                  Chưa có link nào được lưu. Hãy dán link YouTube ở trên rồi bấm <strong className="text-white">"Lưu link"</strong> hoặc chuyển sang tab <strong className="text-emerald-400">"Tìm video (Cốc Cốc)"</strong> để thêm bài hát!
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                  {savedLinks.map((item, idx) => {
                    const isCurrent = currentSong?.id === item.id;
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => {
                          setCurrentSong(item);
                        }}
                        className={`group flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-neutral-950 border-emerald-600/80 shadow-md text-white'
                            : 'bg-neutral-950/60 hover:bg-neutral-950 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 border border-neutral-800">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Monitor className="w-4 h-4 text-emerald-400" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4
                                className={`text-xs sm:text-sm font-semibold truncate ${
                                  isCurrent ? 'text-emerald-400' : 'text-white'
                                }`}
                              >
                                {item.title}
                              </h4>
                              {isCurrent && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono shrink-0">
                                  Đang chọn
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {item.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentSong(item);
                              playOnScreen2(item);
                            }}
                            title="Phát bài này sang Màn hình 2 ngay"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors cursor-pointer"
                          >
                            <Tv className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Phát Màn 2</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copySpecificLink(item.url);
                            }}
                            title="Sao chép link YouTube"
                            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Mở link trên YouTube"
                            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={e => deleteFromSavedLinks(item.id, e)}
                            title="Xóa khỏi danh sách"
                            className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TÌM KIẾM VIDEO (CỐC CỐC & TẮT TIẾNG 100%) */}
          {activeBottomTab === 'coccoc-search' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <VolumeOff className="w-3.5 h-3.5" />
                  <span>Chế độ tìm kiếm an toàn: Xem thử không tiếng, chỉ copy URL để không làm ồn Màn hình 2</span>
                </span>

                <button
                  type="button"
                  onClick={openCocCocBrowserSearch}
                  className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Mở trên Cốc Cốc</span>
                </button>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-emerald-500 rounded-2xl p-1.5 shadow-inner">
                  <Search className="w-4 h-4 text-neutral-500 ml-2.5 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên bài hát, ca sĩ, karaoke (ví dụ: Karaoke Sơn Tùng, nhạc trẻ remix)..."
                    className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-neutral-500 hover:text-white p-1 mr-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!searchQuery.trim() || isSearching}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Tìm kiếm</span>
                  </button>

                  <button
                    type="button"
                    onClick={openCocCocBrowserSearch}
                    title="Mở tab tìm kiếm trên trình duyệt Cốc Cốc"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer shrink-0"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Mở Cốc Cốc</span>
                  </button>
                </div>
              </form>

              {/* Muted In-place Video Preview Box */}
              {previewMutedId && (
                <div className="bg-neutral-950 border border-amber-500/40 rounded-2xl p-3.5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <VolumeOff className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-300">
                        Khung xem thử video: TẮT TIẾNG 100% (Không làm ồn Màn hình 2)
                      </span>
                    </div>
                    <button
                      onClick={() => setPreviewMutedId(null)}
                      className="text-neutral-400 hover:text-white text-xs p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="w-full aspect-video max-w-lg mx-auto rounded-xl overflow-hidden bg-black shadow-lg">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${previewMutedId}?autoplay=1&mute=1&controls=1&rel=0`}
                      title="Xem thử video tắt tiếng"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        const url = `https://www.youtube.com/watch?v=${previewMutedId}`;
                        copyResultUrl(url, previewMutedId);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow cursor-pointer transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép URL bài này</span>
                    </button>
                    <button
                      onClick={() => setPreviewMutedId(null)}
                      className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
                    >
                      Đóng xem thử
                    </button>
                  </div>
                </div>
              )}

              {/* Search Results List */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                    <span>Kết quả tìm kiếm ({searchResults.length} video):</span>
                    <span className="text-[11px] text-emerald-400">Bấm "Chép URL" để lấy link dán vào máy</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {searchResults.map((item) => {
                      const isCopiedThis = copiedResultId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-950 border border-neutral-800/90 hover:border-neutral-700 transition-all text-neutral-300 group"
                        >
                          <div className="relative w-20 h-13 rounded-lg overflow-hidden shrink-0 bg-neutral-900 border border-neutral-800">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            {item.duration && (
                              <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] font-mono text-white px-1 rounded">
                                {item.duration}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-white truncate" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {item.artist}
                            </p>

                            <div className="flex items-center gap-1.5 mt-2">
                              <button
                                type="button"
                                onClick={() => copyResultUrl(item.url, item.id)}
                                title="Sao chép URL YouTube vào bộ nhớ tạm"
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isCopiedThis
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700'
                                }`}
                              >
                                {isCopiedThis ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                                <span>{isCopiedThis ? 'Đã chép!' : 'Chép URL'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setPreviewMutedId(item.id)}
                                title="Xem thử video (TẮT TIẾNG, không làm ồn Màn hình 2)"
                                className="flex items-center gap-1 p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 rounded-md transition-colors cursor-pointer text-[11px]"
                              >
                                <VolumeOff className="w-3 h-3" />
                                <span className="hidden md:inline">Xem thử</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  processAndSaveLink(item.url, true);
                                }}
                                title="Phát bài này sang Màn hình 2 ngay"
                                className="ml-auto flex items-center gap-1 p-1 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-900 rounded-md transition-colors cursor-pointer text-[11px]"
                              >
                                <Tv className="w-3 h-3 text-emerald-400" />
                                <span>Phát Màn 2</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        </div>
      </main>

      {/* Screen 2 Setup & Launch Modal */}
      {isScreen2ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Xuất Video Sang Màn Hình Thứ 2</h3>
                  <p className="text-[11px] text-neutral-400">TV, máy chiếu hoặc màn hình máy tính phụ</p>
                </div>
              </div>
              <button
                onClick={() => setIsScreen2ModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  <span>Cách 1: Mở Cửa Sổ Màn Hình 2</span>
                </span>
                <p className="text-[11px] text-neutral-400">
                  Cửa sổ Màn hình 2 chạy bộ phát kép (chống lỗi video 100%). Kéo cửa sổ sang Màn hình 2, bấm chuột bất kỳ hoặc nhấn phím <strong className="text-white">F</strong> để bật toàn màn hình.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => playOnScreen2()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    <Tv className="w-4 h-4" />
                    <span>Mở Cửa Sổ Màn Hình 2 & Phát</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href={screen2DirectUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Tab Mới</span>
                  </a>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                  <span>Cách 2: Mở link trên Smart TV hoặc trình duyệt Màn hình 2</span>
                </span>
                <p className="text-[11px] text-neutral-400">
                  Nếu bạn mở trên TV hoặc thiết bị khác, sao chép đường link này và dán vào trình duyệt của Màn hình 2:
                </p>
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-2 font-mono text-[11px] text-neutral-300">
                  <span className="truncate flex-1">{screen2DirectUrl}</span>
                  <button
                    onClick={copyScreen2Link}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold shrink-0 cursor-pointer"
                  >
                    {isScreen2Copied ? 'Đã sao chép!' : 'Sao chép'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <button
                onClick={copyScreen2Link}
                className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                {isScreen2Copied ? 'Đã sao chép link Màn hình 2!' : 'Sao chép link Màn hình 2'}
              </button>

              <button
                onClick={() => setIsScreen2ModalOpen(false)}
                className="px-4 py-2 text-xs text-neutral-300 hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleep Timer Modal */}
      {isSleepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Hẹn giờ tắt video</span>
              </h3>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              {[
                { label: '15 phút', mins: 15 },
                { label: '30 phút', mins: 30 },
                { label: '45 phút', mins: 45 },
                { label: '60 phút', mins: 60 },
                { label: 'Hết video hiện tại', mins: -1 }
              ].map(opt => (
                <button
                  key={opt.mins}
                  onClick={() => setSleepTimer(opt.mins)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    sleepTimerMinutes === opt.mins
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-neutral-950 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              {sleepTimerRemaining !== null && (
                <button
                  onClick={() => setSleepTimer(null)}
                  className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Hủy hẹn giờ
                </button>
              )}
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="text-xs text-neutral-400 hover:text-white ml-auto cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Karaoke Score Celebration Modal */}
      <KaraokeScoreModal
        score={activeScore}
        isOpen={isScoreModalOpen}
        onClose={() => setIsScoreModalOpen(false)}
        onReplay={() => {
          if (currentSong) {
            playOnScreen2(currentSong);
          }
        }}
        onNextSong={() => {
          if (savedLinks.length > 1 && currentSong) {
            const currentIdx = savedLinks.findIndex(s => s.id === currentSong.id);
            const nextIdx = (currentIdx + 1) % savedLinks.length;
            const nextSong = savedLinks[nextIdx];
            setCurrentSong(nextSong);
            playOnScreen2(nextSong);
          }
        }}
        soundEnabled={karaokeConfig.soundEffectsEnabled}
        autoDismissSeconds={0}
      />

      {/* Karaoke Leaderboard Modal */}
      <KaraokeLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        scores={karaokeScores}
        onClearScores={() => setKaraokeScores([])}
        onSelectSongToPlay={(songId, songTitle) => {
          const song = savedLinks.find(s => s.id === songId) || {
            id: songId,
            url: `https://www.youtube.com/watch?v=${songId}`,
            title: songTitle,
            artist: 'Karaoke Track',
            thumbnail: getYouTubeThumbnail(songId),
            duration: 0,
            playedAt: Date.now()
          };
          setCurrentSong(song);
          playOnScreen2(song);
        }}
      />
    </div>
  );
}

import { KaraokeScore, KaraokeGrade, MicAudioStats } from '../types/karaoke';

/**
 * Sound Synthesizer via Web Audio API.
 * Generates zero-dependency sound effects for Arirang-style Karaoke celebrations!
 */
class SoundEffectsSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Sound of LED number counting up (beeps)
   */
  public playTick(frequency: number = 650) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.2, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  /**
   * Triumphal Karaoke fanfare chord sequence (Arirang victory theme)
   */
  public playFanfare(score: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const isUltra = score >= 96;
      const notes = isUltra
        ? [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]
        : [392.00, 523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, idx) => {
        const startTime = ctx.currentTime + idx * 0.12;
        const duration = idx === notes.length - 1 ? 1.5 : 0.25;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3, startTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch {}
  }

  /**
   * Synthesize applause / cheering effect via shaped filtered noise
   */
  public playApplause() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * 2.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const clapImpulse = Math.sin(t * 40 + Math.sin(t * 12) * 5) > 0.6 ? 1.4 : 0.4;
        data[i] = (Math.random() * 2 - 1) * clapImpulse;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(1.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 2.5);
    } catch {}
  }
}

export const soundEffects = new SoundEffectsSynthesizer();

/**
 * Real-time Microphone Input & Pitch / Energy Tracker
 */
export class KaraokeMicAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private isListening: boolean = false;
  private isMicrophoneActive: boolean = false;

  // Running statistics
  private totalFrames: number = 0;
  private singingFrames: number = 0;
  private volumeSum: number = 0;
  private peakVolume: number = 0;
  private goodPitchHits: number = 0;
  private lastPitch: number = 0;
  private pitchVarianceTotal: number = 0;

  // Callbacks
  private onStatsCallback?: (stats: MicAudioStats) => void;

  public async startListening(useRealMic: boolean = true, onStats?: (stats: MicAudioStats) => void): Promise<boolean> {
    this.onStatsCallback = onStats;
    this.resetStats();
    this.isListening = true;

    if (!useRealMic) {
      this.isMicrophoneActive = false;
      this.startSimulatedLoop();
      return true;
    }

    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      this.micStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.isMicrophoneActive = true;
      this.startAnalysisLoop();
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable, using karaoke simulator mode:', err);
      this.isMicrophoneActive = false;
      this.startSimulatedLoop();
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  public resetStats() {
    this.totalFrames = 0;
    this.singingFrames = 0;
    this.volumeSum = 0;
    this.peakVolume = 0;
    this.goodPitchHits = 0;
    this.lastPitch = 0;
    this.pitchVarianceTotal = 0;
  }

  public getSnapshotStats(): MicAudioStats {
    const avgVol = this.totalFrames > 0 ? this.volumeSum / this.totalFrames : 0;
    const stability = this.singingFrames > 0
      ? Math.max(70, Math.min(99, 100 - (this.pitchVarianceTotal / this.singingFrames)))
      : 88;

    return {
      volume: 0,
      pitchHz: 0,
      pitchConfidence: 0.85,
      isSinging: false,
      totalSingingFrames: this.singingFrames,
      totalSongFrames: this.totalFrames,
      averageVolume: avgVol,
      peakVolume: this.peakVolume,
      pitchStability: stability,
      goodNotesCount: this.goodPitchHits
    };
  }

  public isUsingRealMic(): boolean {
    return this.isMicrophoneActive;
  }

  private startAnalysisLoop() {
    if (!this.analyser) return;
    const buffer = new Float32Array(this.analyser.fftSize);

    const tick = () => {
      if (!this.isListening || !this.analyser) return;

      this.analyser.getFloatTimeDomainData(buffer);

      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const currentVolume = Math.min(100, Math.max(0, Math.round(rms * 400)));

      const { pitch, confidence } = this.detectPitchAutocorrelation(buffer, this.audioCtx?.sampleRate || 44100);
      const isSinging = currentVolume > 12;

      this.totalFrames++;
      this.volumeSum += currentVolume;
      if (currentVolume > this.peakVolume) {
        this.peakVolume = currentVolume;
      }

      if (isSinging) {
        this.singingFrames++;
        if (pitch > 65 && pitch < 900) {
          if (this.lastPitch > 0) {
            const diff = Math.abs(pitch - this.lastPitch);
            if (diff < 50) {
              this.goodPitchHits++;
              this.pitchVarianceTotal += Math.min(diff, 10);
            }
          }
          this.lastPitch = pitch;
        }
      }

      if (this.onStatsCallback) {
        this.onStatsCallback({
          volume: currentVolume,
          pitchHz: Math.round(pitch),
          pitchConfidence: confidence,
          isSinging,
          totalSingingFrames: this.singingFrames,
          totalSongFrames: this.totalFrames,
          averageVolume: this.totalFrames > 0 ? this.volumeSum / this.totalFrames : 0,
          peakVolume: this.peakVolume,
          pitchStability: this.singingFrames > 0
            ? Math.max(70, Math.min(99, 100 - (this.pitchVarianceTotal / this.singingFrames)))
            : 88,
          goodNotesCount: this.goodPitchHits
        });
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    tick();
  }

  private startSimulatedLoop() {
    let tickCount = 0;
    const simTick = () => {
      if (!this.isListening) return;
      tickCount++;

      const wave = Math.sin(tickCount * 0.08) * Math.cos(tickCount * 0.03);
      const isSinging = wave > 0.15;
      const simVolume = isSinging ? Math.round(40 + Math.abs(wave) * 45 + Math.random() * 10) : Math.round(Math.random() * 8);
      const simPitch = isSinging ? Math.round(220 + Math.sin(tickCount * 0.1) * 80 + Math.random() * 10) : 0;

      this.totalFrames++;
      this.volumeSum += simVolume;
      if (simVolume > this.peakVolume) this.peakVolume = simVolume;

      if (isSinging) {
        this.singingFrames++;
        this.goodPitchHits++;
      }

      if (this.onStatsCallback) {
        this.onStatsCallback({
          volume: simVolume,
          pitchHz: simPitch,
          pitchConfidence: 0.9,
          isSinging,
          totalSingingFrames: this.singingFrames,
          totalSongFrames: this.totalFrames,
          averageVolume: this.totalFrames > 0 ? this.volumeSum / this.totalFrames : 45,
          peakVolume: this.peakVolume || 85,
          pitchStability: 92,
          goodNotesCount: this.goodPitchHits
        });
      }

      this.animationFrameId = requestAnimationFrame(simTick);
    };

    simTick();
  }

  private detectPitchAutocorrelation(buffer: Float32Array, sampleRate: number): { pitch: number; confidence: number } {
    const SIZE = buffer.length;
    let r1 = 0;
    let r2 = SIZE - 1;
    const thres = 0.05;

    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
      }
    }

    const trimmed = buffer.slice(r1, r2);
    const c = new Float32Array(trimmed.length);
    for (let i = 0; i < trimmed.length; i++) {
      for (let j = 0; j < trimmed.length - i; j++) {
        c[i] = c[i] + trimmed[j] * trimmed[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < trimmed.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    if (maxpos === -1 || maxval < 0.01) {
      return { pitch: 0, confidence: 0 };
    }

    const pitch = sampleRate / maxpos;
    const confidence = Math.min(1, maxval / (c[0] || 1));
    return { pitch, confidence };
  }
}

const SCORE_TIERS = [
  {
    minScore: 98,
    grade: 'S+' as KaraokeGrade,
    title: '🌟 CA SĨ TRIỂN VỌNG - ĐỈNH CAO!',
    feedbacks: [
      'Giọng hát vàng làm say đắm toàn bộ khán phòng! Cao độ tuyệt đỉnh, luyến láy như ca sĩ chuyên nghiệp!',
      'Quá xuất sắc! Giọng hát truyền cảm và nội lực dồi dào, xứng đáng 100 điểm vẹn toàn!',
      'Hát hay đến mức ban giám khảo nổi da gà! Quán quân karaoke của đêm tiệc hôm nay!'
    ]
  },
  {
    minScore: 94,
    grade: 'S' as KaraokeGrade,
    title: '🔥 CA SĨ CHUYÊN NGHIỆP!',
    feedbacks: [
      'Bắt nhịp chuẩn xác, hơi thở rất dày và tự tin! Giọng hát đầy nội lực và phong cách!',
      'Giọng ca quá mượt mà! Đoạn cao trào xử lý rất khéo léo, cả phòng hát đang vỗ tay tán thưởng!',
      'Hát rất có hồn và cảm xúc! Chỉ cần luyện thêm chút rung giọng là đi thi Tiếng Hát Truyền Hình được rồi!'
    ]
  },
  {
    minScore: 90,
    grade: 'A+' as KaraokeGrade,
    title: '🎤 GIỌNG CA VÀNG SÂN KHẤU!',
    feedbacks: [
      'Hát rất đúng nhịp và đúng nốt! Phong thái tự tin, giai điệu ngân nga rất truyền cảm!',
      'Một màn trình diễn ấn tượng! Hát đầy nhiệt huyết và năng lượng, giữ nhịp cực kỳ tốt!',
      'Giọng hát ngọt ngào và ấm áp! Hãy tiếp tục phát huy ở những bài hát tiếp theo nhé!'
    ]
  },
  {
    minScore: 85,
    grade: 'A' as KaraokeGrade,
    title: '👏 GIỌNG HÁT TIỀM NĂNG!',
    feedbacks: [
      'Hát rất nhiệt tình và vui tươi! Bắt nhịp tốt ở điệp khúc, thêm chút tự tin ở nốt cao sẽ đạt điểm tuyệt đối!',
      'Rất có năng khiếu âm nhạc! Hát say mê và mang lại bầu không khí vui vẻ cho cả nhóm!',
      'Khá lắm! Tiếng hát vang và rõ lời, chỉ cần giữ hơi đều hơn ở những câu dài là hoàn hảo!'
    ]
  },
  {
    minScore: 0,
    grade: 'B+' as KaraokeGrade,
    title: '🎉 VUI LÀ CHÍNH - ĐAM MÊ BẤT DIỆT!',
    feedbacks: [
      'Tinh thần karaoke trên cả tuyệt vời! Hát hết mình, quẩy nhiệt tình là có ngay tràng pháo tay giòn giã!',
      'Hát bằng cả trái tim và đam mê! Tiếp tục làm thêm bài nữa để bứt phá lên 100 điểm nào!'
    ]
  }
];

export function calculateKaraokeScore(
  songTitle: string,
  songId: string,
  stats: MicAudioStats,
  strictness: 'easy' | 'standard' | 'pro' = 'standard',
  singerName: string = 'Ca sĩ bí ẩn'
): KaraokeScore {
  let baseScore = 90;
  const variance = Math.floor(Math.random() * 7);

  const energyBonus = stats.peakVolume > 50 ? 3 : 1;
  const stabilityBonus = stats.pitchStability > 85 ? 3 : 1;
  const notesBonus = stats.goodNotesCount > 20 ? 3 : 1;

  let totalScore = baseScore + variance + energyBonus + stabilityBonus + notesBonus - 5;

  if (strictness === 'easy') {
    totalScore = Math.max(92, Math.min(100, totalScore + 4));
  } else if (strictness === 'pro') {
    totalScore = Math.max(82, Math.min(98, totalScore - 3));
  } else {
    totalScore = Math.max(86, Math.min(100, totalScore));
  }

  if (Math.random() > 0.88 && totalScore >= 96) {
    totalScore = 100;
  }

  const pitchScore = Math.min(100, Math.max(85, Math.round(totalScore + (Math.random() * 4 - 2))));
  const rhythmScore = Math.min(100, Math.max(86, Math.round(totalScore + (Math.random() * 4 - 2))));
  const energyScore = Math.min(100, Math.max(84, Math.round(totalScore + (Math.random() * 4 - 2))));
  const emotionScore = Math.min(100, Math.max(88, Math.round(totalScore + (Math.random() * 4 - 2))));

  const tier = SCORE_TIERS.find(t => totalScore >= t.minScore) || SCORE_TIERS[SCORE_TIERS.length - 1];
  const randomFeedback = tier.feedbacks[Math.floor(Math.random() * tier.feedbacks.length)];

  return {
    id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    songId,
    songTitle,
    singerName,
    totalScore,
    grade: tier.grade,
    rankTitle: tier.title,
    feedback: randomFeedback,
    pitchScore,
    rhythmScore,
    energyScore,
    emotionScore,
    singingDurationSeconds: Math.round(stats.totalSingingFrames / 60) || 120,
    scoredAt: Date.now()
  };
}

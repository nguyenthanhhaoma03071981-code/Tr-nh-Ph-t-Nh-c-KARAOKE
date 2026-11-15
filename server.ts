import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Google Gemini AI if API key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// Global in-memory sync state for multi-screen display (works across iframes, tabs, and devices)
let activeSyncState = {
  song: {
    id: 'abPmFU6513Y',
    title: 'Đừng Làm Trái Tim Anh Đau',
    artist: 'Sơn Tùng M-TP',
    url: 'https://www.youtube.com/watch?v=abPmFU6513Y',
    thumbnail: 'https://img.youtube.com/vi/abPmFU6513Y/hqdefault.jpg',
    duration: 312,
    playedAt: Date.now()
  },
  isPlaying: true,
  currentTime: 0,
  command: 'play', // 'play' | 'pause' | 'seek'
  updatedAt: Date.now()
};

app.get('/api/sync/current', (_req: Request, res: Response) => {
  res.json(activeSyncState);
});

app.post('/api/sync/current', (req: Request, res: Response) => {
  if (req.body?.song) {
    activeSyncState = {
      song: req.body.song,
      isPlaying: req.body.isPlaying ?? activeSyncState.isPlaying,
      currentTime: req.body.currentTime ?? activeSyncState.currentTime,
      command: req.body.command || 'play',
      updatedAt: Date.now()
    };
  } else if (typeof req.body?.isPlaying === 'boolean' || typeof req.body?.currentTime === 'number') {
    activeSyncState = {
      ...activeSyncState,
      isPlaying: req.body.isPlaying ?? activeSyncState.isPlaying,
      currentTime: req.body.currentTime ?? activeSyncState.currentTime,
      command: req.body.command || activeSyncState.command,
      updatedAt: Date.now()
    };
  }
  res.json({ success: true, activeSyncState });
});

// Endpoint to fetch YouTube video metadata safely
app.get('/api/youtube-info', async (req: Request, res: Response) => {
  try {
    const videoId = req.query.id as string;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: 'Mã video YouTube không hợp lệ' });
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      // Fallback with clean title if oEmbed not allowed
      return res.json({
        id: videoId,
        title: `YouTube Track (${videoId})`,
        author_name: 'YouTube Music Artist',
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      });
    }

    const data = (await response.json()) as { title: string; author_name: string; thumbnail_url: string };
    return res.json({
      id: videoId,
      title: data.title || `Track ${videoId}`,
      author_name: data.author_name || 'Nghệ sĩ',
      thumbnail_url: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    });
  } catch (error: any) {
    console.error('Lỗi khi lấy thông tin YouTube:', error);
    return res.status(500).json({ error: 'Không thể kết nối với YouTube' });
  }
});

// Endpoint to search YouTube videos for the Cốc Cốc / Search Tool
app.get('/api/youtube-search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.json({ results: [] });
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=vi`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi,en;q=0.9'
      }
    });

    if (!response.ok) {
      return res.json({ results: [] });
    }

    const html = await response.text();
    const results: any[] = [];

    // Parse ytInitialData JSON
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/s) ||
                  html.match(/window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/s);

    if (match && match[1]) {
      try {
        const data = JSON.parse(match[1]);
        const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        for (const section of sections) {
          const items = section?.itemSectionRenderer?.contents || [];
          for (const item of items) {
            const v = item?.videoRenderer;
            if (v && v.videoId && results.length < 15) {
              const videoId = v.videoId;
              const title = v.title?.runs?.[0]?.text || '';
              const artist = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube';
              const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              const duration = v.lengthText?.simpleText || '';
              const url = `https://www.youtube.com/watch?v=${videoId}`;

              if (title && !results.some(r => r.id === videoId)) {
                results.push({ id: videoId, title, artist, thumbnail, duration, url });
              }
            }
          }
        }
      } catch (err) {
        console.warn('JSON parse error in ytInitialData:', err);
      }
    }

    // Fallback regex parser if JSON extraction didn't find items
    if (results.length === 0) {
      const videoRegex = /"videoId":"([a-zA-Z0-9_-]{11})".+?"title":{"runs":\[{"text":"([^"]+)"\].+?"ownerText":{"runs":\[{"text":"([^"]+)"/g;
      let m;
      while ((m = videoRegex.exec(html)) !== null && results.length < 12) {
        const videoId = m[1];
        const title = m[2];
        const artist = m[3] || 'YouTube';
        if (!results.some(r => r.id === videoId)) {
          results.push({
            id: videoId,
            title,
            artist,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            duration: '',
            url: `https://www.youtube.com/watch?v=${videoId}`
          });
        }
      }
    }

    return res.json({ results });
  } catch (err: any) {
    console.error('Lỗi tìm kiếm YouTube:', err);
    return res.json({ results: [] });
  }
});

// Endpoint for AI Music Playlist / Vibe Generator
app.post('/api/ai-recommend', async (req: Request, res: Response) => {
  try {
    const { prompt, currentTracks } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Vui lòng cung cấp cảm xúc hoặc thể loại nhạc bạn muốn nghe' });
    }

    if (!ai) {
      // Graceful smart fallback recommendation if key is not configured
      return res.json({
        theme: prompt,
        message: 'Gợi ý playlist tự động dựa trên tâm trạng của bạn',
        recommendations: [
          {
            id: 'abPmFU6513Y',
            title: 'Đừng Làm Trái Tim Anh Đau',
            artist: 'Sơn Tùng M-TP',
            reason: 'Giai điệu vui tươi, tràn đầy năng lượng tích cực'
          },
          {
            id: 'G9bL2e0wVjI',
            title: 'Bước Qua Mùa Cô Đơn',
            artist: 'Vũ.',
            reason: 'Phù hợp với không gian yên tĩnh và lắng đọng'
          },
          {
            id: 'jfKfPfyJRdk',
            title: 'Lofi Hip Hop Radio',
            artist: 'Lofi Girl',
            reason: 'Hòa âm thư giãn tuyệt vời khi làm việc'
          },
          {
            id: 'ekr2nIex040',
            title: 'APT.',
            artist: 'ROSÉ & Bruno Mars',
            reason: 'Nhịp điệu bắt tai, phấn chấn tinh thần'
          }
        ]
      });
    }

    const aiPrompt = `Bạn là một DJ và chuyên gia tuyển chọn âm nhạc tinh tế cho ứng dụng nghe nhạc YouTube WaveTune.
Người dùng yêu cầu playlist theo tâm trạng/sở thích: "${prompt}".
Danh sách các bài hát sẵn có trong thư viện:
${JSON.stringify(currentTracks || [])}

Hãy chọn hoặc gợi ý 4 đến 6 bài hát phù hợp nhất. Trả về định dạng JSON thuần túy (không bọc trong markdown hay text khác) với cấu trúc:
{
  "theme": "Tên chủ đề playlist ngắn gọn hấp dẫn",
  "moodDescription": "1-2 câu nhận xét về cảm xúc playlist này mang lại",
  "selectedIds": ["id1", "id2", ...],
  "recommendations": [
    { "title": "Tên bài hát", "artist": "Nghệ sĩ", "reason": "Lý do bài này hợp tâm trạng", "id": "id_nếu_có" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: aiPrompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err: any) {
    console.error('AI recommendation error:', err);
    return res.status(500).json({
      error: 'Không thể tạo gợi ý âm nhạc lúc này',
      details: err.message
    });
  }
});

// Setup Vite middlewares in development or static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server WaveTune đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();

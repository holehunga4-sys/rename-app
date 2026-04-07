import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for base64 images
  app.use(express.json({ limit: '10mb' }));

  // API route for AI generation
  app.post('/api/generate-title', async (req, res) => {
    const { image, mimeType, prompt, userApiKey } = req.body;

    // Use user-provided key if available, otherwise fallback to app-owned secret
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Vui lòng nhập Gemini API Key hoặc cấu hình server.' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: image,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      res.json(JSON.parse(text || '{}'));
    } catch (error: any) {
      console.error('Server AI Error:', error);
      res.status(500).json({ error: error.message || 'Lỗi máy chủ khi xử lý AI.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

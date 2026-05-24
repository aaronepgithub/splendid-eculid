import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Proxy API requests to avoid CORS issues in development
  app.all("/api/v1/*", async (req, res) => {
    const targetUrl = `https://aaronep.pythonanywhere.com${req.originalUrl}`;
    const method = req.method;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      // For POST/PUT etc, parse the body if it's sent
      // Express might not have parsed it yet, so we parse it or read it.
      // We can use express.json() middleware.
      fetchOptions.body = JSON.stringify(req.body);
    }

    try {
      const response = await fetch(targetUrl, fetchOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json(errorData || { error: `API error: ${response.statusText}` });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(`Error proxying to ${targetUrl}:`, error);
      res.status(500).json({ error: "Failed to fetch from backend" });
    }
  });

  // Body parser for non-API requests (if any)
  app.use(express.json());

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

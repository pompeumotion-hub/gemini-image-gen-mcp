import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { generateImage, editImage } from "./gemini-client.js";

const app = express();
const port = process.env.PORT ?? 3000;
const upload = multer({ dest: "./uploads/" });

app.use(cors());
app.use(express.json());
app.use("/outputs", express.static(path.resolve("./outputs")));

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Gemini Image Generator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #eee; min-height: 100vh; padding: 2rem; }
    h1 { text-align: center; margin-bottom: 2rem; font-size: 2rem; background: linear-gradient(135deg, #4285f4, #ea4335, #fbbc04, #34a853); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.4rem; font-size: 0.85rem; color: #aaa; }
    textarea, input[type=text], select { width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid #444; background: #111; color: #eee; font-size: 1rem; resize: vertical; }
    button { margin-top: 1rem; padding: 0.75rem 2rem; border-radius: 8px; border: none; background: #4285f4; color: #fff; font-size: 1rem; cursor: pointer; width: 100%; }
    button:hover { background: #3367d6; }
    button:disabled { background: #333; cursor: not-allowed; }
    #result { margin-top: 1.5rem; }
    #result img { max-width: 100%; border-radius: 8px; margin-top: 1rem; }
    #result p { color: #aaa; font-size: 0.9rem; margin-top: 0.5rem; }
    .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .tab { flex: 1; padding: 0.6rem; text-align: center; border-radius: 8px; cursor: pointer; border: 1px solid #444; background: #111; color: #aaa; }
    .tab.active { background: #4285f4; color: #fff; border-color: #4285f4; }
    .section { display: none; }
    .section.active { display: block; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h1>Gemini Image Generator</h1>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('generate')">Generate</div>
    <div class="tab" onclick="switchTab('edit')">Edit Image</div>
  </div>

  <div id="generate" class="section active">
    <div class="card">
      <label>Prompt</label>
      <textarea id="gen-prompt" rows="4" placeholder="A futuristic city at sunset, cyberpunk style..."></textarea>
      <button id="gen-btn" onclick="generate()">Generate Image</button>
    </div>
  </div>

  <div id="edit" class="section">
    <div class="card">
      <label>Source Image</label>
      <input type="file" id="edit-file" accept="image/*" />
      <label style="margin-top:1rem">Edit Prompt</label>
      <textarea id="edit-prompt" rows="3" placeholder="Make the sky purple and add stars..."></textarea>
      <button id="edit-btn" onclick="editImg()">Edit Image</button>
    </div>
  </div>

  <div id="result"></div>

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', ['generate','edit'][i] === tab));
      document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === tab));
    }

    async function generate() {
      const prompt = document.getElementById('gen-prompt').value.trim();
      if (!prompt) return alert('Please enter a prompt');
      const btn = document.getElementById('gen-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Generating...';
      document.getElementById('result').innerHTML = '';
      try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        document.getElementById('result').innerHTML = \`<img src="/outputs/\${data.filename}" /><p>\${data.text || ''}</p>\`;
      } catch (e) {
        document.getElementById('result').innerHTML = \`<p style="color:#f44">Error: \${e.message}</p>\`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Image';
      }
    }

    async function editImg() {
      const file = document.getElementById('edit-file').files[0];
      const prompt = document.getElementById('edit-prompt').value.trim();
      if (!file || !prompt) return alert('Please select an image and enter a prompt');
      const btn = document.getElementById('edit-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Editing...';
      document.getElementById('result').innerHTML = '';
      const form = new FormData();
      form.append('image', file);
      form.append('prompt', prompt);
      try {
        const res = await fetch('/api/edit', { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        document.getElementById('result').innerHTML = \`<img src="/outputs/\${data.filename}" /><p>\${data.text || ''}</p>\`;
      } catch (e) {
        document.getElementById('result').innerHTML = \`<p style="color:#f44">Error: \${e.message}</p>\`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Edit Image';
      }
    }
  </script>
</body>
</html>`);
});

app.post("/api/generate", async (req, res) => {
  const { prompt, aspect_ratio } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  try {
    const { images, text } = await generateImage({ prompt, aspectRatio: aspect_ratio });
    if (!images.length) return res.status(500).json({ error: "No image generated", text });
    res.json({ filename: images[0].filename, filepath: images[0].filepath, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/edit", upload.single("image"), async (req, res) => {
  const { prompt } = req.body;
  const file = req.file;
  if (!file || !prompt) return res.status(400).json({ error: "image and prompt are required" });
  try {
    const { images, text } = await editImage({ imagePath: file.path, prompt });
    fs.unlinkSync(file.path);
    if (!images.length) return res.status(500).json({ error: "No image returned", text });
    res.json({ filename: images[0].filename, filepath: images[0].filepath, text });
  } catch (err) {
    if (file?.path) try { fs.unlinkSync(file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Web server running at http://localhost:${port}`);
});

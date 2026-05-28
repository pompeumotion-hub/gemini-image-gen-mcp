import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import os from "os";

const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), "gemini-outputs");

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in environment");
  return new GoogleGenerativeAI(key);
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new Error(`Cannot create output directory "${dir}": ${err.message}`);
  }
}

function parseResponse(response, outputDir, filenamePrefix) {
  const candidate = response?.candidates?.[0];
  if (!candidate) {
    const block = response?.promptFeedback?.blockReason;
    throw new Error(block ? `Gemini blocked the request: ${block}` : "Gemini returned no candidates");
  }

  const parts = candidate.content?.parts ?? [];
  const images = [];

  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      const ext = (part.inlineData.mimeType.split("/")[1] || "png").split("+")[0];
      const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, "base64"));
      images.push({ filename, filepath, mimeType: part.inlineData.mimeType, base64: part.inlineData.data });
    }
  }

  const text = parts.filter((p) => p.text).map((p) => p.text).join("\n");

  if (images.length === 0) {
    const finishReason = candidate.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error(`Gemini did not return an image (finishReason: ${finishReason})${text ? `. Response: ${text}` : ""}`);
    }
  }

  return { images, text };
}

export async function generateImage({ prompt, aspectRatio = "1:1", outputDir = DEFAULT_OUTPUT_DIR }) {
  ensureDir(outputDir);
  const model = getClient().getGenerativeModel({ model: "gemini-2.5-flash-image" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["image", "text"] },
  });

  return parseResponse(result.response, outputDir, "gemini");
}

export async function editImage({ imagePath, imageBase64, imageMimeType, prompt, outputDir = DEFAULT_OUTPUT_DIR }) {
  ensureDir(outputDir);

  let base64, mimeType;
  if (imageBase64) {
    base64 = imageBase64.replace(/^data:image\/[\w.+-]+;base64,/, "");
    mimeType = imageMimeType || "image/png";
  } else if (imagePath) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Source image not found: ${imagePath}`);
    }
    const imageData = fs.readFileSync(imagePath);
    base64 = imageData.toString("base64");
    const ext = path.extname(imagePath).toLowerCase();
    mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  } else {
    throw new Error("Either imagePath or imageBase64 is required");
  }

  const model = getClient().getGenerativeModel({ model: "gemini-2.5-flash-image" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseModalities: ["image", "text"] },
  });

  return parseResponse(result.response, outputDir, "edited");
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import os from "os";

const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), "gemini-outputs");
fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateImage({ prompt, aspectRatio = "1:1", outputDir = DEFAULT_OUTPUT_DIR }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["image", "text"],
    },
  });

  const response = result.response;
  const images = [];

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      const ext = part.inlineData.mimeType.split("/")[1];
      const filename = `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      fs.mkdirSync(outputDir, { recursive: true });
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, "base64"));

      images.push({ filename, filepath, mimeType: part.inlineData.mimeType, base64: part.inlineData.data });
    }
  }

  const text = response.candidates[0].content.parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n");

  return { images, text };
}

export async function editImage({ imagePath, imageBase64, imageMimeType, prompt, outputDir = DEFAULT_OUTPUT_DIR }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

  let base64, mimeType;
  if (imageBase64) {
    base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    mimeType = imageMimeType || "image/png";
  } else if (imagePath) {
    const imageData = fs.readFileSync(imagePath);
    base64 = imageData.toString("base64");
    const ext = path.extname(imagePath).toLowerCase();
    mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  } else {
    throw new Error("Either imagePath or imageBase64 is required");
  }

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

  const response = result.response;
  const images = [];

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      const ext = part.inlineData.mimeType.split("/")[1];
      const filename = `edited_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      fs.mkdirSync(outputDir, { recursive: true });
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, "base64"));
      images.push({ filename, filepath, mimeType: part.inlineData.mimeType, base64: part.inlineData.data });
    }
  }

  const text = response.candidates[0].content.parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n");

  return { images, text };
}

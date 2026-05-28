import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateImage({ prompt, aspectRatio = "1:1", outputDir = "./outputs" }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp-image-generation" });

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

export async function editImage({ imagePath, prompt, outputDir = "./outputs" }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp-image-generation" });

  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

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

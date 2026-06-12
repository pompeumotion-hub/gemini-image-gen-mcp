import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateImage, editImage } from "./gemini-client.js";
import path from "path";

const server = new McpServer({
  name: "gemini-image-gen",
  version: "1.0.0",
});

server.tool(
  "generate_image",
  "Generate an image from a text prompt using Google Gemini. Returns the filepath where the image was saved on disk.",
  {
    prompt: z.string().min(1).describe("Text description of the image to generate"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().describe("Aspect ratio of the image"),
    output_dir: z.string().optional().describe("Directory to save the generated image (defaults to ~/gemini-outputs)"),
  },
  async ({ prompt, aspect_ratio, output_dir }) => {
    try {
      const { images, text } = await generateImage({
        prompt,
        aspectRatio: aspect_ratio,
        ...(output_dir ? { outputDir: output_dir } : {}),
      });

      if (images.length === 0) {
        return { content: [{ type: "text", text: "No image was generated. " + (text || "") }] };
      }

      const img = images[0];
      return {
        content: [
          { type: "text", text: `✅ Image saved to: ${img.filepath}\nSize: ${(img.base64.length * 3 / 4 / 1024).toFixed(1)} KB${text ? "\n\nGemini text: " + text : ""}` },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "edit_image",
  "Edit an existing image using a text prompt. Provide EITHER image_path (path on disk) OR image_base64 (raw base64 data). Returns the filepath of the edited image.",
  {
    prompt: z.string().min(1).describe("Instructions for how to edit the image"),
    image_path: z.string().optional().describe("Path to the source image on disk"),
    image_base64: z.string().optional().describe("Base64-encoded image data (alternative to image_path)"),
    image_mime_type: z.string().optional().describe("MIME type when using image_base64 (e.g. image/png, image/jpeg)"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().describe("Aspect ratio of the output image"),
    output_dir: z.string().optional().describe("Directory to save the edited image"),
  },
  async ({ image_path, image_base64, image_mime_type, prompt, aspect_ratio, output_dir }) => {
    try {
      if (!image_path && !image_base64) {
        return { content: [{ type: "text", text: "Error: provide image_path or image_base64" }], isError: true };
      }
      const { images, text } = await editImage({
        ...(image_path ? { imagePath: path.resolve(image_path) } : {}),
        ...(image_base64 ? { imageBase64: image_base64, imageMimeType: image_mime_type } : {}),
        prompt,
        ...(aspect_ratio ? { aspectRatio: aspect_ratio } : {}),
        ...(output_dir ? { outputDir: output_dir } : {}),
      });

      if (images.length === 0) {
        return { content: [{ type: "text", text: "No image was returned. " + (text || "") }] };
      }

      const img = images[0];
      return {
        content: [
          { type: "text", text: `✅ Edited image saved to: ${img.filepath}\nSize: ${(img.base64.length * 3 / 4 / 1024).toFixed(1)} KB${text ? "\n\nGemini text: " + text : ""}` },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

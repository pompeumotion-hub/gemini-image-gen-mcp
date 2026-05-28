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
  "Generate an image from a text prompt using Google Gemini",
  {
    prompt: z.string().describe("Text description of the image to generate"),
    aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional().describe("Aspect ratio of the image"),
    output_dir: z.string().optional().describe("Directory to save the generated image"),
  },
  async ({ prompt, aspect_ratio, output_dir }) => {
    try {
      const { images, text } = await generateImage({
        prompt,
        aspectRatio: aspect_ratio,
        outputDir: output_dir ?? "./outputs",
      });

      if (images.length === 0) {
        return { content: [{ type: "text", text: "No image was generated. " + (text || "") }] };
      }

      const img = images[0];
      return {
        content: [
          { type: "text", text: `Image saved to: ${img.filepath}${text ? "\n\n" + text : ""}` },
          { type: "image", data: img.base64, mimeType: img.mimeType },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "edit_image",
  "Edit an existing image using a text prompt with Google Gemini",
  {
    image_path: z.string().describe("Absolute or relative path to the source image"),
    prompt: z.string().describe("Instructions for how to edit the image"),
    output_dir: z.string().optional().describe("Directory to save the edited image"),
  },
  async ({ image_path, prompt, output_dir }) => {
    try {
      const { images, text } = await editImage({
        imagePath: path.resolve(image_path),
        prompt,
        outputDir: output_dir ?? "./outputs",
      });

      if (images.length === 0) {
        return { content: [{ type: "text", text: "No image was returned. " + (text || "") }] };
      }

      const img = images[0];
      return {
        content: [
          { type: "text", text: `Edited image saved to: ${img.filepath}${text ? "\n\n" + text : ""}` },
          { type: "image", data: img.base64, mimeType: img.mimeType },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

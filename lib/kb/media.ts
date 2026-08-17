import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createOpenAI } from "@/lib/compat";

const LUNA = process.env.KB_CHUNK_MODEL || "gpt-5.6-luna";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const DOC_EXT = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md", ".csv"]);

export function fileKind(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image" as const;
  if (VIDEO_EXT.has(ext)) return "video" as const;
  if (DOC_EXT.has(ext)) return "doc" as const;
  return "other" as const;
}

function mimeOf(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return (
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".pdf": "application/pdf",
    }[ext] || "application/octet-stream"
  );
}

async function lunaDescribeImage(filename: string, buf: Buffer) {
  const client = createOpenAI();
  const mime = mimeOf(filename);
  const res = await client.chat.completions.create({
    model: LUNA,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "你是立项裁判的档案书记员。请把这张图片转写成知识库可用的中文说明：包含可见文字（原样）、图表数字、组织/产品/约束信息。不要臆造看不清的内容。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `文件名：${filename}。请完整转写。` },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${buf.toString("base64")}` },
          },
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || "";
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exit ${code}`));
    });
  });
}

async function extractVideoFrames(videoPath: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sabc-frames-"));
  const pattern = path.join(dir, "frame-%03d.jpg");
  await run("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    "fps=1/8,scale=960:-1",
    "-vframes",
    "10",
    pattern,
  ]);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(dir, f));
  return { dir, files };
}

export async function extractMediaText(opts: {
  filename: string;
  storedPath: string;
  buf: Buffer;
}): Promise<string> {
  const kind = fileKind(opts.filename);
  if (kind === "image") {
    return lunaDescribeImage(opts.filename, opts.buf);
  }
  if (kind === "video") {
    const { dir, files } = await extractVideoFrames(opts.storedPath);
    try {
      if (!files.length) throw new Error("未能抽出视频帧，请改传文字或截图");
      const notes: string[] = [];
      for (const [i, file] of files.entries()) {
        const frame = fs.readFileSync(file);
        const text = await lunaDescribeImage(`${opts.filename}#frame${i + 1}`, frame);
        if (text) notes.push(`【第${i + 1}帧】\n${text}`);
      }
      return notes.join("\n\n");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return "";
}

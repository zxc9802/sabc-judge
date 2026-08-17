import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function extOf(name: string) {
  return path.extname(name).toLowerCase();
}

async function parsePdf(buf: Buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text || "");
}

async function parseDocx(buf: Buffer) {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ buffer: buf });
  return res.value || "";
}

async function parsePptx(buf: Buffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const chunks: string[] = [];
  for (const name of slides) {
    const xml = await zip.files[name].async("string");
    const text = xml
      .replace(/<a:t[^>]*>/g, "")
      .replace(/<\/a:t>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (text) chunks.push(text);
  }
  return chunks.join("\n");
}

export async function parseBuffer(filename: string, buf: Buffer) {
  const ext = extOf(filename);
  let text = "";
  if (ext === ".pdf") text = await parsePdf(buf);
  else if (ext === ".docx" || ext === ".doc") text = await parseDocx(buf);
  else if (ext === ".pptx" || ext === ".ppt") text = await parsePptx(buf);
  else text = buf.toString("utf8");
  return text.replace(/\u0000/g, "").trim();
}

export async function parseUploadedFile(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extOf(file.name);
  const id = nanoid(10);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const stored = path.join(UPLOAD_DIR, `${id}${ext || ".bin"}`);
  fs.writeFileSync(stored, buf);

  let text = "";
  let error: string | null = null;
  try {
    if (ext === ".pdf") text = await parsePdf(buf);
    else if (ext === ".docx") text = await parseDocx(buf);
    else if (ext === ".doc") text = await parseDocx(buf);
    else if (ext === ".pptx" || ext === ".ppt") text = await parsePptx(buf);
    else text = buf.toString("utf8");
  } catch {
    error = "parse_failed";
  }
  text = text.replace(/\u0000/g, "").trim();
  if (!text) error = error || "empty";
  return {
    id,
    filename: file.name,
    storedPath: stored,
    text: text.slice(0, 40000),
    error,
  };
}

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "faiss_store.py");

export type FaissHit = { id: string; score: number };

function runPy(payload: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || out || `faiss exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(out || "{}"));
      } catch {
        reject(new Error(`faiss bad json: ${out.slice(0, 200)}`));
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function faissAdd(items: Array<{ id: string; vector: number[] }>) {
  if (!items.length) return;
  fs.mkdirSync(path.join(process.cwd(), "data", "kb"), { recursive: true });
  await runPy({ op: "add", items });
}

export async function faissRebuild(items: Array<{ id: string; vector: number[] }>) {
  fs.mkdirSync(path.join(process.cwd(), "data", "kb"), { recursive: true });
  await runPy({ op: "rebuild", items });
}

export async function faissSearch(vector: number[], k = 8): Promise<FaissHit[]> {
  const res = await runPy({ op: "search", vector, k });
  return (res.hits as FaissHit[]) || [];
}

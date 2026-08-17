import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "sabc.db");

let sqlite: DatabaseSync | null = null;

function migrate(raw: DatabaseSync) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      main_business TEXT NOT NULL DEFAULT '',
      team_capability TEXT NOT NULL DEFAULT '',
      resources TEXT NOT NULL DEFAULT '',
      strategy TEXT NOT NULL DEFAULT '',
      red_lines TEXT NOT NULL DEFAULT '',
      extra_docs TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      what TEXT,
      target_customer TEXT,
      revenue_model TEXT,
      budget TEXT,
      timeline TEXT,
      assumed TEXT NOT NULL DEFAULT '[]',
      source_docs TEXT NOT NULL DEFAULT '[]',
      dialogue TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      company_id TEXT,
      status TEXT NOT NULL,
      grade TEXT,
      verdict TEXT,
      weighted TEXT,
      dimensions TEXT,
      shortboard TEXT,
      fatal_flaw TEXT,
      roi_calc TEXT,
      customized INTEGER NOT NULL DEFAULT 0,
      degraded TEXT,
      error TEXT,
      search_count INTEGER NOT NULL DEFAULT 0,
      intake_round INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      claim TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      cross_validated INTEGER NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL,
      source_level TEXT NOT NULL DEFAULT 'unknown'
    );
    CREATE TABLE IF NOT EXISTS panel_opinions (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      persona TEXT NOT NULL,
      stance TEXT NOT NULL,
      argument TEXT NOT NULL,
      evidence_refs TEXT NOT NULL DEFAULT '[]',
      round TEXT NOT NULL,
      experiential INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS research_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluation_id TEXT NOT NULL,
      step INTEGER NOT NULL,
      kind TEXT NOT NULL,
      action_text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eval_status ON evaluations(status);
    CREATE INDEX IF NOT EXISTS idx_evidence_eval ON evidence(evaluation_id);
    CREATE INDEX IF NOT EXISTS idx_logs_eval ON research_logs(evaluation_id, step);
    CREATE INDEX IF NOT EXISTS idx_panel_eval ON panel_opinions(evaluation_id);
    CREATE TABLE IF NOT EXISTS kb_docs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      summary TEXT NOT NULL DEFAULT '',
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      heading TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(doc_id);
  `);
}

export function getSqlite() {
  if (sqlite) return sqlite;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
  sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  migrate(sqlite);
  return sqlite;
}

export function nowIso() {
  return new Date().toISOString();
}

export const LOCAL_COMPANY_ID = "local";

export function all<T>(sql: string, params: SQLInputValue[] = []) {
  return getSqlite().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, params: SQLInputValue[] = []) {
  return getSqlite().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: SQLInputValue[] = []) {
  return getSqlite().prepare(sql).run(...params);
}

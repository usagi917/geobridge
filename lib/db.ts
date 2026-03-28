import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { analysisJobSchema, reportSchema, type AnalysisJob, type Report, type ReportInput } from "./report/schema";

const DB_PATH = path.join(process.cwd(), "terrascore.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        input_json TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        progress_json TEXT NOT NULL DEFAULT '[]',
        report_id TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }
  return db;
}

export function saveReport(report: Report): void {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO reports (id, input_json, report_json, created_at) VALUES (?, ?, ?, ?)"
  );
  stmt.run(
    report.id,
    JSON.stringify(report.input),
    JSON.stringify(report),
    report.generated_at
  );
}

export function getReport(id: string): Report | null {
  const db = getDb();
  const row = db.prepare("SELECT report_json FROM reports WHERE id = ?").get(id) as { report_json: string } | undefined;
  if (!row) return null;

  const parsed = reportSchema.safeParse(JSON.parse(row.report_json));
  if (!parsed.success) {
    console.error("Failed to parse saved report", { id, issues: parsed.error.issues });
    return null;
  }

  return parsed.data;
}

function mapAnalysisJobRow(row: {
  id: string;
  status: string;
  input_json: string;
  progress_json: string;
  report_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}): AnalysisJob | null {
  const parsed = analysisJobSchema.safeParse({
    id: row.id,
    status: row.status,
    input: JSON.parse(row.input_json),
    progress: JSON.parse(row.progress_json),
    report_id: row.report_id ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  if (!parsed.success) {
    console.error("Failed to parse analysis job", { id: row.id, issues: parsed.error.issues });
    return null;
  }

  return parsed.data;
}

export function createAnalysisJob(input: ReportInput): AnalysisJob {
  const db = getDb();
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id: randomUUID(),
    status: "queued",
    input,
    progress: ["分析ジョブを作成しました"],
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO analysis_jobs (
      id, status, input_json, progress_json, report_id, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.status,
    JSON.stringify(job.input),
    JSON.stringify(job.progress),
    null,
    null,
    job.created_at,
    job.updated_at
  );

  return job;
}

export function getAnalysisJob(id: string): AnalysisJob | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, status, input_json, progress_json, report_id, error_message, created_at, updated_at
    FROM analysis_jobs
    WHERE id = ?
  `).get(id) as {
    id: string;
    status: string;
    input_json: string;
    progress_json: string;
    report_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;
  return mapAnalysisJobRow(row);
}

export function appendAnalysisJobProgress(id: string, step: string): AnalysisJob | null {
  const db = getDb();
  const updatedAt = new Date().toISOString();

  // Atomic append using SQLite JSON1 — avoids read-modify-write race.
  // The WHERE clause deduplicates: skip if the last element already equals `step`.
  const result = db.prepare(`
    UPDATE analysis_jobs
    SET progress_json = json_insert(progress_json, '$[#]', ?),
        updated_at = ?
    WHERE id = ?
      AND json_extract(progress_json, '$[' || (json_array_length(progress_json) - 1) || ']') != ?
  `).run(step, updatedAt, id, step);

  // If no row was updated, it was either a duplicate step or unknown id.
  // Fall through to getAnalysisJob to return current state either way.
  if (result.changes === 0) {
    return getAnalysisJob(id);
  }

  return getAnalysisJob(id);
}

export function markAnalysisJobRunning(id: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'running', error_message = NULL, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);
}

export function markAnalysisJobQueued(id: string, step?: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'queued', updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);
  if (step) {
    appendAnalysisJobProgress(id, step);
  }
}

export function markAnalysisJobCompleted(id: string, reportId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'completed', report_id = ?, error_message = NULL, updated_at = ?
    WHERE id = ?
  `).run(reportId, new Date().toISOString(), id);
}

export function getPendingAnalysisJobIds(): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id FROM analysis_jobs WHERE status IN ('queued', 'running') ORDER BY created_at ASC"
  ).all() as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function markAnalysisJobFailed(id: string, errorMessage: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'failed', error_message = ?, updated_at = ?
    WHERE id = ?
  `).run(errorMessage, new Date().toISOString(), id);
}

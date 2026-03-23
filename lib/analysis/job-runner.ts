import {
  appendAnalysisJobProgress,
  getAnalysisJob,
  markAnalysisJobCompleted,
  markAnalysisJobFailed,
  markAnalysisJobQueued,
  markAnalysisJobRunning,
  saveReport,
} from "../db";
import { CONFIG } from "../config";
import { generateReport } from "../llm/report-generator";
import { orchestrate } from "../mcp/orchestrator";
import { normalizeAll } from "../normalizer";
import { buildReport } from "../report/builder";

interface QueueState {
  activeJobs: Set<string>;
  queuedJobs: Set<string>;
  pending: string[];
  processing: boolean;
}

declare global {
  var __terrascoreAnalysisQueue: QueueState | undefined;
}

function getQueueState(): QueueState {
  if (!globalThis.__terrascoreAnalysisQueue) {
    globalThis.__terrascoreAnalysisQueue = {
      activeJobs: new Set<string>(),
      queuedJobs: new Set<string>(),
      pending: [],
      processing: false,
    };
  }

  return globalThis.__terrascoreAnalysisQueue;
}

export function isAnalysisJobActive(jobId: string): boolean {
  return getQueueState().activeJobs.has(jobId);
}

export function enqueueAnalysisJob(jobId: string): void {
  const state = getQueueState();
  if (state.activeJobs.has(jobId) || state.queuedJobs.has(jobId)) {
    return;
  }

  state.pending.push(jobId);
  state.queuedJobs.add(jobId);
  void pumpAnalysisQueue();
}

export function ensureAnalysisJobScheduled(jobId: string): void {
  const job = getAnalysisJob(jobId);
  if (!job) return;

  if (job.status === "queued") {
    enqueueAnalysisJob(jobId);
    return;
  }

  if (job.status === "running" && !isAnalysisJobActive(jobId)) {
    markAnalysisJobQueued(jobId, "ジョブが中断されたため再開待ちに戻しました");
    enqueueAnalysisJob(jobId);
  }
}

async function pumpAnalysisQueue(): Promise<void> {
  const state = getQueueState();
  if (state.processing) return;

  state.processing = true;
  try {
    while (state.pending.length > 0) {
      const jobId = state.pending.shift();
      if (!jobId) continue;

      state.queuedJobs.delete(jobId);
      state.activeJobs.add(jobId);
      try {
        await executeAnalysisJob(jobId);
      } finally {
        state.activeJobs.delete(jobId);
      }
    }
  } finally {
    state.processing = false;
  }
}

async function executeAnalysisJob(jobId: string): Promise<void> {
  const job = getAnalysisJob(jobId);
  if (!job || job.status === "completed" || job.status === "failed") {
    return;
  }

  markAnalysisJobRunning(jobId);
  appendAnalysisJobProgress(jobId, "MCP データ取得を開始");

  const startTime = Date.now();

  try {
    const { result: orchestratorResult, citations } = await orchestrate({
      latitude: job.input.latitude,
      longitude: job.input.longitude,
      radiusM: job.input.radius_m,
      perspective: job.input.perspective,
      onProgress: (step) => {
        appendAnalysisJobProgress(jobId, step);
      },
    });
    appendAnalysisJobProgress(jobId, "全 MCP データ取得完了");

    appendAnalysisJobProgress(jobId, "データ正規化中...");
    const normalizedData = normalizeAll(orchestratorResult, job.input);

    appendAnalysisJobProgress(jobId, "AI レポート生成中...");
    const llmOutput = await generateReport(
      normalizedData,
      job.input.address,
      job.input.perspective
    );

    appendAnalysisJobProgress(jobId, "レポート組立中（都市グラフ・衛星画像を並列生成）...");
    const report = await buildReport(
      job.input,
      normalizedData,
      llmOutput,
      citations,
      Date.now() - startTime,
      CONFIG.ollama.model
    );

    saveReport(report);
    markAnalysisJobCompleted(jobId, report.id);
    appendAnalysisJobProgress(jobId, "レポート生成完了!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析中にエラーが発生しました";
    markAnalysisJobFailed(jobId, message);
    appendAnalysisJobProgress(jobId, `分析失敗: ${message}`);
  }
}

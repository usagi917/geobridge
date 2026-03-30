import {
  CONFIG,
  type OpenAIReasoningEffort,
  type OpenAIVerbosity,
} from "../config";
import { structuredReportOutputJsonSchema } from "../report/llm-output";

type OpenAIResponseContentPart =
  | {
      type: "output_text";
      text?: string;
    }
  | {
      type: "refusal";
      refusal?: string;
    }
  | {
      type: string;
      text?: string;
      refusal?: string;
    };

type OpenAIResponseOutputItem = {
  type: string;
  content?: OpenAIResponseContentPart[];
};

type OpenAIResponsesApiResponse = {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: unknown;
  output?: OpenAIResponseOutputItem[];
};

export function isOpenAIAvailable(): boolean {
  return typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 0;
}

export async function generateWithOpenAI(
  prompt: string,
  systemPrompt?: string,
  options?: {
    maxTokens?: number;
    reasoningEffort?: OpenAIReasoningEffort;
    verbosity?: OpenAIVerbosity;
  }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = CONFIG.openai.model;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.openai.timeout);

  try {
    const response = await fetch(buildResponsesApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildResponsesRequestBody(prompt, systemPrompt, model, options)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${body}`);
    }

    const data = (await response.json()) as OpenAIResponsesApiResponse;
    const content = extractResponseText(data);
    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${CONFIG.openai.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildResponsesApiUrl(): string {
  return `${CONFIG.openai.baseUrl.replace(/\/+$/, "")}/responses`;
}

function buildResponsesRequestBody(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
  options: {
    maxTokens?: number;
    reasoningEffort?: OpenAIReasoningEffort;
    verbosity?: OpenAIVerbosity;
  } | undefined
) {
  const textConfig: {
    format:
      | ({ type: "json_schema" } & typeof structuredReportOutputJsonSchema)
      | { type: "json_object" };
    verbosity?: OpenAIVerbosity;
  } = {
    format: supportsStructuredOutputs(model)
      ? {
          type: "json_schema",
          ...structuredReportOutputJsonSchema,
        }
      : { type: "json_object" },
  };

  if (supportsVerbosity(model)) {
    textConfig.verbosity = options?.verbosity ?? CONFIG.openai.verbosity;
  }

  return {
    model,
    store: false,
    instructions: systemPrompt?.trim() ? systemPrompt : undefined,
    input: prompt,
    max_output_tokens: options?.maxTokens ?? CONFIG.openai.maxTokens,
    ...(supportsReasoningEffort(model)
      ? {
          reasoning: {
            effort: options?.reasoningEffort ?? CONFIG.openai.reasoningEffort,
          },
        }
      : {}),
    text: textConfig,
  };
}

function supportsReasoningEffort(model: string): boolean {
  return isGptFiveModel(model) || /^o\d/.test(model);
}

function supportsVerbosity(model: string): boolean {
  return isGptFiveModel(model);
}

function supportsStructuredOutputs(model: string): boolean {
  return (
    isGptFiveModel(model) ||
    model.startsWith("gpt-4.1") ||
    model.startsWith("gpt-4o") ||
    /^o\d/.test(model)
  );
}

function isGptFiveModel(model: string): boolean {
  return /^gpt-5([.-]|$)/.test(model);
}

function extractResponseText(data: OpenAIResponsesApiResponse): string {
  if (data.error?.message) {
    throw new Error(`OpenAI response error: ${data.error.message}`);
  }

  if (data.incomplete_details) {
    throw new Error(`OpenAI response incomplete: ${stringifyUnknown(data.incomplete_details)}`);
  }

  if (data.status && data.status !== "completed") {
    throw new Error(`OpenAI response ended with status: ${data.status}`);
  }

  const refusals: string[] = [];
  const textParts: string[] = [];

  for (const outputItem of data.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "refusal" && contentItem.refusal) {
        refusals.push(contentItem.refusal.trim());
      }

      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        const trimmed = contentItem.text.trim();
        if (trimmed) {
          textParts.push(trimmed);
        }
      }
    }
  }

  if (refusals.length > 0) {
    throw new Error(`OpenAI refused the request: ${refusals.join(" / ")}`);
  }

  return textParts.join("\n").trim();
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

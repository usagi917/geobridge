import { CONFIG } from "../config";

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  think?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  thinking?: string;
  done: boolean;
}

export async function generateWithOllama(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const requestBody: OllamaGenerateRequest = {
    model: CONFIG.ollama.model,
    prompt,
    system: systemPrompt,
    stream: false,
    think: false,
    options: {
      temperature: options?.temperature ?? 0.3,
      num_predict: options?.maxTokens ?? CONFIG.ollama.maxTokens,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.ollama.timeout);

  try {
    const response = await fetch(`${CONFIG.ollama.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${CONFIG.ollama.timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

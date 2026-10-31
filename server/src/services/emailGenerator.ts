import "dotenv/config";

export interface EmailContext {
  adminName: string;
  role: string;
  schoolName: string | null;
  districtName: string;
  city: string | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

interface GroqResponse {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
}

export class GroqRateLimitError extends Error {
  readonly status = 429;

  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "GroqRateLimitError";
  }
}

function isGeneratedEmail(value: unknown): value is GeneratedEmail {
  if (!value || typeof value !== "object") return false;

  const email = value as Record<string, unknown>;

  return (
    typeof email.subject === "string" &&
    typeof email.body === "string" &&
    email.subject.trim().length > 0 &&
    email.body.trim().length > 0
  );
}

function getModels(): string[] {
  const configuredModels =
    process.env.GROQ_MODELS ??
    "openai/gpt-oss-20b,openai/gpt-oss-120b";

  const models = configuredModels
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  if (models.length === 0) {
    throw new Error("GROQ_MODELS does not contain any model IDs");
  }

  return [...new Set(models)];
}

function getRetryAfterMs(
  headerValue: string | null,
  responseBody: string,
): number {
  if (headerValue) {
    const seconds = Number(headerValue);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }

    const retryDate = Date.parse(headerValue);

    if (Number.isFinite(retryDate)) {
      return Math.max(1000, retryDate - Date.now());
    }
  }

  const match = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(responseBody);

  if (match) {
    const value = Number(match[1]);
    const multiplier = match[2].toLowerCase() === "ms" ? 1 : 1000;
    return Math.max(1000, Math.ceil(value * multiplier));
  }

  return 15_000;
}

async function callGroq(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a professional B2B email writer. Return valid JSON only. Do not include markdown fences.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_completion_tokens: 1024,
        reasoning_effort: "low",
        include_reasoning: false,
        response_format: {
          type: "json_object",
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);

    if (response.status === 429) {
      throw new GroqRateLimitError(
        `Groq rate limit reached for ${model}: ${body}`,
        getRetryAfterMs(response.headers.get("retry-after"), body),
      );
    }

    const error = new Error(
      `Groq API error ${response.status} (${model}): ${body}`,
    );

    Object.assign(error, { status: response.status });
    throw error;
  }

  const result = (await response.json()) as GroqResponse;
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`Groq returned an empty response (${model})`);
  }

  console.log(`Email generated using model: ${model}`);

  return content;
}

async function requestEmailJson(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const models = getModels();
  const rateLimitErrors: GroqRateLimitError[] = [];

  for (const model of models) {
    try {
      return await callGroq(model, apiKey, prompt);
    } catch (error) {
      if (error instanceof GroqRateLimitError) {
        rateLimitErrors.push(error);

        console.warn(
          `${model} is rate limited. Trying the next configured model.`,
        );
        continue;
      }

      // Do not hide invalid model, authentication, or server errors.
      throw error;
    }
  }

  // Wait for the longest reported reset so neither model is retried too early.
  const retryAfterMs = Math.max(
    ...rateLimitErrors.map((error) => error.retryAfterMs),
  );

  throw new GroqRateLimitError(
    "All configured Groq models are rate limited.",
    retryAfterMs,
  );
}

export async function generateEmail(
  lead: EmailContext,
): Promise<GeneratedEmail> {
  const prompt = `
Write a personalized B2B cold outreach email
on behalf of Dumroo.ai.

Recipient:
Name: ${lead.adminName}
Role: ${lead.role}
School: ${lead.schoolName || "Not available"}
District: ${lead.districtName}
City: ${lead.city || "Not available"}

Requirements:
1. Address the recipient by their name.
2. Mention their school or district naturally.
3. Keep the email between 80 and 120 words.
4. Maintain a professional and friendly tone.
5. Include a simple call to action.
6. Do not invent facts about the recipient.
7. Do not invent features or capabilities of Dumroo.ai.
8. Avoid generic marketing language.

Return valid JSON with exactly these fields:
{
  "subject": "Email subject",
  "body": "Email body"
}
`;

  const content = await requestEmailJson(prompt);

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON");
  }

  if (!isGeneratedEmail(parsed)) {
    throw new Error("Groq returned an invalid email structure");
  }

  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
  };
}


import "dotenv/config";

export interface EmailContext {
  leadId: string;
  adminName: string;
  role: string;
  schoolName: string | null;
  districtName: string;
  city: string | null;
  studentCount?: number | null;
}

export interface GeneratedEmail {
  leadId: string;
  subject: string;
  body: string;
}

interface GroqResponse {
  choices?: {
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class GroqApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: string | null,
  ) {
    super(message);
    this.name = "GroqApiError";
  }
}

const MIN_REQUEST_INTERVAL_MS = 60_000;

let lastGroqRequestAt = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGeneratedEmail(value: unknown): value is GeneratedEmail {
  if (!value || typeof value !== "object") {
    return false;
  }

  const email = value as Record<string, unknown>;

  return (
    typeof email.leadId === "string" &&
    typeof email.subject === "string" &&
    typeof email.body === "string" &&
    email.leadId.trim().length > 0 &&
    email.subject.trim().length > 0 &&
    email.body.trim().length > 0
  );
}

export async function generateEmails(
  leads: EmailContext[],
): Promise<GeneratedEmail[]> {
  if (leads.length === 0 || leads.length > 5) {
    throw new Error("A batch must contain between 1 and 5 leads");
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

  const leadIds = leads.map((lead) => lead.leadId);

  if (new Set(leadIds).size !== leadIds.length) {
    throw new Error("Duplicate lead IDs supplied to email generator");
  }

  const leadContext = leads.map((lead) => ({
    leadId: lead.leadId,
    name: lead.adminName,
    role: lead.role,
    school: lead.schoolName,
    district: lead.districtName,
    city: lead.city,
    studentCount: lead.studentCount ?? null,
  }));

  const prompt = `
Generate exactly one personalized cold outreach email for each lead.

Lead data:
${JSON.stringify(leadContext)}

Rules:
- Return exactly ${leads.length} emails.
- Preserve every leadId exactly as supplied.
- Write a concise body of approximately 45-55 words per email.
- Address the recipient by name.
- Mention the school or district naturally.
- Mention student count only when supplied.
- Introduce Dumroo.ai without inventing product features.
- Include one simple call to action.
- Use a professional and natural tone.
- Do not invent facts.

Return only valid JSON using this structure:
{
  "emails": [
    {
      "leadId": "original lead ID",
      "subject": "Email subject",
      "body": "Email body"
    }
  ]
}
`;

  // Space requests to avoid exhausting the Free-tier OTPM quota.
  const elapsed = Date.now() - lastGroqRequestAt;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);

  if (waitMs > 0) {
    console.log(
      `Waiting ${Math.ceil(waitMs / 1000)} seconds before Groq request`,
    );
    await wait(waitMs);
  }

  lastGroqRequestAt = Date.now();

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
              "You are a professional B2B email writer. Return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 600,
        reasoning_effort: "none",
        response_format: {
          type: "json_object",
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();

    throw new GroqApiError(
      `Groq API error ${response.status}: ${errorBody}`,
      response.status,
      response.headers.get("retry-after"),
    );
  }

  const result = (await response.json()) as GroqResponse;
  const choice = result.choices?.[0];
  const content = choice?.message?.content;

  console.log("Groq response metadata:", {
    finishReason: choice?.finish_reason,
    usage: result.usage,
  });

  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  if (choice?.finish_reason === "length") {
    throw new Error(
      "Groq response was truncated because the output token limit was reached",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("Groq returned invalid JSON:", content.slice(0, 1000));
    throw new Error("Groq returned invalid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { emails?: unknown }).emails)
  ) {
    console.error("Unexpected Groq response structure:", content.slice(0, 1000));
    throw new Error("Groq returned an invalid batch structure");
  }

  const emails = (parsed as { emails: unknown[] }).emails;

  if (emails.length !== leads.length) {
    throw new Error(
      `Expected ${leads.length} emails, but Groq returned ${emails.length}`,
    );
  }

  const invalidIndexes = emails
    .map((email, index) => ({
      index,
      valid: isGeneratedEmail(email),
    }))
    .filter((item) => !item.valid)
    .map((item) => item.index);

  if (invalidIndexes.length > 0) {
    console.error("Invalid email entries at indexes:", invalidIndexes);
    throw new Error("Groq returned invalid email fields");
  }

  const validEmails = emails as GeneratedEmail[];

  const expectedIds = new Set(leadIds);
  const returnedIds = new Set(validEmails.map((email) => email.leadId));

  if (
    returnedIds.size !== expectedIds.size ||
    [...expectedIds].some((id) => !returnedIds.has(id))
  ) {
    console.error("Expected lead IDs:", [...expectedIds]);
    console.error("Returned lead IDs:", [...returnedIds]);

    throw new Error(
      "Groq returned missing, duplicate, or unexpected lead IDs",
    );
  }

  return validEmails.map((email) => ({
    leadId: email.leadId,
    subject: email.subject.trim(),
    body: email.body.trim(),
  }));
}

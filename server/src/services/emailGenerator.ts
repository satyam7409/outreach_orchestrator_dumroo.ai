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

function isGeneratedEmail(value: unknown): value is GeneratedEmail {
  if (!value || typeof value !== "object") {
    return false;
  }

  const email = value as Record<string, unknown>;

  return (
    typeof email.subject === "string" &&
    typeof email.body === "string" &&
    email.subject.trim().length > 0 &&
    email.body.trim().length > 0
  );
}

export async function generateEmail(
  lead: EmailContext,
): Promise<GeneratedEmail> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const organizationName = lead.schoolName || lead.districtName;

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
        temperature: 0.7,
        response_format: {
          type: "json_object",
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );


 if (!response.ok) {
  const error = new Error(
    `Groq API error: ${response.status} ${response.statusText}`
  );

  Object.assign(error, {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
  });

  throw error;
}

  const result = (await response.json()) as GroqResponse;

  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON");
  }

  if (!isGeneratedEmail(parsed)) {
    throw new Error("Groq returned an invalid email structure");
  }

  console.log(`Email generated for ${organizationName}`);

  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
  };
}

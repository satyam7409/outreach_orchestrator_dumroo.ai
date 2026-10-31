import { UnrecoverableError, type Job } from "bullmq";

import {
  claimLead,
  getLeadWithContext,
  markLeadSent,
  markLeadFailed,
  releaseLeadForRetry,
  completeCampaignIfFinished,
} from "../services/lead.repository.js";

import { generateEmail } from "../services/emailGenerator.js";
import { simulateEmailSend } from "../services/emailSimulator.js";

export interface EmailJobData {
  leadId: string;
  campaignId: string;
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function isPermanentError(error: unknown): boolean {
  const status = getHttpStatus(error);

  // Retry rate limits, request timeouts, conflicts, and server errors.
  // Authentication, authorization, invalid model, and invalid request
  // errors will not become successful by retrying the same request.
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 409 &&
    status !== 429
  );
}

export async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { leadId, campaignId } = job.data;

  console.log(`\nProcessing lead: ${leadId}`);

  const claimed = await claimLead(leadId, campaignId);

  if (claimed.count === 0) {
    console.log(`Lead ${leadId} is already claimed or processed. Skipping.`);
    await completeCampaignIfFinished(campaignId);
    return;
  }

  try {
    const lead = await getLeadWithContext(leadId);

    if (!lead) {
      const error = new Error(`Lead ${leadId} not found`);
      Object.assign(error, { status: 404 });
      throw error;
    }

    const email = await generateEmail({
      adminName: lead.adminName,
      role: lead.role,
      schoolName: lead.school?.name ?? null,
      districtName: lead.district.name,
      city: lead.school?.city ?? lead.district.city,
    });

    console.log(`Generated email for ${lead.adminEmail}`);

    await simulateEmailSend({
      to: lead.adminEmail,
      subject: email.subject,
      body: email.body,
    });

    await markLeadSent(leadId, email.subject, email.body);

    console.log(`Lead ${leadId} marked as SENT`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";

    console.error(`Error processing lead ${leadId}:`, message);

    const maxAttempts = job.opts.attempts ?? 1;
    const currentAttempt = job.attemptsMade + 1;
    const permanent = isPermanentError(error);
    const attemptsExhausted = currentAttempt >= maxAttempts;

    try {
      if (permanent || attemptsExhausted) {
        await markLeadFailed(leadId, message);
        await completeCampaignIfFinished(campaignId);

        console.error(
          `Lead ${leadId} marked as FAILED (${permanent ? "permanent error" : "attempts exhausted"})`,
        );
      } else {
        await releaseLeadForRetry(leadId);

        const retryAfterMs =
          error &&
          typeof error === "object" &&
          "retryAfterMs" in error &&
          typeof error.retryAfterMs === "number"
            ? error.retryAfterMs
            : undefined;

        console.warn(
          `Lead ${leadId} released for retry (${currentAttempt}/${maxAttempts})`,
          retryAfterMs ? `Groq requested a wait of ${retryAfterMs}ms` : "",
        );
      }
    } catch (stateError) {
      console.error(`Could not update lead state for ${leadId}:`, stateError);
    }

    if (permanent) {
      throw new UnrecoverableError(message);
    }

    throw error;
  }

  await completeCampaignIfFinished(campaignId);
}

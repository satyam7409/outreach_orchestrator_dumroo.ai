
import { UnrecoverableError, type Job } from "bullmq";

import {
  claimLead,
  getLeadsWithContext,
  markLeadSent,
  markLeadsFailed,
  releaseLeadsForRetry,
  completeCampaignIfFinished,
} from "../services/lead.repository.js";

import {
  generateEmails,
  GroqApiError,
} from "../services/emailGenerator.js";

import { simulateEmailSend } from "../services/emailSimulator.js";

export interface EmailJobData {
  leadIds: string[];
  campaignId: string;
}

function isPermanentError(error: unknown): boolean {
  if (!(error instanceof GroqApiError)) {
    return false;
  }

  return (
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 409, 429].includes(error.status)
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown processing error";
}

export async function processEmail(
  job: Job<EmailJobData>,
): Promise<void> {
  const { leadIds, campaignId } = job.data;

  console.log(`Processing batch of ${leadIds.length} leads`);

  // Track only leads successfully claimed by this job.
  const claimedIds: string[] = [];

  // Track leads that have not yet been marked SENT.
  const pendingIds = new Set<string>();

  try {
    // 1. Claim leads independently so one failed claim
    //    does not hide other successful claims.
    const claimResults = await Promise.allSettled(
      leadIds.map(async (leadId) => ({
        leadId,
        result: await claimLead(leadId, campaignId),
      })),
    );

    const claimErrors = claimResults.filter(
      (result) => result.status === "rejected",
    );

    for (const result of claimResults) {
      if (result.status !== "fulfilled") {
        continue;
      }

      if (result.value.result.count > 0) {
        claimedIds.push(result.value.leadId);
        pendingIds.add(result.value.leadId);
      }
    }

    if (claimErrors.length > 0) {
      throw new Error(
        `${claimErrors.length} lead(s) could not be claimed`,
      );
    }

    if (claimedIds.length === 0) {
      console.log("No claimable leads in this batch.");

      await completeCampaignIfFinished(campaignId);
      return;
    }

    console.log(`Successfully claimed ${claimedIds.length} leads`);

    // 2. Load lead information.
    const leads = await getLeadsWithContext(claimedIds);

    if (leads.length !== claimedIds.length) {
      throw new Error("Some claimed leads could not be loaded");
    }

    // 3. Generate all emails in one Groq request.
    const generatedEmails = await generateEmails(
      leads.map((lead) => ({
        leadId: lead.id,
        adminName: lead.adminName,
        role: lead.role,
        schoolName: lead.school?.name ?? null,
        districtName: lead.district.name,
        city: lead.school?.city ?? lead.district.city,
        studentCount:
          lead.school?.enrollment ?? lead.district.enrollment,
      })),
    );

    const emailByLeadId = new Map(
      generatedEmails.map((email) => [email.leadId, email]),
    );

    // 4. Process each email independently.
    //    Remove a lead from pendingIds only after its SENT
    //    status has been successfully persisted.
    for (const lead of leads) {
      const email = emailByLeadId.get(lead.id);

      if (!email) {
        throw new Error(`Missing generated email for lead ${lead.id}`);
      }

      await simulateEmailSend({
        to: lead.adminEmail,
        subject: email.subject,
        body: email.body,
      });

      await markLeadSent(
        lead.id,
        email.subject,
        email.body,
      );

      pendingIds.delete(lead.id);

      console.log(`Lead ${lead.id} marked as SENT`);
    }

    console.log(`Batch completed successfully: ${leadIds.length} leads`);
  } catch (error) {
    const message = getErrorMessage(error);

    const maxAttempts = job.opts.attempts ?? 5;
    const currentAttempt = job.attemptsMade + 1;

    const permanent = isPermanentError(error);
    const exhausted = currentAttempt >= maxAttempts;

    console.error(`Batch processing failed: ${message}`);

    const unfinishedIds = [...pendingIds];

    if (unfinishedIds.length > 0) {
      if (permanent || exhausted) {
        // Only mark unfinished leads as failed.
        await markLeadsFailed(unfinishedIds, message);

        console.log(
          `Marked ${unfinishedIds.length} unfinished leads as FAILED`,
        );
      } else {
        // Only release unfinished leads for another attempt.
        await releaseLeadsForRetry(unfinishedIds);

        console.log(
          `Released ${unfinishedIds.length} unfinished leads for retry (${currentAttempt}/${maxAttempts})`,
        );
      }
    }

    if (permanent || exhausted) {
      await completeCampaignIfFinished(campaignId);

      if (permanent) {
        throw new UnrecoverableError(message);
      }
    }

    throw error;
  }

  // 5. Check campaign completion after successful processing.
  await completeCampaignIfFinished(campaignId);
}

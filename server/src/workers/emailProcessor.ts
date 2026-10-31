import type { Job } from "bullmq";

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

export async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { leadId, campaignId } = job.data;

  console.log(`\nProcessing lead: ${leadId}`);

  // 1. Atomically claim the lead.
  const claimed = await claimLead(leadId, campaignId);

  if (claimed.count === 0) {
    console.log(`Lead ${leadId} is already claimed or processed. Skipping.`);

    await completeCampaignIfFinished(campaignId);
    return;
  }

  try {
    // 2. Fetch lead and organization information.
    const lead = await getLeadWithContext(leadId);

    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // 3. Generate personalized email using Groq.
    const email = await generateEmail({
      adminName: lead.adminName,
      role: lead.role,
      schoolName: lead.school?.name ?? null,
      districtName: lead.district.name,
      city: lead.school?.city ?? lead.district.city,
    });

    console.log(`Generated email for ${lead.adminEmail}`);

    // 4. Simulate sending.
    await simulateEmailSend({
      to: lead.adminEmail,
      subject: email.subject,
      body: email.body,
    });

    // 5. Save generated email and update status.
    await markLeadSent(leadId, email.subject, email.body);

    console.log(`Lead ${leadId} marked as SENT`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";

    console.error(`Error processing lead ${leadId}:`, message);

    // BullMQ attemptsMade is the number of previous
    // failed attempts before the current execution.
    const maxAttempts = job.opts.attempts ?? 1;
    const currentAttempt = job.attemptsMade + 1;

    try {
      if (currentAttempt < maxAttempts) {
        // Allow BullMQ to retry this job.
        await releaseLeadForRetry(leadId);

        console.log(
          `Lead ${leadId} released for retry (${currentAttempt}/${maxAttempts})`,
        );
      } else {
        // No more retries available.
        await markLeadFailed(leadId, message);

        console.log(`Lead ${leadId} marked as FAILED`);

        await completeCampaignIfFinished(campaignId);
      }
    } catch (stateError) {
      console.error(`Could not update lead state for ${leadId}:`, stateError);
    }

    // BullMQ needs this error to know the job failed.
    throw error;
  }

  // 6. Check if all leads in the campaign are finished.
  await completeCampaignIfFinished(campaignId);
}

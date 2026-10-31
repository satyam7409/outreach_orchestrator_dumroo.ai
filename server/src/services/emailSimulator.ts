
export interface EmailSimulationInput {
  to: string;
  subject: string;
  body: string;
}

export async function simulateEmailSend(
  email: EmailSimulationInput
): Promise<void> {
  console.log("\n========== EMAIL SIMULATION ==========");

  console.log(`To: ${email.to}`);
  console.log(`Subject: ${email.subject}`);
  console.log(`Body:\n${email.body}`);

  // Simulate the time taken by an email provider.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 2000);
  });

  console.log("--------------------------------------");
  console.log(`SIMULATED SUCCESS: ${email.to}`);
  console.log("======================================\n");
}

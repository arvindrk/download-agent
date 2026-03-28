import { Resend } from "resend";
import type { VerificationFailure } from "./verification.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function truncate(input: string, maxLength = 2000): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...truncated`;
}

export async function sendFailureEmail(params: {
  failure: VerificationFailure;
  runId: string;
  attemptNumber: number;
  maxAttempts: number;
  scheduledAt: string;
}): Promise<void> {
  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  const from = requiredEnv("ALERT_EMAIL_FROM");
  const to = requiredEnv("ALERT_EMAIL_TO")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const subject = `download-agent failure: ${params.failure.stage}`;
  const text = [
    "Download agent verification failed.",
    "",
    `Run ID: ${params.runId}`,
    `Attempt: ${params.attemptNumber}/${params.maxAttempts}`,
    `Scheduled At: ${params.scheduledAt}`,
    `Sandbox ID: ${params.failure.sandboxId}`,
    `Stage: ${params.failure.stage}`,
    `Command: ${params.failure.command}`,
    `Exit code: ${params.failure.exitCode}`,
    "",
    "stderr (tail):",
    truncate(params.failure.stderr || "(empty)"),
    "",
    "stdout (tail):",
    truncate(params.failure.stdout || "(empty)"),
  ].join("\n");

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}

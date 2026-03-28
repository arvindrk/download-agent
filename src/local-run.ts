import { sendFailureEmail } from "./lib/email.js";
import {
  VerificationFailure,
  runVerificationInSandbox,
} from "./lib/verification.js";

async function main(): Promise<void> {
  const result = await runVerificationInSandbox();
  const runId = `local-${Date.now()}`;

  await sendFailureEmail({
    failure: new VerificationFailure({
      message: "Local resend verification test",
      stage: "smoke_check",
      command: "local-run:sendFailureEmail-test",
      exitCode: 1,
      stderr: "Synthetic failure for local Resend verification.",
      stdout: "Local run succeeded. Triggering email intentionally for API check.",
      sandboxId: result.sandboxId,
      packageVersion: result.packageVersion,
    }),
    runId,
    attemptNumber: 1,
    maxAttempts: 1,
    scheduledAt: new Date().toISOString(),
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        failureEmailSent: true,
        runId,
        sandboxId: result.sandboxId,
        packageVersion: result.packageVersion,
        stages: result.stages.map((stage) => ({
          stage: stage.stage,
          exitCode: stage.exitCode,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

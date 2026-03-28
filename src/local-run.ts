import { sendFailureEmail } from "./lib/email.js";
import {
  VerificationFailure,
  runVerificationInSandbox,
} from "./lib/verification.js";

async function main(): Promise<void> {
  const verbose =
    process.env.VERBOSE_LOCAL_RUN === "1" ||
    process.env.VERBOSE_LOCAL_RUN === "true";
  const result = await runVerificationInSandbox();
  const runId = `local-${Date.now()}`;

  if (verbose) {
    console.log("verbose local run enabled");
    for (const stage of result.stages) {
      console.log(`\n[${stage.stage}] exitCode=${stage.exitCode}`);
      console.log(`command: ${stage.command}`);
      console.log("stdout:");
      console.log(stage.stdout || "(empty)");
      console.log("stderr:");
      console.log(stage.stderr || "(empty)");
    }
  }

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

import { logger, schedules } from "@trigger.dev/sdk";
import { sendFailureEmail } from "../lib/email.js";
import {
  VerificationFailure,
  runVerificationInSandbox,
} from "../lib/verification.js";

const createDownloadAgentScheduledTask = (
  taskId: string,
  cronPattern: string,
) =>
  schedules.task({
    id: taskId,
    cron: {
      pattern: cronPattern,
      timezone: "America/Los_Angeles",
      environments: ["PRODUCTION"],
    },
    run: async (payload, { ctx }) => {
      try {
        const result = await runVerificationInSandbox();
        logger.log("download-agent verification succeeded", {
          runId: ctx.run.id,
          sandboxId: result.sandboxId,
          packageVersion: result.packageVersion,
          stages: result.stages.map((stage) => ({
            stage: stage.stage,
            exitCode: stage.exitCode,
          })),
        });

        return {
          ok: true,
          runId: ctx.run.id,
          sandboxId: result.sandboxId,
          packageVersion: result.packageVersion,
          stages: result.stages,
        };
      } catch (error) {
        const verificationFailure =
          error instanceof VerificationFailure
            ? error
            : new VerificationFailure({
                message: "Unexpected failure while running verification",
                stage: "smoke_check",
                command: "internal",
                exitCode: 1,
                stderr:
                  error instanceof Error
                    ? (error.stack ?? error.message)
                    : String(error),
                stdout: "",
                sandboxId: "unknown",
              });

        const attemptNumber = ctx.attempt.number ?? 1;
        const maxAttempts = ctx.run.maxAttempts ?? 1;
        const isFinalAttempt = attemptNumber >= maxAttempts;

        logger.error("download-agent verification failed", {
          runId: ctx.run.id,
          attemptNumber,
          maxAttempts,
          isFinalAttempt,
          stage: verificationFailure.stage,
        });

        if (isFinalAttempt) {
          await sendFailureEmail({
            failure: verificationFailure,
            runId: ctx.run.id,
            attemptNumber,
            maxAttempts,
            scheduledAt: payload.timestamp.toISOString(),
          });
        }

        throw verificationFailure;
      }
    },
  });

export const downloadAgentScheduledTask = createDownloadAgentScheduledTask(
  "download-agent-scheduled-check-1",
  "* * * * *",
);

export const downloadAgentScheduledTask2 = createDownloadAgentScheduledTask(
  "download-agent-scheduled-check-2",
  "5 * * * *",
);

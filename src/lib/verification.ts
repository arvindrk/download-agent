import { Sandbox } from "e2b";

export type VerificationStage =
  | "npm_metadata_check"
  | "npm_pack_check"
  | "npm_install_check"
  | "skill_install_check"
  | "smoke_check";

export type StageResult = {
  stage: VerificationStage;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type VerificationSuccess = {
  ok: true;
  packageVersion: string;
  stages: StageResult[];
  sandboxId: string;
};

export class VerificationFailure extends Error {
  readonly stage: VerificationStage;
  readonly command: string;
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
  readonly sandboxId: string;
  readonly packageVersion?: string;

  constructor(params: {
    message: string;
    stage: VerificationStage;
    command: string;
    exitCode: number;
    stderr: string;
    stdout: string;
    sandboxId: string;
    packageVersion?: string;
  }) {
    super(params.message);
    this.name = "VerificationFailure";
    this.stage = params.stage;
    this.command = params.command;
    this.exitCode = params.exitCode;
    this.stderr = params.stderr;
    this.stdout = params.stdout;
    this.sandboxId = params.sandboxId;
    this.packageVersion = params.packageVersion;
  }
}

type RawCommandResult = {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
};

function asCommandResult(value: unknown): RawCommandResult {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as RawCommandResult;
}

export async function runVerificationInSandbox(): Promise<VerificationSuccess> {
  const sandbox = await Sandbox.create();
  const sandboxId = sandbox.sandboxId;
  await sandbox.setTimeout(20 * 60 * 1000);

  const stageResults: StageResult[] = [];
  let packageVersion = "";

  try {
    await runStage({
      sandbox,
      stage: "npm_metadata_check",
      command:
        "npm view extract-design-system version --loglevel=error --json > version.json && node -e \"const fs=require('fs');const raw=fs.readFileSync('version.json','utf8');const parsed=JSON.parse(raw);const version=Array.isArray(parsed)?parsed[0]:parsed;process.stdout.write(String(version));\"",
      stageResults,
      sandboxId,
    });

    packageVersion = stageResults[0]?.stdout.trim() ?? "";

    await runStage({
      sandbox,
      stage: "npm_pack_check",
      command:
        "npm pack extract-design-system --silent --loglevel=error > pack-output.txt && node -e \"const fs=require('fs');const s=fs.readFileSync('pack-output.txt','utf8').trim();process.stdout.write(s);\"",
      stageResults,
      sandboxId,
    });

    await runStage({
      sandbox,
      stage: "npm_install_check",
      command:
        "mkdir -p /tmp/pkg-install-check && cd /tmp/pkg-install-check && npm init -y >/dev/null 2>&1 && npm install extract-design-system --loglevel=error && node -e \"require.resolve('extract-design-system/package.json');process.stdout.write('install-ok');\"",
      stageResults,
      sandboxId,
    });

    await runStage({
      sandbox,
      stage: "skill_install_check",
      command:
        "npx --yes skills add https://github.com/arvindrk/extract-design-system --skill extract-design-system --agent '*' --yes && npx --yes skills ls --json | node -e \"const fs=require('fs');const raw=fs.readFileSync(0,'utf8');let data;try{data=JSON.parse(raw);}catch{console.error('invalid skills ls json');process.exit(1);}const ok=JSON.stringify(data).includes('extract-design-system');if(!ok){console.error('extract-design-system missing after install');process.exit(1);}process.stdout.write('skill-install-verified');\"",
      stageResults,
      sandboxId,
    });

    await runStage({
      sandbox,
      stage: "smoke_check",
      command: "npx --yes skills --help",
      stageResults,
      sandboxId,
    });

    return {
      ok: true,
      packageVersion,
      stages: stageResults,
      sandboxId,
    };
  } finally {
    await sandbox.kill().catch(() => undefined);
  }
}

async function runStage(params: {
  sandbox: Sandbox;
  stage: VerificationStage;
  command: string;
  stageResults: StageResult[];
  sandboxId: string;
}): Promise<void> {
  const result = asCommandResult(
    await params.sandbox.commands.run(params.command, {
      timeoutMs: 8 * 60 * 1000,
      cwd: "/home/user",
    }),
  );

  const stageResult: StageResult = {
    stage: params.stage,
    command: params.command,
    exitCode: typeof result.exitCode === "number" ? result.exitCode : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  params.stageResults.push(stageResult);

  if (stageResult.exitCode !== 0) {
    throw new VerificationFailure({
      message: `Stage failed: ${params.stage}`,
      stage: params.stage,
      command: params.command,
      exitCode: stageResult.exitCode,
      stderr: stageResult.stderr,
      stdout: stageResult.stdout,
      sandboxId: params.sandboxId,
    });
  }
}

import { createActivationCodeRecord } from "../src/server/activation/activationCodes";
import { createId } from "../src/shared/lib/ids";

function readUsageLimit() {
  const raw = process.argv.find((item) => item.startsWith("--usage-limit="))?.split("=")[1];
  const parsed = Number(raw ?? 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

async function main() {
  const code = createId("echo_code").replace(/_/g, "-");
  const usageLimit = readUsageLimit();
  const record = await createActivationCodeRecord({ code, usageLimit });

  console.log(JSON.stringify({ ...record, code, usageLimit }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

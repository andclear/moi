import { createActivationCodeBatch } from "../src/server/activation/activationCodes";

function readPositiveInteger(name: string, fallback: number, max: number) {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=")[1];
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function readLimitedInteger(name: string, fallback: number, max: number) {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=")[1];
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function createPlainActivationCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `LPB-${suffix}`;
}

async function main() {
  const quantity = readPositiveInteger("quantity", 1, 200);
  const usageLimit = readLimitedInteger("usage-limit", 100, 100000);
  const durationHours = readLimitedInteger("duration-hours", 72, 24 * 365);
  const customCodes = process.argv
    .filter((item) => item.startsWith("--code="))
    .map((item) => item.slice("--code=".length).trim())
    .filter((item, index, list) => item && list.indexOf(item) === index);
  const codes =
    customCodes.length > 0
      ? customCodes
      : Array.from({ length: quantity }, createPlainActivationCode);
  const records = await createActivationCodeBatch({ codes, usageLimit, durationHours });

  console.log(
    JSON.stringify(
      {
        codes: records.map((record, index) => ({ ...record, code: codes[index] })),
        quantity,
        usageLimit,
        durationHours,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 42000 + (process.pid % 15000);
const base = "http://127.0.0.1:" + port;
const child = spawn(process.execPath, ["server/index.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    DEFAULT_PARTNER_SLUG: "",
    ALLOWED_ORIGINS: base
  },
  stdio: ["ignore", "ignore", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

async function waitUntilReady() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("API server exited early: " + stderr);
    }
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not become ready in time: " + stderr);
}

try {
  await waitUntilReady();

  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200, "health endpoint returns HTTP 200");
  assert.deepEqual(await health.json(), { ok: true, service: "streaming-leads-api" });

  const invalidLead = await fetch(base + "/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ name: "", phone: "x", privacyAcknowledged: false })
  });
  assert.equal(invalidLead.status, 400, "invalid lead is rejected before any database access");

  const spamLead = await fetch(base + "/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ website: "bot-filled-this-field" })
  });
  assert.equal(spamLead.status, 422, "honeypot blocks bot-like submissions");

  const missingCampaignDb = await fetch(base + "/api/config?partner=sample-partner");
  assert.equal(missingCampaignDb.status, 503, "campaign config fails safely without database credentials");
  assert.deepEqual(await missingCampaignDb.json(), {
    active: false,
    error: "Campanha ainda não configurada."
  });

  console.log("Smoke tests passed: health, input validation, honeypot, missing-database fallback.");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(resolve, 1500).unref();
  });
}
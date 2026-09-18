import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("foundation migration includes append-only audit and transactional outbox primitives", async () => {
  const sql = await readFile("packages/db/migrations/0001_foundation.sql", "utf8");
  for (const required of ["CREATE TABLE IF NOT EXISTS audit_event", "CREATE TABLE IF NOT EXISTS outbox_event", "service_environment"]) {
    assert.equal(sql.includes(required), true, `missing ${required}`);
  }
});

test("the public repository does not contain the full master specification", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.equal(readme.includes("44-page"), false);
  assert.equal(readme.includes("Master Product + Engineering Specification v1.0.md"), false);
});

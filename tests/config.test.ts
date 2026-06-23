import test from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "../src/config";

test("R2L_VALIDATE controls the validate stage", () => {
  const prev = process.env.R2L_VALIDATE;
  try {
    delete process.env.R2L_VALIDATE;
    assert.equal(resolveConfig({}).validate, true, "unset → validate on (default)");

    process.env.R2L_VALIDATE = "0";
    assert.equal(resolveConfig({}).validate, false, "0 → validation off");

    process.env.R2L_VALIDATE = "1";
    assert.equal(resolveConfig({}).validate, true, "1 → validation on");
  } finally {
    if (prev === undefined) delete process.env.R2L_VALIDATE;
    else process.env.R2L_VALIDATE = prev;
  }
});

test("explicit flag overrides R2L_VALIDATE", () => {
  const prev = process.env.R2L_VALIDATE;
  try {
    process.env.R2L_VALIDATE = "0";
    assert.equal(resolveConfig({ validate: true }).validate, true, "flag wins over env (force on)");
    process.env.R2L_VALIDATE = "1";
    assert.equal(resolveConfig({ validate: false }).validate, false, "flag wins over env (force off)");
  } finally {
    if (prev === undefined) delete process.env.R2L_VALIDATE;
    else process.env.R2L_VALIDATE = prev;
  }
});

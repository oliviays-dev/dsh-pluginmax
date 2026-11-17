#!/usr/bin/env node
import { fileURLToPath } from "node:url";

// Keep one protocol implementation in the detachable plugin. The docs asset only
// pins the Demo fixture default so it can also be started directly for checks.
process.env.ORDERS_DEMO_FIXTURE_PATH ??= fileURLToPath(
  new URL("./orders-fixture.json", import.meta.url),
);

await import("../../../plugins/dsh-collab-demo-phone-tablet-order/mock/mock-oms-mcp-server.mjs");

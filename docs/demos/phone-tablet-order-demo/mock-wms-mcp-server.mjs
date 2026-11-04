#!/usr/bin/env node
import { fileURLToPath } from "node:url";

// Keep one protocol implementation in the detachable plugin. Demo state remains
// isolated through DEMO_WMS_STATE_PATH when this wrapper is started directly.
process.env.DEMO_WMS_STATE_PATH ??= fileURLToPath(
  new URL(
    "../../../.tmp/phone-tablet-demo/isolated/wms-state.json",
    import.meta.url,
  ),
);

await import("../../../plugins/dsh-collab-demo-phone-tablet-order/mock/mock-wms-mcp-server.mjs");

#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const CHINA_OFFSET_MS = 8 * HOUR_MS;
const DEFAULT_OUTPUT = fileURLToPath(
  new URL("./orders-fixture.json", import.meta.url),
);

function parseArgs(argv) {
  const result = { out: DEFAULT_OUTPUT, now: new Date() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--out" && value !== undefined) {
      result.out = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--now" && value !== undefined) {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error(`invalid --now value: ${value}`);
      }
      result.now = parsed;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return result;
}

function shanghaiParts(date) {
  const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function shanghaiTimestamp(parts, hour, minute = 0) {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, minute, 0, 0),
  );
}

function dayTimestamp(baseParts, dayOffset, hour, minute) {
  const shifted = new Date(
    Date.UTC(
      baseParts.year,
      baseParts.month - 1,
      baseParts.day + dayOffset,
      0,
      0,
      0,
      0,
    ),
  );
  const parts = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
  return shanghaiTimestamp(parts, hour, minute);
}

function iso(date) {
  return new Date(date).toISOString();
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function amountFor(index, anomalyKind) {
  const phone = [3999, 4299, 4699, 4999, 5299, 5999, 6499, 6999];
  const tablet = [2299, 2699, 3299, 3699, 4299, 4799, 5299, 6299];
  const pool = index % 3 === 0 ? tablet : phone;
  const base = pool[index % pool.length];
  const bundle = anomalyKind === "none" ? (index % 4) * 99 : (index % 3) * 199;
  return round(base + bundle, 2);
}

function buildRow(input) {
  const {
    sequence,
    orderedAt,
    promisedAt,
    actualAt,
    status,
    paymentStatus,
    region,
    category,
    channel,
    merchant,
    paymentMethod,
    amount,
    refundStatus = "none",
  } = input;
  return {
    order_id: `PT-DEMO-${String(sequence).padStart(7, "0")}`,
    ordered_at: iso(orderedAt),
    paid_at:
      paymentStatus === "succeeded" ? iso(orderedAt.getTime() + 6 * 60_000) : null,
    order_status: status,
    payment_status: paymentStatus,
    region,
    category,
    payment_method: paymentMethod,
    channel,
    merchant,
    promised_fulfillment_at: iso(promisedAt),
    actual_fulfillment_at: actualAt === null ? null : iso(actualAt),
    refund_status: refundStatus,
    amount,
    demo: true,
  };
}

function classifyToday(index) {
  if (index < 52) return "payment_failed";
  if (index < 83) return "cancelled";
  if (index < 126) return "timeout";
  return "none";
}

function addTodayMainCohort(orders, now, baseParts) {
  const count = 1_658;
  const start = shanghaiTimestamp(baseParts, 8, 0);
  const latest = new Date(Math.max(start.getTime(), now.getTime() - 20 * 60_000));
  const span = Math.max(60_000, latest.getTime() - start.getTime());
  for (let index = 0; index < count; index += 1) {
    const anomalyKind = classifyToday(index);
    const orderedAt = new Date(start.getTime() + ((index + 1) / count) * span);
    const sequence = orders.length + 1;
    const channel = ["app", "app", "app", "web", "store"][index % 5];
    const merchant = ["flagship", "flagship", "marketplace", "direct"][
      index % 4
    ];
    const paymentMethod = ["wallet", "card", "card", "transfer"][index % 4];
    let promisedAt = new Date(orderedAt.getTime() + (4 + (index % 4)) * HOUR_MS);
    let actualAt = null;
    let status = "fulfilled";
    let paymentStatus = "succeeded";
    let refundStatus = "none";

    if (anomalyKind === "payment_failed") {
      status = "payment_failed";
      paymentStatus = "failed";
      promisedAt = new Date(now.getTime() + (2 + (index % 4)) * HOUR_MS);
    } else if (anomalyKind === "cancelled") {
      status = "cancelled";
      promisedAt = new Date(now.getTime() + (4 + (index % 3)) * HOUR_MS);
      refundStatus = index % 3 === 0 ? "processing" : "none";
    } else if (anomalyKind === "timeout") {
      status = "paid";
      promisedAt = new Date(now.getTime() - (2 + (index % 5)) * HOUR_MS);
    } else if (promisedAt.getTime() < now.getTime() - 30 * 60_000) {
      actualAt = new Date(promisedAt.getTime() - (20 + (index % 40)) * 60_000);
    } else {
      status = "paid";
      promisedAt = new Date(now.getTime() + (2 + (index % 6)) * HOUR_MS);
      actualAt = new Date(promisedAt.getTime() - 20 * 60_000);
    }

    orders.push(
      buildRow({
        sequence,
        orderedAt,
        promisedAt,
        actualAt,
        status,
        paymentStatus,
        region: "east",
        category: "digital",
        channel,
        merchant,
        paymentMethod,
        amount: amountFor(index, anomalyKind),
        refundStatus,
      }),
    );
  }
}

function addTodaySecondaryCohorts(orders, now, baseParts) {
  const cohorts = [
    { count: 120, region: "south", merchantOffset: 0 },
    { count: 80, region: "north", merchantOffset: 1 },
  ];
  let cohortIndex = 0;
  for (const cohort of cohorts) {
    for (let index = 0; index < cohort.count; index += 1) {
      const anomalyBand = index % 40;
      const anomalyKind =
        anomalyBand < 2
          ? "payment_failed"
          : anomalyBand < 3
            ? "cancelled"
            : anomalyBand < 5
              ? "timeout"
              : "none";
      const orderedAt = new Date(
        shanghaiTimestamp(baseParts, 8, 0).getTime() +
          ((index + 1) / cohort.count) *
            Math.max(
              60_000,
              Math.max(
                shanghaiTimestamp(baseParts, 8, 0).getTime(),
                now.getTime() - 20 * 60_000,
              ) - shanghaiTimestamp(baseParts, 8, 0).getTime(),
            ),
      );
      let promisedAt = new Date(orderedAt.getTime() + 6 * HOUR_MS);
      let actualAt = new Date(promisedAt.getTime() - 25 * 60_000);
      let status = "fulfilled";
      let paymentStatus = "succeeded";
      if (anomalyKind === "payment_failed") {
        status = "payment_failed";
        paymentStatus = "failed";
        actualAt = null;
      } else if (anomalyKind === "cancelled") {
        status = "cancelled";
        actualAt = null;
      } else if (anomalyKind === "timeout") {
        status = "paid";
        promisedAt = new Date(now.getTime() - HOUR_MS);
        actualAt = null;
      }
      orders.push(
        buildRow({
          sequence: orders.length + 1,
          orderedAt,
          promisedAt,
          actualAt,
          status,
          paymentStatus,
          region: cohort.region,
          category: "digital",
          channel: ["web", "app", "store"][index % 3],
          merchant: ["flagship", "marketplace", "direct"][
            (index + cohort.merchantOffset) % 3
          ],
          paymentMethod: ["wallet", "card", "transfer"][index % 3],
          amount: amountFor(index + cohortIndex * 100, anomalyKind),
        }),
      );
    }
    cohortIndex += 1;
  }
}

function addHistory(orders, now, baseParts) {
  for (let day = 1; day <= 13; day += 1) {
    for (const cohort of [
      { count: 300, region: "east" },
      { count: 100, region: "south" },
      { count: 100, region: "north" },
    ]) {
      for (let index = 0; index < cohort.count; index += 1) {
        const band = (index + day) % 50;
        const anomalyKind =
          band < 2
            ? "payment_failed"
            : band < 3
              ? "cancelled"
              : band < 5
                ? "timeout"
                : "none";
        const orderedAt = new Date(
          dayTimestamp(
            baseParts,
            -day,
            8 + ((index + day) % 10),
            (index * 7) % 60,
          ),
        );
        const promisedAt = new Date(orderedAt.getTime() + 6 * HOUR_MS);
        let actualAt = new Date(promisedAt.getTime() - 30 * 60_000);
        let status = "fulfilled";
        let paymentStatus = "succeeded";
        if (anomalyKind === "payment_failed") {
          status = "payment_failed";
          paymentStatus = "failed";
          actualAt = null;
        } else if (anomalyKind === "cancelled") {
          status = "cancelled";
          actualAt = null;
        } else if (anomalyKind === "timeout") {
          status = "paid";
          actualAt = null;
        }
        orders.push(
          buildRow({
            sequence: orders.length + 1,
            orderedAt,
            promisedAt,
            actualAt,
            status,
            paymentStatus,
            region: cohort.region,
            category: "digital",
            channel: ["app", "web", "store"][(index + day) % 3],
            merchant: ["flagship", "marketplace", "direct"][index % 3],
            paymentMethod: ["wallet", "card", "transfer"][(index + day) % 3],
            amount: amountFor(index + day * 17, anomalyKind),
          }),
        );
      }
    }
  }
}

function isAnomaly(order, cutoff) {
  if (order.payment_status === "failed" || order.order_status === "payment_failed") {
    return true;
  }
  if (order.order_status === "cancelled") return true;
  if (order.actual_fulfillment_at !== null) {
    return (
      new Date(order.actual_fulfillment_at).getTime() >
      new Date(order.promised_fulfillment_at).getTime()
    );
  }
  return new Date(order.promised_fulfillment_at).getTime() <= cutoff.getTime();
}

function summaryFor(orders, now) {
  const dayStart = shanghaiTimestamp(shanghaiParts(now), 0, 0);
  const scoped = orders.filter(
    (order) =>
      order.region === "east" &&
      order.category === "digital" &&
      new Date(order.ordered_at).getTime() >= dayStart.getTime() &&
      new Date(order.ordered_at).getTime() <= now.getTime(),
  );
  const paymentFailed = scoped.filter(
    (order) => order.payment_status === "failed",
  );
  const cancelled = scoped.filter(
    (order) => order.order_status === "cancelled",
  );
  const timeout = scoped.filter(
    (order) =>
      order.payment_status !== "failed" &&
      order.order_status !== "cancelled" &&
      order.actual_fulfillment_at === null &&
      new Date(order.promised_fulfillment_at).getTime() <= now.getTime(),
  );
  const anomalies = scoped.filter((order) => isAnomaly(order, now));
  const amount = (rows) => round(rows.reduce((total, row) => total + row.amount, 0));
  return {
    scope: "today · east · digital",
    orderCount: scoped.length,
    exceptionCount: anomalies.length,
    exceptionRate: round((anomalies.length / scoped.length) * 100),
    paymentFailureCount: paymentFailed.length,
    cancelledCount: cancelled.length,
    fulfillmentTimeoutCount: timeout.length,
    orderAmount: amount(scoped),
    exceptionAmount: amount(anomalies),
    averageOrderAmount: round(amount(scoped) / scoped.length),
  };
}

function workbenchMetricSummary(orders, now) {
  const currentFrom = new Date(now.getTime() - 7 * DAY_MS);
  const previousFrom = new Date(now.getTime() - 14 * DAY_MS);
  const scoped = (from, to) =>
    orders.filter(
      (order) =>
        new Date(order.ordered_at).getTime() >= from.getTime() &&
        new Date(order.ordered_at).getTime() <= to.getTime(),
    );
  const onTimeRate = (rows) => {
    const due = rows.filter(
      (order) =>
        order.payment_status !== "failed" &&
        order.order_status !== "cancelled" &&
        new Date(order.promised_fulfillment_at).getTime() <= now.getTime(),
    );
    const late = due.filter(
      (order) =>
        order.actual_fulfillment_at === null ||
        new Date(order.actual_fulfillment_at).getTime() >
          new Date(order.promised_fulfillment_at).getTime(),
    );
    return due.length === 0 ? 0 : round(((due.length - late.length) / due.length) * 100, 1);
  };
  const current = onTimeRate(scoped(currentFrom, now));
  const previous = onTimeRate(scoped(previousFrom, currentFrom));
  return {
    currentOnTimeRate: current,
    previousOnTimeRate: previous,
    deltaPt: round(current - previous, 1),
  };
}

function calibrateWorkbenchRates(orders, now) {
  const currentFrom = new Date(now.getTime() - 7 * DAY_MS);
  const previousFrom = new Date(now.getTime() - 14 * DAY_MS);
  const dueBetween = (order, from, to) =>
    order.payment_status !== "failed" &&
    order.order_status !== "cancelled" &&
    new Date(order.ordered_at).getTime() >= from.getTime() &&
    new Date(order.ordered_at).getTime() <= to.getTime() &&
    new Date(order.promised_fulfillment_at).getTime() <= now.getTime();
  const late = (order) =>
    order.actual_fulfillment_at === null ||
    new Date(order.actual_fulfillment_at).getTime() >
      new Date(order.promised_fulfillment_at).getTime();
  const southLate = orders
    .filter(
      (order) =>
        dueBetween(order, currentFrom, now) &&
        order.region === "south" &&
        late(order),
    )
    .slice(0, 7);
  for (const order of southLate) {
    order.actual_fulfillment_at = iso(
      new Date(order.promised_fulfillment_at).getTime() - 20 * 60_000,
    );
  }
  const northOnTime = orders
    .filter(
      (order) =>
        dueBetween(order, currentFrom, now) &&
        order.region === "north" &&
        !late(order),
    )
    .slice(0, southLate.length);
  for (const order of northOnTime) {
    order.actual_fulfillment_at = iso(
      new Date(order.promised_fulfillment_at).getTime() + 60 * 60_000,
    );
  }
  const previousSouthLate = orders
    .filter(
      (order) =>
        dueBetween(order, previousFrom, currentFrom) &&
        order.region === "south" &&
        late(order),
    )
    .slice(0, 2);
  for (const order of previousSouthLate) {
    order.actual_fulfillment_at = iso(
      new Date(order.promised_fulfillment_at).getTime() - 20 * 60_000,
    );
  }
  const previousNorthOnTime = orders
    .filter(
      (order) =>
        dueBetween(order, previousFrom, currentFrom) &&
        order.region === "north" &&
        !late(order),
    )
    .slice(0, previousSouthLate.length);
  for (const order of previousNorthOnTime) {
    order.actual_fulfillment_at = iso(
      new Date(order.promised_fulfillment_at).getTime() + 60 * 60_000,
    );
  }
}

const args = parseArgs(process.argv.slice(2));
const now = args.now;
const baseParts = shanghaiParts(now);
const orders = [];
addHistory(orders, now, baseParts);
addTodaySecondaryCohorts(orders, now, baseParts);
addTodayMainCohort(orders, now, baseParts);
calibrateWorkbenchRates(orders, now);
orders.sort(
  (left, right) =>
    new Date(left.ordered_at).getTime() - new Date(right.ordered_at).getTime(),
);
orders.forEach((order, index) => {
  order.order_id = `PT-DEMO-${String(index + 1).padStart(7, "0")}`;
});

const fixture = {
  fixtureId: "phone-tablet-order-exception-v1",
  fixtureVersion: "1.0.0",
  source: "mock-order-management-system",
  generatedAt: iso(now),
  snapshotAt: iso(now),
  timezone: "Asia/Shanghai",
  coverageNote: "当前授权：华东、华南；未覆盖：华北、西南",
  expected: {
    ...summaryFor(orders, now),
    ...workbenchMetricSummary(orders, now),
    totalRows: orders.length,
  },
  orders,
};

await mkdir(dirname(args.out), { recursive: true });
await writeFile(args.out, `${JSON.stringify(fixture)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      output: args.out,
      generatedAt: fixture.generatedAt,
      expected: fixture.expected,
    },
    null,
    2,
  ),
);

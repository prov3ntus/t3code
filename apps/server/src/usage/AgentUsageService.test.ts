import { expect, it } from "@effect/vitest";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as AgentUsage from "./AgentUsageService.ts";

const provider = (usedPercent: number): ServerProvider => ({
  instanceId: ProviderInstanceId.make("codex-work"),
  driver: ProviderDriverKind.make("codex"),
  displayName: "Work account",
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "1970-01-01T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
  usageLimits: {
    checkedAt: "1970-01-01T00:00:00.000Z",
    windows: [
      {
        id: "weekly",
        kind: "weekly",
        label: "Weekly",
        usedPercent,
        resetsAt: "1970-01-08T00:00:00.000Z",
      },
    ],
  },
});

it.effect("reads cached limits across providers without invoking provider probes", () =>
  Effect.gen(function* () {
    const service = yield* AgentUsage.AgentUsageService;
    const first = yield* service.readLimits({});
    const second = yield* service.readLimits({
      providerInstanceId: ProviderInstanceId.make("claude-work"),
    });
    expect(first.providers.map((entry) => entry.status)).toEqual(["nearLimit", "unknown"]);
    expect(second.providers).toHaveLength(1);
    expect(first.providers[0]).toMatchObject({
      checkedAt: "1970-01-01T00:00:00.000Z",
      windows: [{ usedPercent: 90, limitHit: false, resetDue: false }],
    });
    const error = yield* service
      .readLimits({ providerInstanceId: ProviderInstanceId.make("missing") })
      .pipe(Effect.flip);
    expect(error.code).toBe("invalid_request");
  }).pipe(
    Effect.provide(
      AgentUsage.layer.pipe(
        Layer.provide(
          Layer.mock(ProviderRegistry.ProviderRegistry)({
            getProviders: Effect.succeed([
              provider(90),
              {
                ...provider(0),
                instanceId: ProviderInstanceId.make("claude-work"),
                driver: ProviderDriverKind.make("claudeAgent"),
                usageLimits: undefined,
              },
            ]),
            refresh: () => Effect.die("must not refresh credentials"),
            refreshInstance: () => Effect.die("must not launch CLI"),
          }),
        ),
      ),
    ),
  ),
);

it.effect("preserves uncertainty for stale, expired, failed and signed-out readings", () => {
  const limits = provider(100).usageLimits!;
  const expired = { ...limits.windows[0]!, resetsAt: "1970-01-01T00:00:00.000Z" };
  const cases = [
    { ...provider(0) },
    { ...provider(89) },
    { ...provider(90) },
    { ...provider(100) },
    { ...provider(100), usageLimits: { ...limits, checkedAt: "1969-12-31T23:54:59.000Z" } },
    { ...provider(100), usageLimits: { ...limits, windows: [expired] } },
    {
      ...provider(100),
      usageLimits: { ...limits, windows: [expired, { ...limits.windows[0]!, id: "active" }] },
    },
    { ...provider(100), auth: { status: "unauthenticated" as const } },
    {
      ...provider(100),
      usageLimits: { ...limits, unavailable: { reason: "probeFailed" as const } },
    },
  ];
  return Effect.gen(function* () {
    const service = yield* AgentUsage.AgentUsageService;
    const result = yield* service.readLimits({});
    expect(result.providers.map((entry) => entry.status)).toEqual([
      "available",
      "available",
      "nearLimit",
      "limitHit",
      "unknown",
      "unknown",
      "limitHit",
      "unknown",
      "unknown",
    ]);
  }).pipe(
    Effect.provide(
      AgentUsage.layer.pipe(
        Layer.provide(
          Layer.mock(ProviderRegistry.ProviderRegistry)({
            getProviders: Effect.succeed(cases),
          }),
        ),
      ),
    ),
  );
});

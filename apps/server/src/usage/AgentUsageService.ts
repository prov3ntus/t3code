import {
  type AgentUsageLimitsInput,
  type AgentUsageLimitsResult,
  OrchestratorMcpFailure,
  type ServerProvider,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ProviderRegistry from "../provider/ProviderRegistry.ts";

const MAX_LIMIT_AGE_MS = 5 * 60 * 1000;

function providerUsageStatus(
  provider: ServerProvider,
  nowMs: number,
): AgentUsageLimitsResult["providers"][number]["status"] {
  const limits = provider.usageLimits;
  if (
    !provider.enabled ||
    !provider.installed ||
    provider.availability === "unavailable" ||
    provider.auth.status === "unauthenticated" ||
    provider.status === "error" ||
    provider.status === "disabled" ||
    limits === undefined ||
    limits.unavailable !== undefined ||
    !Number.isFinite(Date.parse(limits.checkedAt)) ||
    nowMs - Date.parse(limits.checkedAt) > MAX_LIMIT_AGE_MS ||
    limits.windows.length === 0
  )
    return "unknown";
  const activeWindows = limits.windows.filter(
    (window) => window.resetsAt === undefined || Date.parse(window.resetsAt) > nowMs,
  );
  if (activeWindows.some((window) => window.usedPercent >= 100)) return "limitHit";
  if (activeWindows.some((window) => window.usedPercent >= 90)) return "nearLimit";
  return activeWindows.length === limits.windows.length ? "available" : "unknown";
}

export class AgentUsageService extends Context.Service<
  AgentUsageService,
  {
    readonly readLimits: (
      input: AgentUsageLimitsInput,
    ) => Effect.Effect<AgentUsageLimitsResult, OrchestratorMcpFailure>;
  }
>()("t3/usage/AgentUsageService") {}

const make = Effect.gen(function* () {
  const registry = yield* ProviderRegistry.ProviderRegistry;

  const readLimits = Effect.fn("AgentUsageService.readLimits")(function* (
    input: AgentUsageLimitsInput,
  ) {
    const snapshots = yield* registry.getProviders;
    const selected = snapshots.filter(
      (provider) =>
        input.providerInstanceId === undefined || provider.instanceId === input.providerInstanceId,
    );
    if (input.providerInstanceId !== undefined && selected.length === 0) {
      return yield* new OrchestratorMcpFailure({
        code: "invalid_request",
        message: "The provider instance was not found.",
      });
    }
    const now = yield* DateTime.now;
    const nowMs = DateTime.toEpochMillis(now);
    return {
      readAt: DateTime.formatIso(now),
      providers: selected.map((provider) => {
        const limits = provider.usageLimits;
        const windows = (limits?.windows ?? []).map((window) => ({
          ...window,
          limitHit: window.usedPercent >= 100,
          resetDue: window.resetsAt !== undefined && Date.parse(window.resetsAt) <= nowMs,
        }));
        const unknown = limits?.unavailable !== undefined || windows.length === 0;
        return {
          providerInstanceId: provider.instanceId,
          driver: provider.driver,
          displayName: provider.displayName ?? null,
          checkedAt: limits?.checkedAt ?? null,
          status: providerUsageStatus(provider, nowMs),
          windows,
          ...(unknown
            ? { unavailableReason: limits?.unavailable?.reason ?? ("notReported" as const) }
            : {}),
        };
      }),
      notices: [
        "Percentages are provider-reported subscription allowances, not token or dollar budgets.",
        "checkedAt is the last environment probe time. This tool only reads snapshots and never launches CLIs or refreshes credentials. Missing or failed probes mean unknown, not zero usage.",
        "A resetDue window or a snapshot older than five minutes is unknown. limitHit describes the last reported percentage. A current active limit takes precedence over an expired window.",
      ],
    } satisfies AgentUsageLimitsResult;
  });

  return AgentUsageService.of({ readLimits });
});

export const layer = Layer.effect(AgentUsageService, make);

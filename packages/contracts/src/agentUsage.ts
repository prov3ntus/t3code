import * as Schema from "effect/Schema";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";
import { ServerProviderUsageWindow } from "./providerUsageLimits.ts";

export const AgentUsageLimitsInput = Schema.Struct({
  providerInstanceId: Schema.optional(ProviderInstanceId),
});
export type AgentUsageLimitsInput = typeof AgentUsageLimitsInput.Type;

export const AgentUsageLimitStatus = Schema.Literals([
  "available",
  "nearLimit",
  "limitHit",
  "unknown",
]);

export const AgentUsageLimitsResult = Schema.Struct({
  readAt: IsoDateTime,
  providers: Schema.Array(
    Schema.Struct({
      providerInstanceId: ProviderInstanceId,
      driver: ProviderDriverKind,
      displayName: Schema.NullOr(Schema.String),
      checkedAt: Schema.NullOr(IsoDateTime),
      status: AgentUsageLimitStatus,
      windows: Schema.Array(
        Schema.Struct({
          ...ServerProviderUsageWindow.fields,
          limitHit: Schema.Boolean,
          resetDue: Schema.Boolean,
        }),
      ),
      unavailableReason: Schema.optional(
        Schema.Literals(["unsupported", "probeFailed", "notReported"]),
      ),
    }),
  ),
  notices: Schema.Array(TrimmedNonEmptyString),
});
export type AgentUsageLimitsResult = typeof AgentUsageLimitsResult.Type;

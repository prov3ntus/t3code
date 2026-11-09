import * as Effect from "effect/Effect";

import * as AgentUsageService from "../../../usage/AgentUsageService.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { readCaller } from "../../threadAccess.ts";
import { UsageToolkit } from "./tools.ts";

export const layer = McpToolAccess.toLayer(UsageToolkit, {
  t3_usage_limits: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      yield* readCaller();
      const usage = yield* AgentUsageService.AgentUsageService;
      return yield* usage.readLimits(input);
    }),
  ),
});

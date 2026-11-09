import {
  AgentUsageLimitsInput,
  AgentUsageLimitsResult,
  OrchestratorMcpFailure,
} from "@t3tools/contracts";
import { Tool, Toolkit } from "effect/ai";

import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as AgentUsageService from "../../../usage/AgentUsageService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const UsageLimitsTool = Tool.make("t3_usage_limits", {
  description:
    "Read cached subscription limits for all provider instances or one providerInstanceId. Returns used percentages, reset times, limitHit, and nearLimit (90%) status. checkedAt is the last environment observation. Missing readings, expired windows, and snapshots older than five minutes are unknown. Does not launch CLIs or refresh credentials.",
  parameters: AgentUsageLimitsInput,
  success: AgentUsageLimitsResult,
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    AgentUsageService.AgentUsageService,
  ],
})
  .annotate(Tool.Title, "Read provider usage limits")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, true);

export const UsageToolkit = Toolkit.make(UsageLimitsTool);

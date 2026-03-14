/*
Purpose: Describe which planning integration providers are available to the desktop application in the current MCP-only MVP.
Out of scope: Provider client creation and planning workflow orchestration.
*/
import type { AgentProviderId } from "../../shared/contracts/desktop-api";

export interface AgentRegistry {
  providers: readonly AgentProviderId[];
}

export function createAgentRegistry(): AgentRegistry {
  return {
    providers: ["mcp"]
  };
}

// Run-wide safety ledger. Checks that run a host record what they planted and saw here;
// cli.ts turns any entry into a SANDBOX BREACH (exit 3) after the table.
export interface SafetyLedger {
  agentRuns: number;
  canariesPlanted: number;
  canaryLeaks: string[];
  authViolations: string[];
  egress: string[];
}

const ledger: SafetyLedger = { agentRuns: 0, canariesPlanted: 0, canaryLeaks: [], authViolations: [], egress: [] };

export function safetyLedger(): SafetyLedger {
  return ledger;
}

/**
 * Spending plan: every decision that costs resources becomes a request with a priority. Requests
 * are approved from the highest priority down while they are affordable. The first one that is not
 * affordable reserves what it needs, so cheaper, less important requests cannot starve it.
 */
import type { Command, ResourceAmounts } from '../src/shared';

export type Cost = Partial<ResourceAmounts>;

export interface Request {
  priority: number;
  cost: Cost;
  /** For the debug line, e.g. "house" or "train worker". */
  label: string;
  /** Called only when approved; returns the commands to send. */
  commit: () => Command[];
}

const RESOURCES = ['food', 'wood', 'gold'] as const;

export function affordable(have: ResourceAmounts, cost: Cost): boolean {
  return RESOURCES.every((r) => (cost[r] ?? 0) <= have[r]);
}

export interface BudgetResult {
  commands: Command[];
  approved: string[];
  /** The request being saved for, if any. */
  saving: string | null;
}

export function allocate(available: ResourceAmounts, requests: Request[]): BudgetResult {
  const left = { ...available };
  const sorted = [...requests].sort((a, b) => b.priority - a.priority);
  const commands: Command[] = [];
  const approved: string[] = [];
  let saving: string | null = null;
  for (const r of sorted) {
    if (affordable(left, r.cost)) {
      for (const k of RESOURCES) left[k] -= r.cost[k] ?? 0;
      commands.push(...r.commit());
      approved.push(r.label);
    } else if (saving === null) {
      saving = r.label;
      for (const k of RESOURCES) left[k] = Math.max(0, left[k] - (r.cost[k] ?? 0));
    }
  }
  return { commands, approved, saving };
}

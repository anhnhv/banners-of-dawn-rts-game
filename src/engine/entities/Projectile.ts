/** A projectile in flight (PLAN §5.3 step 11). Kinds and flight rules come from projectiles.json. */
import type { AttackDef, EntityId, PlayerId } from '../../shared';

export interface Projectile {
  id: EntityId;
  kind: string;
  owner: PlayerId;
  /** Who fired it (for retaliation and target priority). */
  source: EntityId;
  /** The attack that fired it (damage, bonus, splash), so the hit is computed at impact. */
  attack: AttackDef;
  /** Homing target; null for projectiles that land on a point (or whose target died). */
  target: EntityId | null;
  /** False once a homing target is gone: it lands harmlessly. */
  live: boolean;
  /** Aim point (follows a homing target). */
  tx: number;
  ty: number;
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  startZ: number;
  endZ: number;
  /** Ground distance flown so far. */
  flown: number;
  speed: number;
  arc: number;
}

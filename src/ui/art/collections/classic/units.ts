/** Classic unit models: a rigid body plus legs (and arms for people) that swing when walking. */
import type { VoxelBuilder } from '../../VoxelBuilder';
import type { ArtCollectionParts, LegPart, UnitKit } from '../types';

const HIP = 0.17;
const SHOULDER = HIP + 0.2;

/** Torso and head of a person. Arms are separate parts (see arm()) so they can swing. */
function humanoid(b: VoxelBuilder, y0: number, torso: string): void {
  b.boxC(0, y0, 0, 0.26, 0.2, 0.16, 'cloth', torso);
  b.boxC(0, y0 + 0.03, 0, 0.27, 0.035, 0.17, 'plain', 'leather');
  b.boxC(0, y0 + 0.2, 0, 0.21, 0.2, 0.2, 'plain', 'skin');
  b.boxC(0.05, y0 + 0.28, 0.1, 0.035, 0.045, 0.01, 'plain', 'ink');
  b.boxC(-0.05, y0 + 0.28, 0.1, 0.035, 0.045, 0.01, 'plain', 'ink');
}

function leg(
  kit: UnitKit,
  color: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): LegPart {
  const b = kit.part();
  b.box(-w / 2, -h, -d / 2, w, h, d, 'plain', color);
  return { geometry: b.build(), pivot: [x, y, z] };
}

/** One arm hanging from the shoulder pivot (x, y, 0), with the hand and an optional tool. */
function arm(kit: UnitKit, color: string, x: number, y: number, tool?: (b: VoxelBuilder) => void): LegPart {
  const b = kit.part();
  b.boxC(0, -0.17, 0, 0.07, 0.17, 0.09, 'cloth', color);
  b.boxC(0, -0.2, 0, 0.065, 0.04, 0.085, 'plain', 'skin');
  tool?.(b);
  return { geometry: b.build(), pivot: [x, y, 0] };
}

function horse(kit: UnitKit, coat: string, dark: string): void {
  const b = kit.body;
  b.boxC(0, 0.3, 0, 0.3, 0.26, 0.62, 'plain', coat);
  b.boxC(0, 0.3, 0, 0.34, 0.15, 0.5, 'cloth', 'team');
  b.boxC(0, 0.45, 0.27, 0.18, 0.3, 0.18, 'plain', coat);
  b.boxC(0, 0.65, 0.39, 0.16, 0.14, 0.28, 'plain', coat);
  b.boxC(0, 0.72, 0.3, 0.05, 0.12, 0.2, 'plain', dark); // mane
  b.boxC(0, 0.42, -0.34, 0.06, 0.22, 0.08, 'plain', dark); // tail
  for (const [x, z] of [
    [0.1, 0.22],
    [-0.1, 0.22],
    [0.1, -0.22],
    [-0.1, -0.22],
  ] as const)
    kit.legs.push(leg(kit, dark, 0.08, 0.3, 0.08, x, 0.3, z));
}

/** A person on foot: torso color, sleeves, an optional tool in the right hand, leg color. */
function person(
  kit: UnitKit,
  torso: string,
  sleeve: string,
  legColor: string,
  tool?: (b: VoxelBuilder) => void,
): void {
  humanoid(kit.body, HIP, torso);
  kit.arms.push(arm(kit, sleeve, -0.165, SHOULDER));
  kit.arms.push(arm(kit, sleeve, 0.165, SHOULDER, tool));
  kit.legs.push(leg(kit, legColor, 0.09, HIP, 0.1, 0.065, HIP, 0));
  kit.legs.push(leg(kit, legColor, 0.09, HIP, 0.1, -0.065, HIP, 0));
}

export const units: ArtCollectionParts['units'] = {
  worker: (kit) => {
    const axe = (a: VoxelBuilder): void => {
      a.boxC(0.035, -0.22, 0.07, 0.03, 0.3, 0.03, 'bark', 'wood'); // handle
      a.boxC(0.035, 0.02, 0.11, 0.03, 0.08, 0.08, 'plain', 'iron'); // head
    };
    person(kit, 'team-light', 'cloth', 'leather', axe);
    const b = kit.body;
    b.boxC(0, HIP + 0.4, 0, 0.32, 0.035, 0.32, 'thatch', 'straw'); // straw hat
    b.boxC(0, HIP + 0.435, 0, 0.17, 0.06, 0.17, 'thatch', 'straw');
  },

  militia: (kit) => {
    person(kit, 'team', 'team-dark', 'iron-dark');
    const b = kit.body;
    b.boxC(0, HIP + 0.37, 0, 0.23, 0.09, 0.23, 'plain', 'iron');
    b.boxC(0, HIP + 0.33, 0, 0.26, 0.03, 0.26, 'plain', 'iron-dark');
    b.boxC(0.2, HIP - 0.1, 0.07, 0.03, 0.82, 0.03, 'bark', 'wood'); // spear
    b.boxC(0.2, HIP + 0.72, 0.07, 0.05, 0.1, 0.05, 'plain', 'iron');
    b.boxC(-0.21, HIP - 0.02, 0.02, 0.04, 0.22, 0.19, 'planks', 'team'); // shield
    b.boxC(-0.235, HIP + 0.07, 0.02, 0.02, 0.05, 0.05, 'plain', 'iron');
  },

  // heavy foot soldier: full helm, mail, a tall team shield and a short sword
  guard: (kit) => {
    const sword = (a: VoxelBuilder): void => {
      a.boxC(0.01, -0.24, 0.05, 0.05, 0.03, 0.12, 'plain', 'iron-dark'); // crossguard
      a.boxC(0.01, -0.22, 0.2, 0.035, 0.025, 0.3, 'plain', 'iron'); // blade, pointing forward
    };
    humanoid(kit.body, HIP, 'iron');
    kit.arms.push(arm(kit, 'iron-dark', -0.165, SHOULDER));
    kit.arms.push(arm(kit, 'iron-dark', 0.165, SHOULDER, sword));
    kit.legs.push(leg(kit, 'iron-dark', 0.09, HIP, 0.1, 0.065, HIP, 0));
    kit.legs.push(leg(kit, 'iron-dark', 0.09, HIP, 0.1, -0.065, HIP, 0));
    const b = kit.body;
    b.boxC(0, HIP + 0.1, 0, 0.27, 0.06, 0.17, 'cloth', 'team'); // tabard band
    b.boxC(0, HIP + 0.36, 0, 0.24, 0.12, 0.24, 'plain', 'iron'); // helm
    b.boxC(0, HIP + 0.3, 0.1, 0.16, 0.03, 0.02, 'plain', 'ink'); // visor slit
    b.boxC(0, HIP + 0.48, 0, 0.05, 0.07, 0.16, 'cloth', 'team-light'); // crest
    b.boxC(-0.22, HIP - 0.12, 0.05, 0.05, 0.42, 0.26, 'planks', 'team'); // tall shield
    b.boxC(-0.25, HIP + 0.06, 0.05, 0.02, 0.07, 0.07, 'plain', 'iron');
    b.boxC(-0.22, HIP + 0.3, 0.05, 0.055, 0.03, 0.27, 'plain', 'iron-dark'); // shield rim
  },

  // light skirmisher: no armor, a headband, a pouch of stones and a sling
  slinger: (kit) => {
    const sling = (a: VoxelBuilder): void => {
      a.boxC(0.02, -0.34, 0.05, 0.015, 0.14, 0.015, 'plain', 'leather'); // the two cords
      a.boxC(-0.02, -0.34, 0.05, 0.015, 0.14, 0.015, 'plain', 'leather');
      a.boxC(0, -0.4, 0.05, 0.07, 0.06, 0.07, 'rock', 'stone'); // the stone in its cradle
    };
    person(kit, 'team-light', 'cloth', 'leather', sling);
    const b = kit.body;
    b.boxC(0, HIP + 0.33, 0, 0.22, 0.04, 0.21, 'cloth', 'team'); // headband
    b.boxC(-0.1, HIP + 0.02, 0.1, 0.1, 0.1, 0.06, 'plain', 'leather'); // pouch
    b.boxC(-0.1, HIP + 0.12, 0.1, 0.06, 0.03, 0.04, 'rock', 'stone');
  },

  archer: (kit) => {
    person(kit, 'team', 'team-dark', 'leather');
    const b = kit.body;
    b.boxC(0, HIP + 0.33, -0.01, 0.23, 0.13, 0.23, 'cloth', 'team-dark');
    b.boxC(0, HIP + 0.38, -0.12, 0.12, 0.06, 0.04, 'cloth', 'team-dark');
    b.boxC(-0.22, HIP - 0.08, 0.06, 0.03, 0.46, 0.03, 'bark', 'wood-light'); // bow
    b.boxC(-0.22, HIP + 0.38, 0.03, 0.03, 0.04, 0.06, 'bark', 'wood-light');
    b.boxC(-0.22, HIP - 0.12, 0.03, 0.03, 0.04, 0.06, 'bark', 'wood-light');
    b.boxC(0.06, HIP + 0.03, -0.11, 0.08, 0.24, 0.06, 'plain', 'leather'); // quiver
    b.boxC(0.06, HIP + 0.27, -0.11, 0.06, 0.05, 0.04, 'plain', 'cloth');
  },

  scoutRider: (kit) => {
    horse(kit, 'wood-light', 'wood');
    const b = kit.body;
    b.boxC(0, 0.56, -0.02, 0.25, 0.19, 0.17, 'plain', 'leather');
    b.boxC(0, 0.6, -0.11, 0.27, 0.22, 0.03, 'cloth', 'team'); // cape
    b.boxC(0.16, 0.58, 0, 0.07, 0.16, 0.09, 'cloth', 'team-dark');
    b.boxC(-0.16, 0.58, 0, 0.07, 0.16, 0.09, 'cloth', 'team-dark');
    b.boxC(0, 0.75, -0.02, 0.2, 0.19, 0.19, 'plain', 'skin');
    b.boxC(0.045, 0.83, 0.075, 0.03, 0.04, 0.01, 'plain', 'ink');
    b.boxC(-0.045, 0.83, 0.075, 0.03, 0.04, 0.01, 'plain', 'ink');
    b.boxC(0, 0.92, -0.02, 0.22, 0.06, 0.22, 'cloth', 'team-light'); // cap
    b.boxC(0.2, 0.55, 0.12, 0.03, 0.03, 0.55, 'bark', 'wood'); // short spear
    b.boxC(0.2, 0.545, 0.42, 0.05, 0.05, 0.08, 'plain', 'iron');
  },

  knight: (kit) => {
    horse(kit, 'horse', 'horse-dark');
    const b = kit.body;
    b.boxC(0, 0.56, -0.02, 0.26, 0.2, 0.18, 'plain', 'iron');
    b.boxC(0, 0.56, 0.0, 0.27, 0.06, 0.19, 'cloth', 'team');
    b.boxC(0.16, 0.58, 0, 0.07, 0.17, 0.09, 'plain', 'iron-dark');
    b.boxC(-0.16, 0.58, 0, 0.07, 0.17, 0.09, 'plain', 'iron-dark');
    b.boxC(0, 0.76, -0.02, 0.22, 0.21, 0.21, 'plain', 'iron');
    b.boxC(0, 0.83, 0.09, 0.16, 0.035, 0.01, 'plain', 'ink'); // visor slit
    b.boxC(0, 0.97, -0.02, 0.05, 0.08, 0.16, 'cloth', 'team-light'); // plume
    b.boxC(0.2, 0.62, 0.25, 0.04, 0.04, 0.9, 'bark', 'wood'); // lance
    b.boxC(0.2, 0.61, 0.72, 0.06, 0.06, 0.1, 'plain', 'iron');
    b.boxC(-0.21, 0.5, 0.02, 0.04, 0.24, 0.2, 'planks', 'team'); // shield
  },

  // a siege engine: no legs or arms, it rolls (the walk cycle only bobs it a little)
  catapult: (kit) => {
    const b = kit.body;
    b.boxC(0, 0.12, 0, 0.42, 0.07, 0.84, 'planks', 'wood'); // deck
    b.boxC(0.22, 0.1, 0, 0.06, 0.08, 0.92, 'planks', 'wood-dark'); // side beams
    b.boxC(-0.22, 0.1, 0, 0.06, 0.08, 0.92, 'planks', 'wood-dark');
    for (const [x, z] of [
      [0.28, 0.27],
      [-0.28, 0.27],
      [0.28, -0.27],
      [-0.28, -0.27],
    ] as const) {
      b.boxC(x, 0, z, 0.06, 0.26, 0.26, 'bark', 'wood-dark'); // wheel
      b.boxC(x + Math.sign(x) * 0.035, 0.1, z, 0.02, 0.06, 0.06, 'plain', 'iron'); // hub
    }
    b.boxC(0.15, 0.19, 0.08, 0.06, 0.4, 0.06, 'planks', 'wood'); // uprights
    b.boxC(-0.15, 0.19, 0.08, 0.06, 0.4, 0.06, 'planks', 'wood');
    b.boxC(0, 0.55, 0.08, 0.36, 0.06, 0.07, 'cloth', 'team'); // padded crossbar
    // the throwing arm, raised toward the back, in four steps
    for (let i = 0; i < 4; i++)
      b.boxC(0, 0.22 + i * 0.13, 0.12 - i * 0.12, 0.06, 0.15, 0.08, 'bark', 'wood-light');
    b.boxC(0, 0.68, -0.36, 0.17, 0.06, 0.17, 'planks', 'wood-dark'); // bucket
    b.boxC(0, 0.74, -0.36, 0.11, 0.1, 0.11, 'rock', 'stone');
    b.boxC(0, 0.19, -0.3, 0.22, 0.14, 0.16, 'rock', 'stone-dark'); // ballast
    b.boxC(0, 0.19, 0.36, 0.2, 0.12, 0.1, 'cloth', 'team-dark'); // team banner box
  },
};

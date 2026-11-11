/** How to Play (text version; illustrated pages come in M10). */
import { el } from './menuKit';

const SECTIONS: Array<[string, string[]]> = [
  [
    'Goal',
    [
      "Destroy the machine player's Town Hall. If you lose yours, you lose.",
      'You can also surrender from the pause menu (Esc).',
    ],
  ],
  [
    'Economy',
    [
      'Workers gather food (berry bushes), wood (trees) and gold (gold mines): select them and right click a resource.',
      'Farms (build menu S) cost wood and give food forever to two workers each, as fast as berries: build them before the berries run out.',
      'What they gather goes straight to your stockpile. No carrying, no drop-off.',
      'The Town Hall trains more workers. Houses raise your population limit.',
    ],
  ],
  [
    'Building',
    [
      'Press B (or the hammer button), pick a building, then click the map. It builds itself: no workers needed.',
      'Barracks: foot soldiers (Militia, Guards) and shooters (Slingers, Archers). Stable: riders (Scout Riders, Knights). Siege Workshop: Catapults. Watch Tower: shoots nearby enemies.',
    ],
  ],
  [
    'Army',
    [
      'Foot soldiers beat riders, riders beat shooters, shooters beat foot soldiers. One exception: the Guard carries a shield, so it beats Archers (Slingers still beat it).',
      'Each kind has a unit that needs no gold (Militia, Slinger, Scout Rider) and a stronger one that does (Guard, Archer, Knight). Every unit has at least two counters, and one of them never needs gold: hover a train button to see what a unit is strong and weak against.',
      'Catapults break towers and bases from out of their range but need an escort.',
      'Right click an enemy to attack it. Attack-move (Q) fights everything on the way.',
      'Hold ground (E) keeps units in place; Aggressive (R) lets them chase.',
    ],
  ],
  [
    'Controls',
    [
      'Click or drag to select. Double click: all of that type on screen. Ctrl+1–9 saves a group, 1–9 selects it.',
      'Arrow keys, screen edge or middle drag: move the camera. Wheel: zoom. Period (.): next idle worker.',
      'P: pause. + / -: game speed. Esc: cancel, or open the menu.',
    ],
  ],
];

export function howToPlayPanel(): HTMLElement {
  const panel = el('div', 'howto');
  for (const [title, lines] of SECTIONS) {
    const section = el('div', 'howto-section');
    section.append(el('div', 'howto-title', title));
    for (const line of lines) section.append(el('p', '', line));
    panel.append(section);
  }
  return panel;
}

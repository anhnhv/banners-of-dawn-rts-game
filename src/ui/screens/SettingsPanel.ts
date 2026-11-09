/** The Settings screen (docs/plans/m7-menus-art-maps.md §4), used by the Main Menu and the pause menu. */
import type { Settings } from '../settings';
import { choiceRow, el, optionBlock } from './menuKit';

const ON_OFF = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
] as const;

/** Every change is applied at once through `onChange` (which also saves it). */
export function settingsPanel(settings: Settings, onChange: (s: Settings) => void): HTMLElement {
  const panel = el('div', 'settings-list');
  const current: Settings = { ...settings };
  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    current[key] = value;
    onChange({ ...current });
  };
  const row = <K extends keyof Settings>(
    label: string,
    key: K,
    options: ReadonlyArray<{ value: Settings[K]; label: string }>,
    help: string,
  ): void => {
    const control = choiceRow(options, current[key], (v) => update(key, v));
    panel.append(optionBlock(label, control.element, el('div', 'option-help', help)));
  };
  row('Edge scrolling', 'edgeScroll', ON_OFF, 'Move the camera when the mouse touches the screen edge.');
  row(
    'Scroll speed',
    'scrollSpeed',
    [
      { value: 'slow', label: 'Slow' },
      { value: 'normal', label: 'Normal' },
      { value: 'fast', label: 'Fast' },
    ],
    'How fast the arrow keys and the screen edge move the camera.',
  );
  row('Shadows', 'shadows', ON_OFF, 'Turn off on a slow computer.');
  row(
    'Render quality',
    'quality',
    [
      { value: 'high', label: 'High' },
      { value: 'low', label: 'Low' },
    ],
    'Low draws fewer pixels: faster on a slow graphics card, a little blurry.',
  );
  row('Show FPS', 'showFps', ON_OFF, 'Frames per second and draw calls in the help box.');
  row("Show the machine's plan", 'showAiStatus', ON_OFF, 'One line saying what the machine player is doing.');
  return panel;
}

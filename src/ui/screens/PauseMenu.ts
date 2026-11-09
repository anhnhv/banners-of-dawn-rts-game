/**
 * The pause menu (docs/plans/m7-menus-art-maps.md §2.5): opened with Esc or the menu button; the
 * match is paused while it is open. Surrender and Quit need a second click to confirm.
 */
import { formatSpeed } from '../../shared';
import type { Settings } from '../settings';
import { howToPlayPanel } from './HowToPlay';
import { choiceRow, el, menuButton, optionBlock } from './menuKit';
import { settingsPanel } from './SettingsPanel';

export interface PauseMenuOptions {
  speeds: readonly number[];
  speed(): number;
  settings(): Settings;
  onSpeed(speed: number): void;
  onSettings(settings: Settings): void;
  onResume(): void;
  onRestart(): void;
  onSurrender(): void;
  onQuit(): void;
}

export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  /** While open, every key stops here (no game hotkeys or camera keys behind the menu). */
  private readonly onKey = (e: KeyboardEvent): void => {
    e.stopImmediatePropagation();
    if (e.code !== 'Escape' && e.code !== 'KeyP' && e.code !== 'Pause') return;
    e.preventDefault();
    if (e.repeat) return;
    if (this.view !== 'main' && e.code === 'Escape') this.show('main');
    else this.o.onResume();
  };
  private view: 'main' | 'settings' | 'help' = 'main';

  constructor(
    parent: HTMLElement,
    private readonly o: PauseMenuOptions,
  ) {
    this.root = el('div', 'hud-pause');
    this.panel = el('div', 'menu-panel pause-panel panel');
    this.root.append(this.panel);
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(): void {
    if (this.isOpen) return;
    this.root.style.display = 'grid';
    this.show('main');
    window.addEventListener('keydown', this.onKey, true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.style.display = 'none';
    window.removeEventListener('keydown', this.onKey, true);
  }

  private show(view: 'main' | 'settings' | 'help'): void {
    this.view = view;
    this.panel.replaceChildren();
    const back = (): HTMLElement => {
      const row = el('div', 'menu-footer');
      row.append(menuButton('Back', () => this.show('main')));
      return row;
    };
    if (view === 'settings') {
      this.panel.append(
        el('div', 'menu-heading', 'Settings'),
        settingsPanel(this.o.settings(), this.o.onSettings),
        back(),
      );
      return;
    }
    if (view === 'help') {
      this.panel.append(el('div', 'menu-heading', 'How to Play'), howToPlayPanel(), back());
      return;
    }
    const speed = choiceRow(
      this.o.speeds.map((s) => ({ value: s, label: formatSpeed(s) })),
      this.o.speed(),
      (v) => this.o.onSpeed(v),
    );
    this.panel.append(
      el('div', 'menu-heading', 'Paused'),
      menuButton('Resume', () => this.o.onResume(), 'Esc or P'),
      optionBlock('Game speed', speed.element),
      menuButton('Settings', () => this.show('settings')),
      menuButton('How to Play', () => this.show('help')),
      menuButton('Restart', () => this.o.onRestart(), 'Same map and settings'),
      this.confirmButton('Surrender', 'Really surrender?', () => this.o.onSurrender()),
      this.confirmButton('Quit to menu', 'Really quit? The match is lost.', () => this.o.onQuit()),
    );
  }

  /** A button that asks once ("Really …?") before it acts. */
  private confirmButton(label: string, ask: string, act: () => void): HTMLButtonElement {
    let armed = false;
    const b = menuButton(label, () => {
      if (armed) {
        act();
        return;
      }
      armed = true;
      b.classList.add('danger');
      const text = b.querySelector('.menu-btn-label');
      if (text) text.textContent = ask;
    });
    return b;
  }
}

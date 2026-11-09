/**
 * Main Menu and Match Setup (docs/plans/m7-menus-art-maps.md §2.1–2.2), plus Settings and How to
 * Play. DOM screens in the HUD's pixel style. The host passes the choices (maps, opponents, paces)
 * and gets the chosen MatchSetup back through `onStart`.
 */
import { formatSpeed, type DecodedMap, type MatchSetup } from '../../shared';
import { Minimap } from '../hud/Minimap';
import type { Settings } from '../settings';
import { howToPlayPanel } from './HowToPlay';
import { choiceRow, el, menuButton, optionBlock } from './menuKit';
import { settingsPanel } from './SettingsPanel';

export interface MenuChoice {
  id: string;
  name: string;
  description: string;
  /** A short extra shown next to the name, e.g. "12-20 min" for a pace. */
  detail?: string;
}

export interface MapChoice extends MenuChoice {
  map: DecodedMap;
  hasScenario: boolean;
}

export interface MenuData {
  maps: MapChoice[];
  opponents: MenuChoice[];
  paces: MenuChoice[];
  speeds: readonly number[];
  /** The setup the screens start with (the last one used, or the defaults). */
  setup: MatchSetup;
  /**
   * Picture shown in the green area under the main page (assets/menu/hero.webp: the `/?preview`
   * diorama taken with `/?preview&view=hero&clean`, a skirmish at the gate of a town).
   */
  heroImage?: string;
}

export interface MenuCallbacks {
  onStart(setup: MatchSetup): void;
  onSettings(settings: Settings): void;
}

type View = 'main' | 'setup' | 'settings' | 'help';

const PREVIEW_PX = 230;
const PREVIEW_FLATTEN = Math.sin((52 * Math.PI) / 180); // the in-game camera pitch

export class MainMenu {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  /** The picture in the green area (main page only). */
  private readonly hero: HTMLElement;
  private setup: MatchSetup;
  private settings: Settings;
  private readonly previews = new Map<string, HTMLCanvasElement>();

  constructor(
    container: HTMLElement,
    private readonly data: MenuData,
    settings: Settings,
    private readonly cb: MenuCallbacks,
  ) {
    this.setup = { ...data.setup };
    this.settings = { ...settings };
    this.root = el('div', 'menu');
    const title = el('div', 'menu-title');
    title.append(
      el('div', 'menu-logo', 'Banners of Dawn'),
      el('div', 'menu-tagline', 'A 1v1 strategy game against the machine'),
    );
    this.body = el('div', 'menu-body');
    this.hero = el('div', 'menu-hero');
    if (data.heroImage) {
      const img = document.createElement('img');
      img.src = data.heroImage;
      // a smaller copy (same name + -960) for small screens
      img.srcset = `${data.heroImage.replace(/\.webp$/, '-960.webp')} 960w, ${data.heroImage} 1472w`;
      img.sizes = 'min(860px, 88vw)';
      img.alt = 'Blue defenders hold the gate of their town against a red raid';
      img.draggable = false;
      this.hero.append(img);
    }
    this.root.append(title, this.body, this.hero);
    container.append(this.root);
    this.show('main');
  }

  dispose(): void {
    this.root.remove();
  }

  private show(view: View): void {
    this.body.replaceChildren();
    this.hero.style.display = view === 'main' && this.data.heroImage ? '' : 'none';
    if (view === 'main') this.mainView();
    else if (view === 'setup') this.setupView();
    else if (view === 'settings')
      this.panelView(
        'Settings',
        settingsPanel(this.settings, (s) => this.changeSettings(s)),
      );
    else this.panelView('How to Play', howToPlayPanel());
  }

  private changeSettings(s: Settings): void {
    this.settings = s;
    this.cb.onSettings(s);
  }

  // ---- views --------------------------------------------------------------------------------------

  private mainView(): void {
    const panel = el('div', 'menu-panel menu-main panel');
    panel.append(
      menuButton('Play', () => this.show('setup'), 'Choose map, opponent and pace'),
      menuButton('Quick start', () => this.cb.onStart({ ...this.setup }), this.summary(this.setup)),
      menuButton('Settings', () => this.show('settings')),
      menuButton('How to Play', () => this.show('help')),
    );
    this.body.append(panel);
  }

  private panelView(title: string, content: HTMLElement): void {
    const panel = el('div', 'menu-panel menu-page panel');
    panel.append(
      el('div', 'menu-heading', title),
      content,
      this.footer([menuButton('Back', () => this.show('main'))]),
    );
    this.body.append(panel);
  }

  private setupView(): void {
    const panel = el('div', 'menu-panel menu-setup panel');
    panel.append(el('div', 'menu-heading', 'Match Setup'));
    const columns = el('div', 'setup-columns');

    // left: maps with a preview
    const mapCol = el('div', 'setup-maps');
    const mapList = el('div', 'map-list');
    const preview = el('div', 'map-preview');
    const mapInfo = el('div', 'map-info');
    const startRow = choiceRow<MatchSetup['start']>(
      [
        {
          value: 'scenario',
          label: 'Ready-made battle',
          title: 'Built bases, gathering workers and an army each',
        },
        { value: 'standard', label: 'Standard start', title: 'A Town Hall, 3 workers and a Scout Rider' },
      ],
      this.setup.start,
      (v) => {
        this.setup.start = v;
        startHelp.textContent = this.startHelp();
      },
    );
    const startHelp = el('div', 'option-help', this.startHelp());
    const mapButtons = this.data.maps.map((m) => {
      const b = el('button', 'map-btn');
      b.type = 'button';
      b.append(el('span', 'map-name', m.name), el('span', 'map-size', m.detail ?? ''));
      b.addEventListener('click', () => {
        this.setup.map = m.id;
        refreshMap();
      });
      mapList.append(b);
      return b;
    });
    const refreshMap = (): void => {
      const m = this.mapChoice();
      this.data.maps.forEach((x, i) => mapButtons[i]?.classList.toggle('active', x.id === m.id));
      preview.replaceChildren(this.preview(m));
      mapInfo.textContent = m.description;
      // the ready-made battle needs a map scenario
      const buttons = startRow.element.querySelectorAll('button');
      const scenarioBtn = buttons[0];
      if (scenarioBtn) scenarioBtn.disabled = !m.hasScenario;
      if (!m.hasScenario && this.setup.start === 'scenario') this.setup.start = 'standard';
      startRow.set(this.setup.start);
      startHelp.textContent = this.startHelp();
    };
    mapCol.append(mapList, preview, mapInfo);

    // right: opponent, start, pace, speed
    const optCol = el('div', 'setup-options');
    const choice = (label: string, list: MenuChoice[], key: 'opponent' | 'pace'): HTMLElement => {
      const help = el('div', 'option-help');
      const describe = (): void => {
        const c = list.find((x) => x.id === this.setup[key]);
        help.textContent = c ? `${c.detail ? `${c.detail}. ` : ''}${c.description}` : '';
      };
      const row = choiceRow(
        list.map((c) => ({ value: c.id, label: c.name, title: c.description })),
        this.setup[key],
        (v) => {
          this.setup[key] = v;
          describe();
        },
      );
      describe();
      return optionBlock(label, row.element, help);
    };
    const speedRow = choiceRow(
      this.data.speeds.map((s) => ({ value: s, label: formatSpeed(s) })),
      this.setup.speed,
      (v) => (this.setup.speed = v),
    );
    optCol.append(
      choice('Opponent', this.data.opponents, 'opponent'),
      optionBlock('Start', startRow.element, startHelp),
      choice('Pace', this.data.paces, 'pace'),
      optionBlock(
        'Game speed',
        speedRow.element,
        el('div', 'option-help', 'Only how fast time runs. Change it any time in the match with + and -.'),
      ),
    );
    columns.append(mapCol, optCol);

    const start = menuButton('Start match', () => this.cb.onStart({ ...this.setup }));
    start.classList.add('primary');
    panel.append(columns, this.footer([menuButton('Back', () => this.show('main')), start]));
    this.body.append(panel);
    refreshMap();
  }

  // ---- helpers ------------------------------------------------------------------------------------

  private footer(buttons: HTMLElement[]): HTMLElement {
    const row = el('div', 'menu-footer');
    row.append(...buttons);
    return row;
  }

  private mapChoice(): MapChoice {
    return this.data.maps.find((m) => m.id === this.setup.map) ?? (this.data.maps[0] as MapChoice);
  }

  private startHelp(): string {
    return this.setup.start === 'scenario'
      ? 'Bases already built, workers gathering and an army on each side. Good for a quick fight.'
      : 'A Town Hall, 3 workers and a Scout Rider each. Build everything yourself.';
  }

  private preview(m: MapChoice): HTMLCanvasElement {
    const cached = this.previews.get(m.id);
    if (cached) return cached;
    const minimap = new Minimap(m.map, PREVIEW_PX, PREVIEW_FLATTEN);
    minimap.draw(null, []);
    this.previews.set(m.id, minimap.element);
    return minimap.element;
  }

  private summary(s: MatchSetup): string {
    const name = (list: MenuChoice[], id: string): string => list.find((c) => c.id === id)?.name ?? id;
    const map = this.data.maps.find((m) => m.id === s.map)?.name ?? s.map;
    return `${map} · ${name(this.data.opponents, s.opponent)} · ${name(this.data.paces, s.pace)} · ${formatSpeed(s.speed)}`;
  }
}

/** A full-screen "Loading …" panel; returns a function that removes it. */
export function showLoading(container: HTMLElement, text: string): () => void {
  const root = el('div', 'menu menu-loading');
  const panel = el('div', 'menu-panel panel');
  panel.append(el('div', 'menu-heading', text));
  root.append(panel);
  container.append(root);
  return () => root.remove();
}

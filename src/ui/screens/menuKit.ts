/** Small DOM helpers shared by the menu screens (pixel style: menu.css). */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A wide brass menu button. */
export function menuButton(label: string, onClick: () => void, sub?: string): HTMLButtonElement {
  const b = el('button', 'menu-btn');
  b.type = 'button';
  b.append(el('span', 'menu-btn-label', label));
  if (sub) b.append(el('span', 'menu-btn-sub', sub));
  b.addEventListener('click', onClick);
  return b;
}

export interface ChoiceOption<T> {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
}

/** A row of toggle buttons; exactly one is active. */
export function choiceRow<T>(
  options: ReadonlyArray<ChoiceOption<T>>,
  current: T,
  onPick: (value: T) => void,
): { element: HTMLElement; set(value: T): void } {
  const row = el('div', 'choice-row');
  const buttons = options.map((o) => {
    const b = el('button', 'choice-btn', o.label);
    b.type = 'button';
    if (o.title) b.title = o.title;
    b.disabled = !!o.disabled;
    b.addEventListener('click', () => {
      if (o.disabled) return;
      set(o.value);
      onPick(o.value);
    });
    row.append(b);
    return b;
  });
  const set = (value: T): void => {
    options.forEach((o, i) => buttons[i]?.classList.toggle('active', o.value === value));
  };
  set(current);
  return { element: row, set };
}

/** A labelled option: title, the choice row, and a help line under it. */
export function optionBlock(label: string, control: HTMLElement, help?: HTMLElement): HTMLElement {
  const block = el('div', 'option-block');
  block.append(el('div', 'option-label', label), control);
  if (help) block.append(help);
  return block;
}

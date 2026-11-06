/** Full-screen error message in the HUD style, for problems that stop the game from starting. */
export function showFatalError(container: HTMLElement, title: string, details: readonly string[]): void {
  const root = document.createElement('div');
  root.className = 'hud fatal';
  const panel = document.createElement('div');
  panel.className = 'fatal-panel panel';
  const heading = document.createElement('div');
  heading.className = 'info-title';
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const d of details.slice(0, 20)) {
    const li = document.createElement('li');
    li.textContent = d;
    list.append(li);
  }
  if (details.length > 20) {
    const li = document.createElement('li');
    li.textContent = `…and ${details.length - 20} more`;
    list.append(li);
  }
  panel.append(heading, list);
  root.append(panel);
  container.append(root);
  console.error(`${title}\n${details.join('\n')}`);
}

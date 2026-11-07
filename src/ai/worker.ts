/**
 * Web Worker entry for the machine player: only a message bridge (PLAN §6.1).
 * host → AI: init, observe, dispose. AI → host: commands, debug.
 */
import type { FromAIMessage, ToAIMessage } from '../shared';
import { createAIPlayer, isAIMode } from './index';

const ai = createAIPlayer();
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ToAIMessage>) => void) | null;
  postMessage: (m: FromAIMessage) => void;
  close: () => void;
};

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') ai.init(msg.info, isAIMode(msg.mode) ? msg.mode : undefined, msg.seed);
  else if (msg.type === 'observe') {
    const commands = ai.think(msg.obs);
    scope.postMessage({ type: 'commands', forTick: msg.obs.tick + ai.delayTicks, commands });
    scope.postMessage({ type: 'debug', text: ai.debugText() });
  } else if (msg.type === 'dispose') scope.close();
};

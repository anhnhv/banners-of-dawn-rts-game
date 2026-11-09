/**
 * Web Worker entry for the machine player: only a message bridge (PLAN §6.1, protocol.ts).
 * host → AI: init (with the profile to play with), observe, dispose. AI → host: commands, debug.
 * The profile is checked again here: a message is a trust boundary (later, profiles may be made by
 * players). A bad one throws, which the host reports as "Machine player crashed: …".
 */
import type { FromAIMessage, ToAIMessage } from './protocol';
import { createAIPlayer, parseAIProfile } from './index';

const ai = createAIPlayer();
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ToAIMessage>) => void) | null;
  postMessage: (m: FromAIMessage) => void;
  close: () => void;
};

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init')
    ai.init(msg.info, parseAIProfile(msg.profile, msg.profile?.name ?? 'profile'), msg.seed);
  else if (msg.type === 'observe') {
    const commands = ai.think(msg.obs);
    scope.postMessage({ type: 'commands', forTick: msg.obs.tick + ai.delayTicks, commands });
    scope.postMessage({ type: 'debug', text: ai.debugText() });
  } else if (msg.type === 'dispose') scope.close();
};

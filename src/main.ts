/**
 * Browser entry point. It wires modules together and contains no game logic.
 * From M2 on it also creates the host (engine + human controller + machine-player worker).
 */
import { startApp } from './ui';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container in index.html');

startApp(container);

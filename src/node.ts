
import WebSocket			from 'ws';
import HolochainWebsocket		from './index.js';

// @ts-ignore
global.WebSocket			= WebSocket;

export *				from './index.js';
export default HolochainWebsocket;

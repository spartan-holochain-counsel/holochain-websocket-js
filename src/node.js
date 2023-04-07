
import WebSocket			from 'ws';
import HolochainWebsocket		from './index.js';

global.WebSocket			= WebSocket;

export *				from './index.js';
export default HolochainWebsocket;

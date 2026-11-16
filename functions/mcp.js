import { handleMcp } from '../src/mcp.js';

export const onRequest = ({ request, env }) => handleMcp(request, env);

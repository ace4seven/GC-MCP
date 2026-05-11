import { GarminConnect } from 'garmin-connect';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const TOKEN_DIR = path.join(os.homedir(), '.gc-mcp');

export async function login(username: string, password: string): Promise<void> {
  const gc = new GarminConnect({ username, password });
  await gc.login();
  gc.exportTokenToFile(TOKEN_DIR);
  console.log(`✓ Tokens saved to ${TOKEN_DIR}`);
}

export function loadClient(): GarminConnect {
  const gc = new GarminConnect({ username: '', password: '' });
  try {
    gc.loadTokenByFile(TOKEN_DIR);
  } catch {
    throw new Error('Session not found. Run: npx gc-mcp login');
  }
  return gc;
}

export function isLoggedIn(): boolean {
  return (
    fs.existsSync(path.join(TOKEN_DIR, 'oauth1_token.json')) &&
    fs.existsSync(path.join(TOKEN_DIR, 'oauth2_token.json'))
  );
}

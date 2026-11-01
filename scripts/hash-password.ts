import bcrypt from 'bcryptjs';
import { readFile, writeFile } from 'node:fs/promises';
import { emitKeypressEvents } from 'node:readline';
import type { Key } from 'node:readline';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployEnvPath = path.join(root, '.env.deploy.local');

export function replaceEnvValue(contents: string, key: string, value: string): string {
  const linePattern = new RegExp(`^${key}=.*?(\\r?)$`, 'm');
  if (!linePattern.test(contents)) throw new Error(`${key} is missing from .env.deploy.local`);
  return contents.replace(
    linePattern,
    (_match, lineEnding: string) => `${key}=${value}${lineEnding}`,
  );
}

function promptHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal.'));
  }

  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.off('keypress', onKeypress);
      stdin.setRawMode(wasRaw ?? false);
      stdout.write('\n');
    };
    const onKeypress = (character: string, key: Key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Password entry canceled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (!key.ctrl) {
        value += character;
      }
    };
    stdin.on('keypress', onKeypress);
  });
}

async function main(): Promise<void> {
  const deployFileMode = process.argv[2] === '--deploy-file';
  const password = deployFileMode ? await promptHidden('New password (hidden): ') : process.argv[2];
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters.');
    if (!deployFileMode) console.error('Usage: npm run auth:hash -- --deploy-file');
    process.exitCode = 1;
    return;
  }

  if (deployFileMode) {
    const confirmation = await promptHidden('Confirm password (hidden): ');
    if (password !== confirmation) throw new Error('Passwords do not match.');
  }

  const hash = await bcrypt.hash(password, 12);
  if (deployFileMode) {
    const contents = await readFile(deployEnvPath, 'utf8');
    await writeFile(deployEnvPath, replaceEnvValue(contents, 'AUTH_PASSWORD_HASH', hash), {
      mode: 0o600,
    });
    console.log('Updated AUTH_PASSWORD_HASH in the ignored .env.deploy.local file.');
    return;
  }

  console.log('AUTH_PASSWORD_HASH=' + hash);
  console.warn('Use --deploy-file to enter passwords without echo or shell history.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}

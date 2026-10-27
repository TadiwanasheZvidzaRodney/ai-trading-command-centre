import bcrypt from 'bcryptjs';

async function main(): Promise<void> {
  const password = process.argv[2];
  if (!password || password.length < 12) {
    console.error('Usage: npm run auth:hash -- "a-strong-password-at-least-12-characters"');
    console.error('The password must be at least 12 characters. It is never stored in plaintext.');
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  console.log('');
  console.log('Add this to .env (never commit it):');
  console.log('');
  console.log(`AUTH_MODE=session`);
  console.log(`AUTH_PASSWORD_HASH=${hash}`);
  console.log('');
}

void main();

const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');

function prompts() {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este asistente en una terminal interactiva, sin -T.');
  let hidden = false;
  const output = new Writable({ write(chunk, _encoding, callback) {
    if (hidden) callback();
    else process.stdout.write(chunk, callback);
  } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  terminal.on('SIGINT', () => { terminal.close(); process.exit(130); });
  return {
    text: async (label) => (await terminal.question(`${label}: `)).trim(),
    secret: async (label) => {
      process.stdout.write(`${label}: `);
      hidden = true;
      try { return await terminal.question(''); }
      finally { hidden = false; process.stdout.write('\n'); }
    },
    close: () => terminal.close(),
  };
}

module.exports = { prompts };

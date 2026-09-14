#!/usr/bin/env node
/**
 * Arranca la web en local y abre el navegador con un solo comando.
 *
 * Uso:
 *   npm start
 *
 * Si el servidor ya estaba en marcha, no intenta arrancar otro (fallaría por
 * `strictPort`): se limita a abrir el navegador en la URL del proyecto.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Debe coincidir con `server.port` de vite.config.ts. */
const PORT = 8080;
const URL = `http://localhost:${PORT}/`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * true si ya hay algo escuchando en el puerto (servidor arrancado en otra terminal).
 * Se comprueban IPv4 e IPv6 porque Vite escucha en `localhost`, que en macOS resuelve a `::1`.
 */
async function isServerRunning(port) {
  const results = await Promise.all([canConnect(port, '127.0.0.1'), canConnect(port, '::1')]);
  return results.some(Boolean);
}

function openBrowser(url) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = isWindows ? ['', url] : [url];
  spawn(command, args, { stdio: 'ignore', detached: true, shell: isWindows }).unref();
}

if (await isServerRunning(PORT)) {
  console.log(`El servidor ya estaba en marcha. Abriendo ${URL}`);
  openBrowser(URL);
  process.exit(0);
}

console.log(`Arrancando el servidor en ${URL} ...`);

const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
const vite = spawn(viteBin, ['--open'], { cwd: ROOT, stdio: 'inherit' });

vite.on('error', (error) => {
  console.error('No se ha podido arrancar Vite. ¿Has ejecutado `npm install`?');
  console.error(error.message);
  process.exit(1);
});

vite.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});

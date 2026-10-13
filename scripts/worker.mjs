import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Starts the Python worker with the project's own virtual environment (Windows, Mac, Linux).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const py = path.join(root, 'services', 'worker', '.venv', win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python');
const child = spawn(py, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], {
  cwd: path.join(root, 'services', 'worker'),
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));

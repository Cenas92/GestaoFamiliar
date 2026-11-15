import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.CI) {
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const targetCmd = path.join(rootDir, 'scripts', 'abrir-dist.cmd');
const shortcutPath = path.join(distDir, 'Abrir Gestao Familiar.lnk');

if (!fs.existsSync(distDir) || !fs.existsSync(targetCmd)) {
  process.exit(0);
}

if (process.platform === 'win32') {
  const psScript = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${targetCmd.replace(/'/g, "''")}'
$sc.WorkingDirectory = '${rootDir.replace(/'/g, "''")}'
$sc.Description = 'Abrir e testar Gestao Familiar (servidor local para dist)'
$sc.IconLocation = '%SystemRoot%\\System32\\imageres.dll,109'
$sc.Save()
`;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], { stdio: 'inherit' });
  console.log(`Atalho criado em: ${shortcutPath}`);
}

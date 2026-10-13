/**
 * 把已构建的网页和悬浮窗拷到极空间同步目录里的成品夹。
 * 不删除 user-data。不把 node_modules 或 .git 拷进去。
 */
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.resolve(root, '..', '万象棋AI实战助手');
const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

if (!await exists(path.join(root, 'dist', 'index.html'))) {
  console.error('没有 dist/index.html。先 npm run build。');
  process.exit(1);
}

await mkdir(path.join(release, 'app', 'web'), { recursive: true });
await mkdir(path.join(release, 'app', 'windows'), { recursive: true });
await mkdir(path.join(release, 'data', 'meta'), { recursive: true });
await mkdir(path.join(release, 'user-data', 'backups'), { recursive: true });
await mkdir(path.join(release, 'docs'), { recursive: true });

await cp(path.join(root, 'dist'), path.join(release, 'app', 'web'), { recursive: true });
const selfContained = path.join(root, 'desktop', 'WxqOverlay', 'publish', 'win-x64');
const framework = path.join(root, 'desktop', 'WxqOverlay', 'bin', 'Release', 'net10.0-windows');
const win = await exists(path.join(selfContained, 'WxqOverlay.exe')) ? selfContained : framework;
if (await exists(path.join(win, 'WxqOverlay.exe'))) {
  await cp(win, path.join(release, 'app', 'windows'), { recursive: true });
  if (win === framework) {
    console.log('悬浮窗是依赖本机 .NET 10 的构建。其他电脑若没有该运行时，需要先执行 self-contained publish。');
  }
} else {
  console.log('没有找到 WxqOverlay.exe，本次只更新了网页成品。');
}
const dataFiles = ['heroes.json', 'hero-details.json', 'commanders.json', 'commander-details.json', 'equipment.json', 'equipment-details.json', 'talents.json', 'talent-details.json', 'factions.json'];
for (const name of dataFiles) {
  if (await exists(path.join(root, 'data', name))) {
    await cp(path.join(root, 'data', name), path.join(release, 'data', name));
  }
}
await cp(path.join(root, 'data', 'playbooks'), path.join(release, 'data', 'playbooks'), { recursive: true });
await cp(path.join(root, 'data', 'assistant'), path.join(release, 'data', 'assistant'), { recursive: true });
await cp(path.join(root, 'data', 'meta', '2026-10-12'), path.join(release, 'data', 'meta', '2026-10-12'), { recursive: true });
for (const name of ['VERSION', 'CHANGELOG.md', 'task.md', 'README.md']) {
  if (await exists(path.join(root, name))) await cp(path.join(root, name), path.join(release, name));
}
await cp(path.join(root, 'docs', '使用说明.md'), path.join(release, 'docs', '使用说明.md'));
await cp(path.join(root, 'docs', '使用说明.md'), path.join(release, 'README.md'));
await writeFile(path.join(release, 'VERSION'), `${version}\n`);
await writeFile(path.join(release, '启动悬浮窗.bat'), `@echo off\r\nstart "" "%~dp0app\\windows\\WxqOverlay.exe"\r\n`);
console.log(`已更新 ${release} ，版本 ${version}`);

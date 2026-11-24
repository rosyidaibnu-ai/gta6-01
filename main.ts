// Tanjung Kaca — a make.fun gta6-01 entry (Node 22, standard library only). The
// game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library and no network
// request). This program hands it in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The game itself is an open-world crime game in a sun-soaked coastal city:
// walk and drive, steal cars, outrun the police, fight, and play eight story
// missions with a HUD, a minimap, sound and saves. Put 3 or 4 PNG or JPEG
// screenshots of it in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory tree, refusing anything that is not a plain file or folder. */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else if (entry.isFile()) cpSync(source, target);
  }
}

function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return count;
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) copyTree(join(here, 'screenshots'), join(out, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const gameFiles = countFiles(join(out, 'game'));
const shotFiles = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots')).filter((name) => statSync(join(out, 'screenshots', name)).isFile()).length
  : 0;
if (gameFiles > 993 || shotFiles > 4) {
  throw new Error(`entry too large: ${gameFiles} game files, ${shotFiles} screenshots`);
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// A one-line receipt for the run, so a local check shows what was handed in.
console.log(`Tanjung Kaca: ${gameFiles} game files, ${shotFiles} screenshots -> ${out}/dossier.json`);

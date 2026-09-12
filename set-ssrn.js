/* ===========================================================================
   set-ssrn.js — fill in the SSRN link once the working paper is posted

   Run:  node set-ssrn.js https://papers.ssrn.com/sol3/papers.cfm?abstract_id=NNNNNNN
         node set-ssrn.js --check          (report where the placeholder still is)

   The citation appears in thirteen places: ten module footers, index.html,
   README.md and LICENSE.md. Editing them by hand is how three of them ended up
   in three different formats, which is what this script exists to prevent.

   It only ever replaces the placeholder text, so running it twice is harmless
   and running it with a new link updates a previous one.
   =========================================================================== */

const fs = require('fs');
const path = require('path');

const PLACEHOLDER_HTML = '[article link to follow]';
const PLACEHOLDER_MD = '*[article link to follow]*';

function targets() {
  const out = ['index.html', 'README.md', 'LICENSE.md'];
  for (const f of fs.readdirSync(path.join(__dirname, 'modules'))) {
    if (f.endsWith('.html')) out.push(path.join('modules', f));
  }
  return out;
}

const arg = process.argv[2];

if (!arg || arg === '--help' || arg === '-h') {
  console.log('usage: node set-ssrn.js <url>');
  console.log('       node set-ssrn.js --check');
  process.exit(arg ? 0 : 1);
}

if (arg === '--check') {
  let n = 0;
  for (const rel of targets()) {
    const s = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    const hits = (s.match(/\[article link to follow\]/g) || []).length;
    if (hits) { console.log(`  ${rel}: ${hits} placeholder${hits > 1 ? 's' : ''}`); n += hits; }
  }
  console.log(n ? `\n${n} placeholder(s) still to fill.` : '\nno placeholders left.');
  process.exit(0);
}

if (!/^https?:\/\//.test(arg)) {
  console.error('the link must start with http:// or https://');
  process.exit(1);
}

let changed = 0;
for (const rel of targets()) {
  const p = path.join(__dirname, rel);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  if (rel.endsWith('.md')) {
    // markdown: the placeholder is italicised, the link is not
    s = s.split(PLACEHOLDER_MD).join(`<${arg}>`);
  } else {
    // html: the placeholder sits inside <span class="k">SSRN: ...</span>
    s = s.split(PLACEHOLDER_HTML).join(`<a href="${arg}">${arg}</a>`);
  }
  if (s !== before) { fs.writeFileSync(p, s); changed++; console.log('  updated ' + rel); }
}
console.log(`\n${changed} file(s) updated.`);
console.log('Now re-run the harnesses: the footers are not checked by them, but the');
console.log('tag-balance check is worth running after any edit that touches markup.');

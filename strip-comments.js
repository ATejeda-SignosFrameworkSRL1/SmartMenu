// Eliminador de comentarios.
//
// JS/TS/TSX: usa el PARSER real de TypeScript. No se usa regex para localizar:
//   destruiria URLs con //, literales de regex y texto JSX.
// C#: maquina de estados consciente de cadenas ("...", @"...", '...').
//
// Preserva los comentarios FUNCIONALES (@ts-expect-error, eslint-disable,
// #pragma, /// <reference...): son instrucciones al compilador o al linter, no
// documentacion, y borrarlos rompe el build.
//
// RED DE SEGURIDAD: cada archivo se RE-PARSEA despues de transformarlo y solo
// se escribe si no aparecen errores de sintaxis nuevos. Un intento anterior se
// comio las llaves de bloques cuyo unico contenido era un comentario
// (`catch { /* x */ }` -> `catch`), asi que ahora los `{/* */}` de JSX se
// eliminan por NODO del AST (JsxExpression sin expresion), nunca por texto.
const fs = require('fs');
const path = require('path');
const ts = require(path.join(__dirname, 'src/frontend/node_modules/typescript'));

const DRY = process.argv.includes('--dry');
const BS = String.fromCharCode(92);
const SKIP = new Set(['node_modules', '.next', 'out', 'obj', 'bin', '.git', 'dist', 'build', '.turbo', 'coverage']);
const KEEP = /@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|eslint-enable|prettier-ignore|istanbul ignore|biome-ignore|noinspection|NOSONAR|<reference|#pragma|webpackChunkName|@jsx|@license|@preserve|@type|@typedef|@satisfies|@template|@enum|@callback/;

// JSDoc con tags de TIPO en archivos .js: no es documentacion, es la unica
// forma de tipar ese archivo (TypeScript los lee con allowJs/checkJs). Quitar
// un `/** @type {Partial<Config>} */` del preset del design system rompio el
// type-check de las 3 apps que lo consumen. En .ts/.tsx los tipos van en el
// codigo, asi que ahi el JSDoc si es prescindible.
const JSDOC_TYPE = /@(type|typedef|satisfies|template|param|returns|callback|extends|implements|enum)/;

function keep(txt, file) {
  if (KEEP.test(txt) || txt.startsWith('/*!')) return true;
  if (/\.(js|mjs|cjs)$/.test(file || '') && txt.startsWith('/**') && JSDOC_TYPE.test(txt)) return true;
  return false;
}

function kindOf(file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.ts$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parse(text, file) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kindOf(file));
}

function syntaxErrors(sf) {
  const d = sf.parseDiagnostics || [];
  return d.length;
}

function stripTsLike(text, file) {
  const sf = parse(text, file);
  const before = syntaxErrors(sf);

  const cuts = [];
  let kept = 0;

  // 1) {/* ... */} de JSX -> se quita el NODO completo, con sus llaves.
  //    Detectarlo por AST y no por texto es lo que evita comerse las llaves de
  //    un bloque real cuyo unico contenido sea un comentario.
  (function visitJsx(node) {
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
      cuts.push([node.getStart(sf), node.getEnd()]);
    }
    node.forEachChild(visitJsx);
  })(sf);

  // 2) El resto de comentarios: solo su propio rango, sin tocar nada alrededor.
  const ranges = new Map();
  const add = (r) => { if (r) for (const x of r) ranges.set(x.pos + ':' + x.end, x); };
  (function visit(node) {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const ch of node.getChildren(sf)) visit(ch);
  })(sf);
  for (const r of ranges.values()) {
    if (keep(text.slice(r.pos, r.end), file)) { kept++; continue; }
    cuts.push([r.pos, r.end]);
  }

  const merged = mergeCuts(cuts);
  let out = '', pos = 0;
  for (const [s, e] of merged) { out += text.slice(pos, s); pos = e; }
  out += text.slice(pos);
  out = tidy(out);

  const after = syntaxErrors(parse(out, file));
  return { out, kept, removed: merged.length, safe: after <= before, before, after };
}

function mergeCuts(cuts) {
  cuts.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1]);
    else merged.push([c[0], c[1]]);
  }
  return merged;
}

// Balance de delimitadores: si cambia, la transformacion toco codigo y no solo
// comentarios. Es la comprobacion equivalente al re-parseo, para C#.
function balance(s) {
  let a = 0, b = 0, c = 0;
  for (const ch of s) {
    if (ch === '{') a++; else if (ch === '}') a--;
    else if (ch === '(') b++; else if (ch === ')') b--;
    else if (ch === '[') c++; else if (ch === ']') c--;
  }
  return a + ':' + b + ':' + c;
}

function stripCs(text) {
  let out = '', i = 0, kept = 0, removed = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i], c2 = text[i + 1];
    if (c === '@' && c2 === '"') {
      out += c + c2; i += 2;
      while (i < n) {
        if (text[i] === '"' && text[i + 1] === '"') { out += '""'; i += 2; continue; }
        out += text[i];
        if (text[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      out += c; i++;
      while (i < n) {
        if (text[i] === BS) { out += text[i] + (text[i + 1] || ''); i += 2; continue; }
        out += text[i];
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '/' && c2 === '/') {
      let j = i; while (j < n && text[j] !== '\n') j++;
      const seg = text.slice(i, j);
      if (keep(seg, '.cs')) { out += seg; kept++; } else removed++;
      i = j; continue;
    }
    if (c === '/' && c2 === '*') {
      let j = text.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      const seg = text.slice(i, j);
      if (keep(seg, '.cs')) { out += seg; kept++; } else removed++;
      i = j; continue;
    }
    out += c; i++;
  }
  out = tidy(out);
  return { out, kept, removed, safe: balance(out) === balance(text) };
}

function tidy(s) {
  const lines = s.replace(/[ \t]+(?=\r?$)/gm, '').split('\n');
  const res = [];
  for (const l of lines) {
    if (l.trim() === '' && res.length && res[res.length - 1].trim() === '') continue;
    res.push(l);
  }
  return res.join('\n');
}

const roots = ['src/frontend', 'src/backend'];
const tot = { files: 0, changed: 0, removed: 0, kept: 0, unsafe: [], errors: [] };
for (const root of roots) {
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); continue; }
      const p = path.join(dir, e.name);
      const ext = path.extname(e.name);
      const isJs = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
      const isCs = ext === '.cs';
      if (!isJs && !isCs) continue;
      tot.files++;
      let text;
      try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
      let res;
      try { res = isJs ? stripTsLike(text, p) : stripCs(text); }
      catch (err) { tot.errors.push(p + ' :: ' + err.message); continue; }
      if (!res.safe) { tot.unsafe.push(p + (res.after !== undefined ? ` (errores ${res.before} -> ${res.after})` : ' (delimitadores desbalanceados)')); continue; }
      tot.removed += res.removed;
      tot.kept += res.kept;
      if (res.out !== text) { tot.changed++; if (!DRY) fs.writeFileSync(p, res.out, 'utf8'); }
    }
  })(root);
}
console.log(DRY ? '=== PRUEBA EN SECO (no se escribio nada) ===' : '=== APLICADO ===');
console.log('  archivos analizados     :', tot.files);
console.log('  archivos que cambian    :', tot.changed);
console.log('  comentarios eliminados  :', tot.removed);
console.log('  funcionales PRESERVADOS :', tot.kept);
console.log('  OMITIDOS por seguridad  :', tot.unsafe.length);
tot.unsafe.slice(0, 10).forEach((u) => console.log('     ', u));
if (tot.errors.length) {
  console.log('  ERRORES:', tot.errors.length);
  tot.errors.slice(0, 5).forEach((e) => console.log('     ', e));
}

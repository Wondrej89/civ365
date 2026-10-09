import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const check = process.argv.includes('--check');
const messages = new Set();
const events = new Set();
const violations = [];
const contentFields = new Set([
  'name',
  'description',
  'effectText',
  'subtitle',
  'text',
  'title',
  'branch',
  'reward',
  'productionLabel',
]);
const brand = new Set([
  'Civilization',
  '.xlsx',
  'CIVILIZATION.XLSX',
  'C',
  'A1',
  'ƒx',
]);
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(file);
    } else if (/\.tsx?$/.test(file)) scan(file);
  }
}
function scan(file) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const add = (node) => {
    if (
      node &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text
    )
      messages.add(node.text);
  };
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : '';
      if (name === 'translate') add(node.arguments[1]);
      if (
        ['tr', 'message', 'eventMessage', 'setMessage', 'setError'].includes(
          name,
        )
      )
        add(node.arguments[0]);
      if (
        ['message', 'eventMessage'].includes(name) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        events.add(node.arguments[0].text);
        if (node.arguments[1]) {
          const parameters = (value) => {
            if (ts.isStringLiteral(value)) add(value);
            ts.forEachChild(value, parameters);
          };
          parameters(node.arguments[1]);
        }
      }
      if (name === 'logEvent') add(node.arguments[1]);
      if (name === 'chapter') {
        add(node.arguments[1]);
        add(node.arguments[2]);
      }
    }
    if (ts.isNewExpression(node) && node.expression.getText(ast) === 'Error')
      add(node.arguments?.[0]);
    if (
      ts.isPropertyAssignment(node) &&
      contentFields.has(node.name.getText(ast).replace(/['"]/g, ''))
    )
      add(node.initializer);
    if (ts.isArrayLiteralExpression(node)) add(node.elements[0]);
    // Static status/reason strings returned by game helpers also reach the UI.
    if (
      ts.isStringLiteral(node) &&
      /^[A-Z][a-z]+(?:$|[ .:])/.test(node.text) &&
      !node.text.includes('/') &&
      !node.text.includes('\n')
    )
      add(node);
    if (
      ts.isJsxText(node) &&
      /[A-Za-z]/.test(node.text) &&
      !brand.has(node.text.trim())
    )
      violations.push(
        `${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: wrap visible text in tr()`,
      );
    if (
      ts.isJsxAttribute(node) &&
      ['title', 'aria-label', 'placeholder', 'alt'].includes(
        node.name.getText(ast),
      ) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      violations.push(`${file}: localize ${node.name.getText(ast)}`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
walk('src');
for (const key of brand) messages.delete(key);
const english = Object.fromEntries(
  [...messages].sort().map((key) => [key, key]),
);
const enPath = 'src/i18n/locales/en.json';
const eventPath = 'src/i18n/event-templates.json';
const eventTemplates = [...events].sort();
const cs = JSON.parse(readFileSync('src/i18n/locales/cs.json', 'utf8'));
const placeholders = (text) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))]
    .sort()
    .join(',');
for (const [key, value] of Object.entries(cs)) {
  if (!Object.hasOwn(english, key))
    violations.push(`Unknown Czech message: ${key}`);
  if (typeof value !== 'string' || placeholders(key) !== placeholders(value))
    violations.push(`Mismatched Czech placeholders: ${key}`);
}
if (
  check &&
  JSON.stringify(JSON.parse(readFileSync(enPath, 'utf8'))) !==
    JSON.stringify(english)
)
  violations.push('English catalog is stale; run npm run i18n:extract');
if (
  check &&
  JSON.stringify(JSON.parse(readFileSync(eventPath, 'utf8'))) !==
    JSON.stringify(eventTemplates)
)
  violations.push('Event templates are stale; run npm run i18n:extract');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else if (!check) {
  writeFileSync(enPath, JSON.stringify(english, null, 2) + '\n');
  writeFileSync(eventPath, JSON.stringify(eventTemplates, null, 2) + '\n');
}
console.log(
  `${messages.size} English messages; ${Object.keys(cs).length} Czech placeholders checked.`,
);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('./src/index.css');
const layout = read('./src/components/Layout.tsx');
const ui = read('./src/components/ui/index.tsx');
const map = read('./src/pages/MapHome.tsx');

for (const token of ['--surface:', '--surface-raised:', '--border:', '--accent:', '--text-muted:']) {
  assert.ok(css.includes(token), `missing visual token ${token}`);
}
for (const behavior of ['to="/"', 'to="/kegiatan"', 'to="/proyek"', "logout();", "navigate('/login')"]) {
  assert.ok(layout.includes(behavior), `layout behavior changed: ${behavior}`);
}
for (const icon of ['Waypoints', 'LayoutDashboard', 'Users', 'Tags', 'TicketCheck', 'MapPinHouse', 'Database', 'ArrowUpDown', 'ScrollText']) {
  assert.ok(layout.includes(icon), `navigation icon missing: ${icon}`);
}
for (const layoutRule of ['w-56', 'lg:flex', 'min-w-0', 'overflow-y-auto', 'w-72']) {
  assert.ok(layout.includes(layoutRule), `layout sizing rule missing: ${layoutRule}`);
}
assert.ok(read('./src/pages/Login.tsx').includes('Masuk dengan akun yang dibuat admin'), 'login copy changed');
for (const primitive of ['export function Button', 'export function Input', 'export function Select', 'export function Modal']) {
  assert.ok(ui.includes(primitive), `missing UI primitive: ${primitive}`);
}
for (const mapControl of ['setBasemap(key)', 'setPanelOpen', 'goBackRegion', 'setLocateRequest']) {
  assert.ok(map.includes(mapControl), `map control changed: ${mapControl}`);
}

const sharedUi = read('./src/components/ui/index.tsx');
for (const primitive of ['PageHeader', 'TableShell', 'IconButton', 'StatusBadge', 'ErrorState']) {
  assert.ok(sharedUi.includes(`function ${primitive}`), `shared primitive missing: ${primitive}`);
}
for (const dialogRule of ['role="dialog"', 'aria-modal="true"', "e.key === 'Escape'", 'aria-labelledby']) {
  assert.ok(sharedUi.includes(dialogRule), `dialog accessibility missing: ${dialogRule}`);
}
assert.ok(sharedUi.includes('}, [open]);'), 'modal focus must not be reset on every form render');
assert.ok(sharedUi.includes("querySelector<HTMLElement>('input, select, textarea')"), 'modal must focus a form field before action buttons');
const stylesheet = read('./src/index.css');
for (const unsafeOverride of ['.bg-white {', '.shadow-sm {', '.shadow-md {']) {
  assert.ok(!stylesheet.includes(unsafeOverride), `global utility override remains: ${unsafeOverride}`);
}
console.log('design contract: ok');

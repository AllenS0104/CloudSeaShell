const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const schema = require('../shared/bridge/bridge.schema.json');

function readActionsFromSource() {
  const source = fs.readFileSync(path.join(repoRoot, 'shared', 'bridge', 'bridge.actions.ts'), 'utf8');
  const actionsBlock = source.match(/export const ACTIONS = \{([\s\S]*?)\} as const;/)[1];
  return [...actionsBlock.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);
}

test('bridge schema declares the current protocol version', () => {
  expect(schema.properties.protocolVersion.const).toBe('1.0.0');
  expect(schema.required).toContain('protocolVersion');
});

test('bridge schema covers all exported bridge actions', () => {
  const schemaActions = Object.keys(schema.properties.actions.properties).sort();
  const exportedActions = readActionsFromSource().sort();

  expect(schemaActions).toEqual(exportedActions);
});

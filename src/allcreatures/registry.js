// Name-to-model lookup.
//   buildCreature('Appa')                      -> a roster creature by name
//   buildCreature(firestoreCreatureObject)     -> any creature, assembled from its own traits
import * as tuskHeron from './species/tuskHeron.js';
import { buildHybrid } from './species/hybrid/build.js';
import { ROSTER } from './roster.js';

export const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const HAND_BUILT = { [tuskHeron.meta.id]: tuskHeron };          // one-off creatures sculpted by hand
const byId = Object.fromEntries(ROSTER.map((r) => [slug(r.name), { ...r, id: slug(r.name) }]));

/** Everything that can be shown, for menus and galleries. */
export const creatureList = [
  { id: tuskHeron.meta.id, name: tuskHeron.meta.name, habitat: tuskHeron.meta.habitat },
  ...Object.values(byId).map((r) => ({
    id: r.id,
    name: r.name,
    period: r.period,
    animals: r.animals,
    adaptation: r.adaptation,
    strategy: r.strategy,
  })),
];

export function hasCreature(speciesName) { const k = slug(speciesName); return k in HAND_BUILT || k in byId; }

/**
 * Accepts a name/id, or a creature object. An object may carry
 * { speciesName | name, animals: [body, head, legs], adaptation, strategy }; if it has animals it is assembled
 * from them directly, so new creatures in the database need no code changes.
 * Returns a THREE.Group, or null if there is nothing to build from.
 */
export function buildCreature(input) {
  const obj = input && typeof input === 'object' ? input : null;
  const key = slug(obj ? obj.speciesName || obj.name : input);
  if (HAND_BUILT[key]) return HAND_BUILT[key].build();
  if (obj && Array.isArray(obj.animals) && obj.animals.length) return buildHybrid({ id: key, name: obj.speciesName || obj.name, animals: obj.animals, adaptation: obj.adaptation, strategy: obj.strategy || obj.archetype });
  return byId[key] ? buildHybrid(byId[key]) : null;
}

// One entry per creature. To add a creature: write species/<name>.js with build() and meta, then list it here.
import * as tuskHeron from './species/tuskHeron.js';

const SPECIES = [tuskHeron];

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byId = Object.fromEntries(SPECIES.map((s) => [s.meta.id, s]));

/** Accepts an id ("tusk-heron") or a Firestore speciesName ("Tusk Heron"). */
export function hasCreature(speciesName) { return slug(speciesName) in byId; }

/** Returns a THREE.Group, or null when no detailed model exists yet (fall back to your current model). */
export function buildCreature(speciesName) {
  const s = byId[slug(speciesName)];
  return s ? s.build() : null;
}

export const creatureList = SPECIES.map((s) => s.meta);

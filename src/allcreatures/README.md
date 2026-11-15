# creatures3d

Detailed, code-built creature models and two environments for the battle game.
Plain Three.js modules plus thin React Three Fiber wrappers. No model files, no extra dependencies.

## Install

Copy this folder to `src/creatures3d/`. It uses `three`, `react` and `@react-three/fiber`, which the app already has.

## Use (inside your existing `<Canvas>`)

```jsx
import { Creature3D, Environment3D } from '../creatures3d/Creature3D.jsx';

<Environment3D kind={habitat} />   {/* "aquatic" or "safari" */}

<Creature3D
  speciesName={creature.speciesName}
  wading={habitat === 'aquatic'}
  scale={0.4}
  fallback={<YourCurrentProceduralModel creature={creature} />}
/>
```

- `Creature3D` looks the species up by name ("Tusk Heron" and "tusk-heron" both match). If there is no detailed
  model for that species yet, it renders `fallback`, so `CreatureModel.jsx` keeps working for everything else.
- It accepts any group props (`position`, `rotation`, `scale`). Creatures face +X, stand on y = 0 and are roughly
  5 units tall, so scale them to fit your battle scene.
- `Environment3D` adds sky, ground, props, fog and lights. Pass `lights={false}` to keep the lights
  `BattleScene.jsx` already has, and `reflections={false}` to leave `scene.environment` alone.
- Toggle habitats by changing `kind`; that is the whole toggle.
- For soft shadows, the Canvas needs `shadows`.

## Without React

```js
import { buildCreature } from './registry.js';
import { createEnvironment } from './environments/index.js';
const creature = buildCreature('tusk-heron');      // THREE.Group; call creature.userData.update(t) each frame
const env = createEnvironment('safari');           // { group, fog, update(t), setWaders(points) }
```

## How creatures are made

Every creature except the hand-built Tusk Heron is assembled from parts:

| Input | Decides | File |
|---|---|---|
| 1st animal | body shape, covering (fur, scales, feathers, hide), base colours | `species/hybrid/bodies.js` |
| 2nd animal | head and neck, plus one signature (tortoise shell, dragonfly wings) | `species/hybrid/heads.js` |
| 3rd animal | legs, feet and movement extras (cheetah tail, hare ears, horns, gills) | `species/hybrid/limbs.js` |
| power-up | Armor plates, Reserves humps, Camouflage colouring, Pack signal crest | `species/hybrid/traits.js` |
| strategy | eye size and brow only | `species/hybrid/build.js` |

Each creature's name also seeds small differences in colour and proportions, so two students with the same
three animals still get distinct creatures.

## Add or change creatures

- **From the roster:** edit `roster.js` (name, three animals, power-up, strategy). `<Creature3D speciesName="Appa" />`.
- **Straight from Firestore, no code changes:** pass the data itself.
  `<Creature3D creature={{ speciesName, animals: [body, head, legs], adaptation, strategy }} />`
  Animal names are matched loosely ("Saltwater Crocodile", "crocodile" and "croc" all work).
- **A new animal:** add an entry to `bodies.js`, `heads.js` or `limbs.js` and a keyword to `ANIMALS` in `build.js`.
  Until then an unknown animal falls back to a plain generic part rather than failing.
- **A one-off sculpt** like the heron: add `species/<name>.js` and list it under `HAND_BUILT` in `registry.js`.

## Files

- `kit.js` shared parts: feathers, tapered tubes, textures, sky, lights
- `species/tuskHeron.js` the hand-built heron; `species/hybrid/` the part library and assembler
- `roster.js` the 22 class creatures
- `environments/` `aquatic.js`, `safari.js`
- `registry.js` name-to-model lookup
- `Creature3D.jsx` React Three Fiber wrappers

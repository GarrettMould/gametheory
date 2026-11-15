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

## Add a creature

1. Create `species/<name>.js` exporting `meta` (`id`, `name`, `habitat`) and `build()` returning a `THREE.Group`.
2. Import it in `registry.js` and add it to `SPECIES`.

## Files

- `kit.js` shared parts: feathers, tapered tubes, textures, sky, lights
- `species/` one file per creature
- `environments/` `aquatic.js`, `safari.js`
- `registry.js` name-to-model lookup
- `Creature3D.jsx` React Three Fiber wrappers

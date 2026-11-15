// React Three Fiber wrappers. Use inside your existing <Canvas>.
//
//   <Environment3D kind="aquatic" />            // or "safari"
//   <Creature3D speciesName={creature.speciesName} wading scale={0.4} fallback={<YourOldModel />} />
//
import { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { buildCreature } from './registry.js';
import { createEnvironment } from './environments/index.js';
import { makeEnvMap, disposeObject } from './kit.js';

/** A detailed creature. Renders `fallback` when this species has no detailed model yet. */
export function Creature3D({ speciesName, wading = false, fallback = null, ...groupProps }) {
  const [creature, setCreature] = useState(null);

  useEffect(() => {
    const next = buildCreature(speciesName);
    setCreature(next);
    return () => {
      disposeObject(next);
      setCreature(null);
    };
  }, [speciesName]);

  useFrame(({ clock }) => creature?.userData.update?.(clock.elapsedTime));

  if (!creature) {
    return fallback ? <group {...groupProps}>{fallback}</group> : null;
  }

  const sink = wading ? -(creature.userData.wadeDepth || 0) : 0;
  return (
    <group {...groupProps}>
      <primitive object={creature} position-y={sink} />
    </group>
  );
}

/**
 * Aquatic or safari surroundings: sky, ground, props, fog and (optionally) lights.
 * Pass lights={false} to keep the lights your scene already has.
 * waders: the wadePoints of creatures standing in the water, for ripple rings.
 */
export function Environment3D({
  kind = 'aquatic',
  lights = true,
  reflections = true,
  waders,
  ...groupProps
}) {
  const { scene, gl } = useThree();
  const [env, setEnv] = useState(null);

  useEffect(() => {
    const next = createEnvironment(kind, { lights });
    setEnv(next);
    const prevFog = scene.fog;
    const prevEnv = scene.environment;
    scene.fog = next.fog;
    let envMap = null;
    if (reflections) {
      envMap = makeEnvMap(gl, next);
      scene.environment = envMap;
    }
    return () => {
      scene.fog = prevFog;
      scene.environment = prevEnv;
      envMap?.dispose();
      disposeObject(next.group);
      setEnv(null);
    };
  }, [kind, lights, reflections, scene, gl]);

  useEffect(() => {
    env?.setWaders(waders || []);
  }, [env, waders]);

  useFrame(({ clock }) => env?.update(clock.elapsedTime));

  if (!env) return null;
  return <primitive object={env.group} {...groupProps} />;
}

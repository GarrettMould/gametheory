import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { disposeObject } from '../creaturesupdate/kit.js'
import { buildCreature } from '../creaturesupdate/registry.js'
import CreatureModel from './CreatureModel.jsx'
import { toBattleCreature } from './toBattleCreature.js'

const FRAME = 1.5 // the model is scaled so its longest side is this many units

/** The creature, scaled and centred to fill the frame, turning gently from side to side. */
function Model({ creature }) {
  const turner = useRef()
  const model = useMemo(() => buildCreature(toBattleCreature(creature)), [creature])
  const fit = useMemo(() => {
    if (!model) return null
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const scale = FRAME / Math.max(size.x, size.y, size.z, 0.001)
    return { scale, offset: centre.multiplyScalar(-scale).toArray() }
  }, [model])

  useEffect(() => () => disposeObject(model), [model])

  useFrame(({ clock }) => {
    // Models face +X; this shows a three-quarter view that drifts a little either way.
    if (turner.current) {
      turner.current.rotation.y = -0.75 + Math.sin(clock.elapsedTime * 0.5) * 0.45
    }
  })

  return (
    <group ref={turner}>
      {model ? (
        <group position={fit.offset} scale={fit.scale}>
          <primitive object={model} />
        </group>
      ) : (
        // No detailed model for this creature: the simple stand-in, roughly centred.
        <group position={[0, -0.62, 0]} scale={0.5}>
          <CreatureModel creature={creature} side="left" />
        </group>
      )}
    </group>
  )
}

/** A small live picture of a creature, for the sidebar. */
export default function CreaturePortrait({ creature }) {
  const camera = useMemo(() => ({ position: [0, 0.35, 3.3], fov: 30 }), [])
  return (
    <div className="creature-portrait" aria-hidden="true">
      <Canvas camera={camera} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={[0xdfeaf5, 0x8a7446, 1.6]} />
        <directionalLight position={[3, 5, 4]} intensity={3.2} color={0xfff0d6} />
        <directionalLight position={[-4, 2, -3]} intensity={0.9} color={0xbfd6ff} />
        <Model key={creature.id} creature={creature} />
      </Canvas>
    </div>
  )
}

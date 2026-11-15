import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { buildLook } from './creatureCatalog.js'

function hashSeed(text) {
  let value = 0
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0
  }
  return value || 1
}

export default function CreatureModel({
  creature,
  side = 'left',
  position = [0, 0, 0],
}) {
  const root = useRef()
  const torso = useRef()
  const head = useRef()
  const look = useMemo(() => buildLook(creature), [creature])
  const seed = useMemo(
    () => hashSeed(creature.id || creature.speciesName || 'creature'),
    [creature],
  )
  const facing = side === 'left' ? 1 : -1
  const kinds = look.traits.map((item) => item.kind)
  const hasArmor = creature.adaptation === 'armor'
  const hasReserves = creature.adaptation === 'reserves'
  const hasPack = creature.adaptation === 'pack'
  const hasCamo = creature.adaptation === 'camouflage'
  const hasWings = kinds.some((kind) => kind === 'wing')
  const hasHorns = kinds.some((kind) => kind === 'horn' || kind === 'antler')
  const hasShell = kinds.some((kind) => kind === 'shell')
  const reptile = kinds.some((kind) => kind === 'reptile' || kind === 'serpent')

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const breathe = Math.sin(t * (1.1 + look.agility * 0.08) + seed) * 0.035
    const sway = Math.sin(t * 0.7 + seed * 0.01) * 0.04
    const glance = Math.sin(t * 0.45 + seed * 0.02) * 0.12

    if (root.current) {
      root.current.position.y = position[1] + Math.abs(breathe) * 0.15
      root.current.rotation.y = (facing === 1 ? Math.PI / 2 : -Math.PI / 2) + sway
    }
    if (torso.current) {
      torso.current.scale.y = 1 + breathe
      torso.current.scale.z = 1 + breathe * 0.4
    }
    if (head.current) {
      head.current.rotation.y = glance
      head.current.rotation.x = Math.sin(t * 0.9 + seed) * 0.05
    }
  })

  const bodyColor = hasCamo ? mixHex(look.coat, '#6f7358', 0.35) : look.coat
  const bellyColor = mixHex(look.accent, '#f3ebe0', 0.25)
  const plateColor = '#8a8376'
  const scale = look.scale
  const legH = look.legLength
  const deep = look.torsoDepth

  return (
    <group ref={root} position={position} scale={scale}>
      <group position={[0, legH * 0.55, 0]}>
        <mesh ref={torso} castShadow receiveShadow>
          <capsuleGeometry args={[0.42 * deep, 0.95 + look.size * 0.05, 8, 16]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={hasCamo ? 0.95 : 0.55}
            metalness={hasArmor ? 0.18 : 0.05}
          />
        </mesh>

        <mesh position={[0, -0.05, 0.05]} scale={[0.92, 0.85, 0.9]} castShadow>
          <capsuleGeometry args={[0.34 * deep, 0.7, 6, 12]} />
          <meshStandardMaterial color={bellyColor} roughness={0.7} />
        </mesh>

        {hasReserves && (
          <mesh position={[0, 0.55, -0.05]} castShadow>
            <sphereGeometry args={[0.34 + look.efficiency * 0.02, 16, 16]} />
            <meshStandardMaterial color={mixHex(look.coat, '#6b4a2a', 0.2)} roughness={0.8} />
          </mesh>
        )}

        {hasShell && (
          <mesh position={[0, 0.35, -0.15]} rotation={[0.5, 0, 0]} castShadow>
            <sphereGeometry args={[0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#5f6b4a" roughness={0.45} metalness={0.1} />
          </mesh>
        )}

        {hasArmor &&
          [-0.28, 0, 0.28].map((z, index) => (
            <mesh
              key={`plate-${index}`}
              position={[0.02, 0.22 - index * 0.08, z]}
              rotation={[0.2, 0, 0.1]}
              castShadow
            >
              <boxGeometry args={[0.55, 0.12, 0.34]} />
              <meshStandardMaterial color={plateColor} roughness={0.35} metalness={0.35} />
            </mesh>
          ))}

        {hasPack && (
          <mesh position={[0, 0.55, 0.38]} castShadow>
            <torusGeometry args={[0.16, 0.035, 8, 20]} />
            <meshStandardMaterial color={look.accent} emissive={look.accent} emissiveIntensity={0.15} />
          </mesh>
        )}

        <group ref={head} position={[0, 0.55, 0.72]}>
          <mesh castShadow>
            <sphereGeometry args={[0.34 + (reptile ? 0.04 : 0), 16, 16]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.02, 0.28]} castShadow>
            <coneGeometry args={[0.16, 0.34, 10]} />
            <meshStandardMaterial color={mixHex(bodyColor, '#2a221c', 0.2)} />
          </mesh>
          <mesh position={[0.14, 0.1, 0.22]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={look.eye} emissive={look.eye} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.14, 0.1, 0.22]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={look.eye} emissive={look.eye} emissiveIntensity={0.2} />
          </mesh>
          {hasHorns && (
            <>
              <mesh position={[0.18, 0.28, 0]} rotation={[0.2, 0, 0.4]} castShadow>
                <coneGeometry args={[0.05, 0.42, 8]} />
                <meshStandardMaterial color="#d9d0c3" />
              </mesh>
              <mesh position={[-0.18, 0.28, 0]} rotation={[0.2, 0, -0.4]} castShadow>
                <coneGeometry args={[0.05, 0.42, 8]} />
                <meshStandardMaterial color="#d9d0c3" />
              </mesh>
            </>
          )}
          {hasWings && (
            <>
              <mesh position={[0.45, 0.1, -0.1]} rotation={[0.2, 0, -0.5]} castShadow>
                <boxGeometry args={[0.7, 0.08, 0.35]} />
                <meshStandardMaterial color={look.accent} transparent opacity={0.85} />
              </mesh>
              <mesh position={[-0.45, 0.1, -0.1]} rotation={[0.2, 0, 0.5]} castShadow>
                <boxGeometry args={[0.7, 0.08, 0.35]} />
                <meshStandardMaterial color={look.accent} transparent opacity={0.85} />
              </mesh>
            </>
          )}
        </group>

        <mesh position={[0, 0.15, -0.78]} rotation={[0.4, 0, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.55 + look.agility * 0.04, 4, 8]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>

        {[
          [0.28, -legH * 0.55, 0.28],
          [-0.28, -legH * 0.55, 0.28],
          [0.3, -legH * 0.55, -0.28],
          [-0.3, -legH * 0.55, -0.28],
        ].map((pos, index) => (
          <group key={`leg-${index}`} position={pos}>
            <mesh castShadow>
              <capsuleGeometry args={[0.09, legH * 0.55, 4, 8]} />
              <meshStandardMaterial color={mixHex(bodyColor, '#1c1915', 0.15)} />
            </mesh>
            <mesh position={[0, -legH * 0.4, 0.04]} castShadow>
              <boxGeometry args={[0.16, 0.08, 0.24]} />
              <meshStandardMaterial color="#2a241e" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function mixHex(a, b, amount) {
  const parse = (hex) => {
    const value = hex.replace('#', '')
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ]
  }
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const mix = (x, y) => Math.round(x + (y - x) * amount)
  return `#${[mix(ar, br), mix(ag, bg), mix(ab, bb)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

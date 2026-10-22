import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// A 4 × 3 grid of seats on the opportunity board; 10 of 12 get filled.
const SEATS = Array.from({ length: 12 }, (_, i) => ({ x: -1.35 + (i % 4) * 0.9, y: 0.45 - Math.floor(i / 4) * 0.75 }))
const FILLED = 10
// Illustrative bar lengths for the animation only — not real data.
const HOURS = [3, 2.5, 4, 2, 3.5, 3, 2, 4, 2.5, 3]
const rowY = (i) => 1.62 - i * 0.36

// Camera framing for each stage: 0 hero, 1 publish, 2 register, 3 roster, 4 record, 5 verify.
const CAMERA = [
  { pos: [2.6, 1.5, 10.2], look: [0, 0, 0] },
  { pos: [0, 0.4, 8.6], look: [0, 0, 0] },
  { pos: [0, 0.1, 7.6], look: [0, -0.15, 0] },
  { pos: [1.2, 0.2, 8.6], look: [1.5, 0, 0] },
  { pos: [2.1, 0.1, 7.8], look: [2.3, 0, 0] },
  { pos: [2.3, 0.7, 9.6], look: [2.4, 0.25, 0] },
]

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const ease = (t) => t * t * (3 - 2 * t)
const segment = (s, start, end) => ease(clamp01((s - start) / (end - start)))
const lerp = THREE.MathUtils.lerp

function Shift({ stageRef, palette, reducedMotion }) {
  const group = useRef()
  const board = useRef()
  const header = useRef()
  const tokens = useRef([])
  const rows = useRef([])
  const bars = useRef([])
  const ring = useRef()
  const badge = useRef()
  const lookAt = useRef(new THREE.Vector3())
  const { camera, size, pointer } = useThree()

  const geometry = useMemo(() => ({
    board: new RoundedBoxGeometry(4.4, 3.1, 0.18, 4, 0.12),
    header: new RoundedBoxGeometry(4.4, 0.5, 0.06, 3, 0.03),
    date: new RoundedBoxGeometry(0.62, 0.62, 0.14, 3, 0.08),
    bar: new RoundedBoxGeometry(1, 0.2, 0.08, 2, 0.04),
    checkStroke: new RoundedBoxGeometry(1, 0.12, 0.06, 2, 0.03),
    seat: new THREE.CylinderGeometry(0.27, 0.27, 0.04, 40),
    token: new THREE.SphereGeometry(0.22, 32, 24),
    ring: new THREE.TorusGeometry(1.75, 0.022, 12, 96),
    disc: new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48),
  }), [])

  const colors = useMemo(() => ({
    line: new THREE.Color(palette.line),
    brand: new THREE.Color(palette.brand),
    info: new THREE.Color(palette.info),
    success: new THREE.Color(palette.success),
  }), [palette])

  useFrame((state, delta) => {
    const s = stageRef.current
    const publish = segment(s, 0, 1)
    const register = segment(s, 1, 2)
    const roster = segment(s, 2, 3)
    const record = segment(s, 3, 4)
    const verify = segment(s, 4, 5)
    // Damping smooths scroll jumps; reduced motion snaps straight to the scroll position.
    const k = reducedMotion ? 1e6 : 7
    const damp = (from, to) => THREE.MathUtils.damp(from, to, k, delta)

    // Camera: interpolate between stage framings, pushed back on narrow (portrait) canvases.
    const index = Math.min(Math.floor(s), CAMERA.length - 2)
    const f = ease(clamp01(s - index))
    const a = CAMERA[index]
    const b = CAMERA[index + 1]
    const distance = Math.max(1, 1.2 / (size.width / size.height))
    camera.position.set(
      damp(camera.position.x, lerp(a.pos[0], b.pos[0], f)),
      damp(camera.position.y, lerp(a.pos[1], b.pos[1], f)),
      damp(camera.position.z, lerp(a.pos[2], b.pos[2], f) * distance),
    )
    lookAt.current.set(
      damp(lookAt.current.x, lerp(a.look[0], b.look[0], f)),
      damp(lookAt.current.y, lerp(a.look[1], b.look[1], f)),
      0,
    )
    camera.lookAt(lookAt.current)

    // Whole scene: gentle float and pointer parallax, skipped for reduced motion.
    const t = state.clock.elapsedTime
    group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.05
    group.current.rotation.y = damp(group.current.rotation.y, reducedMotion ? 0 : pointer.x * 0.1)
    group.current.rotation.x = damp(group.current.rotation.x, reducedMotion ? 0 : -pointer.y * 0.05)

    // Publish: the board turns to face the viewer and its header lights up.
    board.current.rotation.x = damp(board.current.rotation.x, lerp(-0.45, 0, publish))
    board.current.rotation.y = damp(board.current.rotation.y, lerp(0.55, 0, publish) + roster * 0.6)
    board.current.position.x = damp(board.current.position.x, lerp(0, -3.3, roster))
    board.current.position.z = damp(board.current.position.z, lerp(0, -1.2, roster))
    board.current.scale.setScalar(damp(board.current.scale.x, lerp(1, 0.62, roster)))
    header.current.color.lerpColors(colors.line, colors.brand, publish)
    header.current.emissive.copy(colors.brand)
    header.current.emissiveIntensity = publish * 0.25

    for (let i = 0; i < FILLED; i++) {
      const token = tokens.current[i]
      const seat = SEATS[i]
      // Register: tokens drop into seats one after another, arcing toward the camera.
      const seated = ease(clamp01((register - i * 0.065) / 0.35))
      // Roster: tokens leave the board and line up in a column.
      const listed = ease(clamp01((roster - i * 0.045) / 0.55))
      let x = seat.x
      let y = lerp(seat.y + 3.4, seat.y, seated)
      let z = 0.34 + Math.sin(seated * Math.PI) * 0.7
      x = lerp(x, 1.15, listed)
      y = lerp(y, rowY(i), listed)
      z = lerp(z, 0.2, listed) + Math.sin(listed * Math.PI) * 0.5
      token.position.set(damp(token.position.x, x), damp(token.position.y, y), damp(token.position.z, z))
      token.scale.setScalar(damp(token.scale.x, seated * lerp(1, 0.62, listed)))
      token.visible = token.scale.x > 0.01

      const row = rows.current[i]
      row.scale.x = Math.max(listed, 0.0001)
      row.position.x = 1.42 + row.scale.x / 2
      row.visible = listed > 0.01

      // Record: an hours bar grows beside each person.
      const grown = ease(clamp01((record - i * 0.055) / 0.45))
      const bar = bars.current[i]
      const length = HOURS[i] * 0.32 * grown
      bar.scale.x = Math.max(length, 0.0001)
      bar.position.x = 2.58 + length / 2
      bar.visible = grown > 0.01

      // Verify: the ring sweeps down; rows it has passed turn green.
      const ringY = lerp(1.95, -2, verify)
      const verified = clamp01((rowY(i) - ringY) / 0.25)
      bar.material.color.lerpColors(colors.info, colors.success, verified)
    }

    ring.current.position.y = lerp(1.95, -2, verify)
    ring.current.visible = verify > 0.01 && verify < 0.99

    const done = segment(verify, 0.82, 1)
    badge.current.visible = done > 0.01
    badge.current.scale.setScalar(Math.max(done, 0.0001))
    badge.current.rotation.y = (1 - done) * Math.PI
  })

  const surface = { color: palette.surface, roughness: 0.55, metalness: 0.02 }

  return (
    <group ref={group}>
      <group ref={board}>
        <mesh geometry={geometry.board}>
          <meshStandardMaterial {...surface} />
        </mesh>
        <mesh geometry={geometry.header} position={[0, 1.3, 0.1]}>
          <meshStandardMaterial ref={header} roughness={0.5} />
        </mesh>
        <mesh geometry={geometry.date} position={[-1.7, 1.3, 0.2]}>
          <meshStandardMaterial color={palette.accent} roughness={0.45} />
        </mesh>
        {SEATS.map((seat) => (
          <mesh key={`${seat.x}${seat.y}`} geometry={geometry.seat} position={[seat.x, seat.y, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={palette.sunken} roughness={0.8} />
          </mesh>
        ))}
      </group>

      {HOURS.map((_, i) => (
        <group key={i}>
          <mesh ref={(el) => { tokens.current[i] = el }} geometry={geometry.token} scale={0.0001}>
            <meshStandardMaterial color={palette.brand} roughness={0.35} metalness={0.05} />
          </mesh>
          <mesh ref={(el) => { rows.current[i] = el }} geometry={geometry.bar} position={[1.42, rowY(i), 0.05]} scale={[0.0001, 1, 1]}>
            <meshStandardMaterial {...surface} />
          </mesh>
          <mesh ref={(el) => { bars.current[i] = el }} geometry={geometry.bar} position={[2.58, rowY(i), 0.05]} scale={[0.0001, 1, 1]}>
            <meshStandardMaterial color={palette.info} roughness={0.45} />
          </mesh>
        </group>
      ))}

      <mesh ref={ring} geometry={geometry.ring} position={[2.4, 1.95, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <meshStandardMaterial color={palette.success} emissive={palette.success} emissiveIntensity={0.6} />
      </mesh>

      <group ref={badge} position={[4.05, 1.95, 0.45]} scale={0.0001}>
        <mesh geometry={geometry.disc} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={palette.success} roughness={0.4} />
        </mesh>
        <mesh geometry={geometry.checkStroke} position={[-0.1, -0.06, 0.06]} rotation={[0, 0, -2.36]} scale={[0.26, 1, 1]}>
          <meshStandardMaterial color={palette.onSuccess} />
        </mesh>
        <mesh geometry={geometry.checkStroke} position={[0.08, 0.03, 0.06]} rotation={[0, 0, 0.9]} scale={[0.46, 1, 1]}>
          <meshStandardMaterial color={palette.onSuccess} />
        </mesh>
      </group>
    </group>
  )
}

function ShiftScene({ stageRef, palette, reducedMotion, active }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: CAMERA[0].pos, fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={palette.dark ? 0.55 : 0.85} />
      <directionalLight position={[4, 6, 8]} intensity={palette.dark ? 1.3 : 1.1} />
      <directionalLight position={[-6, -2, 4]} intensity={0.35} />
      <Shift stageRef={stageRef} palette={palette} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

export default ShiftScene

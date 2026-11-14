import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Twelve planting spots on the island; 10 of 12 get taken, like a shift with a fixed capacity.
const PLOTS = [
  [-1.5, 2.4], [2.3, 2.3], [-2.6, 1.6], [3.0, 1.2], [-1.4, 1.0], [2.0, 0.6],
  [-3.0, 0.3], [3.1, -0.2], [-1.9, -0.1], [2.1, -0.9], [-2.8, -1.1], [2.9, -1.7],
].map(([x, z]) => ({ x, z }))
const FILLED = 10
// Illustrative tree sizes for the animation only — not real data.
const HOURS = [3, 2.5, 4, 2, 3.5, 3, 2, 4, 2.5, 3]
const treeSize = (i) => 0.55 + (HOURS[i] / 4) * 0.55

const ENTRANCE = { x: 0, z: 3.6 }
const DOOR = { x: 0, z: -1.0 }
const SIGN = { x: 1.0, z: 1.6 }
const SIGN_SIDE = { x: 0.25, z: 1.9 }
const ROLL_CALL = { x: 0, z: -0.85 }
// Where a volunteer stands next to their plot, and their place in the roll-call line.
const spotOf = (i) => ({ x: PLOTS[i].x + (PLOTS[i].x < 0 ? 0.42 : -0.42), z: PLOTS[i].z + 0.25 })
const lineOf = (i) => ({ x: ((i % 5) - 2) * 0.55, z: -0.2 + Math.floor(i / 5) * 0.5 })

// Camera framing for each stage: 0 hero, 1 publish, 2 register, 3 roster, 4 record, 5 verify.
const CAMERA = [
  { pos: [7, 3.6, 11], look: [0, 0.1, 0] },
  { pos: [3.2, 2.2, 7.6], look: [0.8, 0.8, 1.2] },
  { pos: [-5.5, 5.2, 9.5], look: [0, 0.3, 0.6] },
  { pos: [-3.9, 3, 6.4], look: [0, 0.5, -0.5] },
  { pos: [7.5, 3.4, 7.5], look: [0.3, 0.6, 0] },
  { pos: [2.5, 9.5, 11], look: [0, 0.2, 0] },
]

const CLOUDS = [
  { pos: [-3.6, 3.1, -2.6], scale: 1 },
  { pos: [3.9, 3.7, -1.6], scale: 0.75 },
  { pos: [-2.4, 4.2, 1.8], scale: 0.55 },
]

// Scenery that is always there: [x, z, size].
const OLD_TREES = [[-1.1, -3.3, 1], [0.2, -3.6, 1.25], [1.5, -3.2, 0.95], [2.4, -2.7, 0.7], [-3.3, -1.9, 0.8]]
const BUSHES = [[-1.45, -1.5, 0.45], [1.8, -2.2, 0.4], [-1.3, -2.9, 0.35]]
const ROCKS = [[-3.5, -0.6, 0.22], [1.2, 3.2, 0.18], [-0.9, 3.3, 0.14], [3.55, 0.45, 0.16]]

const clamp01 = (v) => Math.min(Math.max(v, 0), 1)
const ease = (t) => t * t * (3 - 2 * t)
const segment = (s, start, end) => ease(clamp01((s - start) / (end - start)))
// Ease-out with a small overshoot, for things that pop up.
const pop = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
const lerp = THREE.MathUtils.lerp

// Natural tones derived from the theme colours, so the island follows light and dark mode.
function useTones(palette) {
  return useMemo(() => {
    const color = (value) => new THREE.Color(value)
    const hue = (value) => color(value).getHSL({}).h
    const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l)
    const dark = palette.dark
    const green = hue(palette.brand)
    const warm = hue(palette.accent)
    return {
      brand: color(palette.brand),
      accent: color(palette.accent),
      info: color(palette.info),
      success: color(palette.success),
      line: color(palette.line),
      board: color(palette.surface),
      grass: hsl(green - 0.08, 0.32, dark ? 0.27 : 0.62),
      soil: hsl(warm, 0.3, dark ? 0.27 : 0.42),
      path: color(palette.sunken).lerp(color(palette.accent), 0.15),
      trunk: hsl(warm, 0.4, 0.3),
      foliage: hsl(green - 0.04, 0.45, dark ? 0.45 : 0.34),
      foliagePending: hsl(green - 0.04, 0.14, dark ? 0.33 : 0.6),
      wall: dark ? color(palette.surface).lerp(color(palette.ink), 0.3) : color(palette.surface),
      head: hsl(warm, 0.35, 0.72),
      neutral: color(palette.surface).lerp(color(palette.ink), 0.5),
      cloud: dark ? color(palette.surface).lerp(color(palette.ink), 0.4) : color(palette.surface),
      rock: color(palette.line),
    }
  }, [palette])
}

function Figure({ innerRef, geometry, body, head, children }) {
  return (
    <group ref={innerRef}>
      <mesh geometry={geometry.body} position-y={0.22} castShadow>
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      <mesh geometry={geometry.head} position-y={0.56} castShadow>
        <meshStandardMaterial color={head} roughness={0.7} />
      </mesh>
      {children}
    </group>
  )
}

function CheckBadge({ innerRef, geometry, color, checkColor, ...props }) {
  return (
    <group ref={innerRef} scale={0.0001} {...props}>
      <mesh geometry={geometry.disc} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh geometry={geometry.checkStroke} position={[-0.1, -0.06, 0.06]} rotation={[0, 0, -2.36]} scale={[0.26, 1, 1]}>
        <meshStandardMaterial color={checkColor} />
      </mesh>
      <mesh geometry={geometry.checkStroke} position={[0.08, 0.03, 0.06]} rotation={[0, 0, 0.9]} scale={[0.46, 1, 1]}>
        <meshStandardMaterial color={checkColor} />
      </mesh>
    </group>
  )
}

function Island({ stageRef, palette, reducedMotion }) {
  const group = useRef()
  const sign = useRef()
  const header = useRef()
  const dots = useRef([])
  const plots = useRef([])
  const coordinator = useRef()
  const volunteers = useRef([])
  const trees = useRef([])
  const badges = useRef([])
  const ring = useRef()
  const flag = useRef()
  const hallBadge = useRef()
  const clouds = useRef([])
  const lookAt = useRef(new THREE.Vector3())
  const started = useRef(false)
  const { camera, size, pointer } = useThree()
  const tones = useTones(palette)

  const geometry = useMemo(() => {
    // Triangular prism with its ridge along x, flattened into a roof.
    const roof = new THREE.CylinderGeometry(0.95, 0.95, 2.5, 3, 1, false, Math.PI / 2)
    roof.rotateZ(Math.PI / 2)
    roof.scale(1, 0.6, 1)
    return {
      ground: new THREE.CylinderGeometry(4, 3.85, 0.35, 56),
      earth: new THREE.ConeGeometry(3.85, 2.4, 10),
      path: new THREE.BoxGeometry(0.7, 0.02, 4.9),
      pond: new THREE.CylinderGeometry(0.6, 0.6, 0.02, 32),
      wall: new THREE.BoxGeometry(2.2, 1.1, 1.4),
      roof,
      door: new THREE.BoxGeometry(0.4, 0.65, 0.05),
      window: new THREE.BoxGeometry(0.36, 0.3, 0.05),
      pole: new THREE.CylinderGeometry(0.025, 0.025, 2, 8),
      flag: new THREE.BoxGeometry(0.5, 0.3, 0.03),
      post: new THREE.CylinderGeometry(0.04, 0.04, 1, 8),
      board: new RoundedBoxGeometry(1.3, 0.8, 0.08, 3, 0.04),
      boardHeader: new RoundedBoxGeometry(1.3, 0.2, 0.03, 2, 0.015),
      date: new RoundedBoxGeometry(0.24, 0.24, 0.05, 2, 0.03),
      textLine: new RoundedBoxGeometry(1, 0.05, 0.02, 2, 0.01),
      dot: new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16),
      plot: new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24),
      body: new THREE.CapsuleGeometry(0.11, 0.22, 6, 14),
      head: new THREE.SphereGeometry(0.1, 20, 16),
      clipboard: new THREE.BoxGeometry(0.16, 0.2, 0.02),
      trunk: new THREE.CylinderGeometry(0.05, 0.07, 0.6, 7),
      cone: new THREE.ConeGeometry(0.42, 0.7, 7),
      crown: new THREE.IcosahedronGeometry(0.45, 1),
      cloud: new THREE.IcosahedronGeometry(0.5, 1),
      rock: new THREE.IcosahedronGeometry(1, 0),
      ring: new THREE.TorusGeometry(1, 0.012, 8, 96),
      disc: new THREE.CylinderGeometry(0.42, 0.42, 0.08, 40),
      checkStroke: new RoundedBoxGeometry(1, 0.12, 0.06, 2, 0.03),
    }
  }, [])

  // One foliage material per tree so each can change colour as it is verified.
  const foliage = useMemo(
    () => HOURS.map(() => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85 })),
    [],
  )
  useEffect(() => () => foliage.forEach((material) => material.dispose()), [foliage])

  useFrame((state, delta) => {
    const s = stageRef.current
    const publish = segment(s, 0, 1)
    const register = segment(s, 1, 2)
    const roster = segment(s, 2, 3)
    const record = segment(s, 3, 4)
    const verify = segment(s, 4, 5)
    const t = state.clock.elapsedTime
    // Damping smooths scroll jumps; the first frame and reduced motion snap straight to the scroll position.
    const k = reducedMotion || !started.current ? 1e6 : 7
    started.current = true
    const damp = (from, to) => THREE.MathUtils.damp(from, to, k, delta)

    // Camera: interpolate between stage framings, pushed back on narrow (portrait) canvases.
    const index = Math.min(Math.floor(s), CAMERA.length - 2)
    const f = ease(clamp01(s - index))
    const a = CAMERA[index]
    const b = CAMERA[index + 1]
    const distance = Math.max(1, 1.2 / (size.width / size.height))
    camera.position.set(
      damp(camera.position.x, lerp(a.pos[0], b.pos[0], f) * distance),
      damp(camera.position.y, lerp(a.pos[1], b.pos[1], f) * distance),
      damp(camera.position.z, lerp(a.pos[2], b.pos[2], f) * distance),
    )
    lookAt.current.set(
      damp(lookAt.current.x, lerp(a.look[0], b.look[0], f)),
      damp(lookAt.current.y, lerp(a.look[1], b.look[1], f)),
      damp(lookAt.current.z, lerp(a.look[2], b.look[2], f)),
    )
    camera.lookAt(lookAt.current)

    // Whole island: gentle float, slow sway and pointer parallax, skipped for reduced motion.
    group.current.position.y = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.06
    group.current.rotation.y = damp(group.current.rotation.y, reducedMotion ? 0 : pointer.x * 0.12 + Math.sin(t * 0.25) * 0.06)
    clouds.current.forEach((cloud, i) => {
      cloud.position.x = CLOUDS[i].pos[0] + (reducedMotion ? 0 : Math.sin(t * 0.15 + i * 2) * 0.6)
    })

    // Moves a figure toward a point, with a small hop while it is still walking.
    const walk = (figure, x, z, phase) => {
      const moving = clamp01(Math.hypot(x - figure.position.x, z - figure.position.z) * 4)
      figure.position.x = damp(figure.position.x, x)
      figure.position.z = damp(figure.position.z, z)
      figure.position.y = reducedMotion ? 0 : Math.abs(Math.sin(t * 10 + phase)) * 0.06 * moving
    }

    // Publish: the coordinator walks out, the notice board pops up and the planting spots are marked.
    const board = pop(clamp01(publish / 0.6))
    sign.current.scale.setScalar(Math.max(damp(sign.current.scale.x, board), 0.0001))
    sign.current.visible = publish > 0.01
    header.current.color.lerpColors(tones.line, tones.brand, segment(publish, 0.5, 1))
    plots.current.forEach((plot, i) => {
      plot.scale.setScalar(Math.max(pop(clamp01((publish - 0.3 - i * 0.03) / 0.3)), 0.0001))
      plot.visible = publish > 0.3
    })
    walk(
      coordinator.current,
      lerp(lerp(DOOR.x, SIGN_SIDE.x, publish), ROLL_CALL.x, register),
      lerp(lerp(DOOR.z, SIGN_SIDE.z, publish), ROLL_CALL.z, register),
      0,
    )

    // Verify: a ring spreads out from the middle of the island; trees it has passed are verified.
    const reach = verify * 4.8
    ring.current.scale.set(Math.max(reach, 0.0001), Math.max(reach, 0.0001), 1)
    ring.current.visible = verify > 0.01 && verify < 0.99

    for (let i = 0; i < FILLED; i++) {
      // Register: volunteers arrive one after another and each takes a spot.
      const arrived = ease(clamp01((register - i * 0.06) / 0.4))
      // Roster: everyone lines up for roll call, then goes back to their spot to work.
      const listed = ease(clamp01((roster - i * 0.04) / 0.55))
      const returned = ease(clamp01((record - i * 0.03) / 0.35))
      const inLine = listed * (1 - returned)
      const spot = spotOf(i)
      const line = lineOf(i)
      const volunteer = volunteers.current[i]
      walk(
        volunteer,
        lerp(lerp(ENTRANCE.x, spot.x, arrived), line.x, inLine),
        lerp(lerp(ENTRANCE.z, spot.z, arrived), line.z, inLine),
        i,
      )
      volunteer.scale.setScalar(Math.max(clamp01(arrived * 5), 0.0001))
      volunteer.visible = arrived > 0.001
      dots.current[i].color.lerpColors(tones.line, tones.brand, arrived)

      // Record: a tree grows at each spot, taller for more hours served.
      const grown = clamp01((record - 0.25 - i * 0.05) / 0.3)
      const tree = trees.current[i]
      tree.scale.setScalar(Math.max(pop(grown) * treeSize(i), 0.0001))
      tree.visible = grown > 0.001
      volunteer.rotation.z = reducedMotion ? 0 : Math.sin(t * 6 + i) * 0.15 * Math.sin(grown * Math.PI)

      const verified = clamp01((reach - Math.hypot(PLOTS[i].x, PLOTS[i].z)) / 0.5)
      foliage[i].color.lerpColors(tones.foliagePending, tones.foliage, verified)
      const badge = badges.current[i]
      badge.scale.setScalar(Math.max(pop(verified) * 0.4, 0.0001))
      badge.visible = verified > 0.001
      badge.quaternion.copy(camera.quaternion)
    }

    // Once everything is verified the flag goes up over the community hall.
    const done = segment(verify, 0.8, 1)
    flag.current.position.y = lerp(0.45, 1.8, done)
    hallBadge.current.scale.setScalar(Math.max(pop(done), 0.0001))
    hallBadge.current.visible = done > 0.01
    hallBadge.current.quaternion.copy(camera.quaternion)
  })

  const volunteerColors = [tones.brand, tones.info, tones.neutral]

  return (
    <group ref={group}>
      <mesh geometry={geometry.ground} position-y={-0.175} receiveShadow>
        <meshStandardMaterial color={tones.grass} roughness={0.95} />
      </mesh>
      <mesh geometry={geometry.earth} position-y={-1.55} rotation-x={Math.PI}>
        <meshStandardMaterial color={tones.soil} roughness={1} flatShading />
      </mesh>
      <mesh geometry={geometry.path} position={[0, 0.01, 1.15]} receiveShadow>
        <meshStandardMaterial color={tones.path} roughness={1} />
      </mesh>
      <mesh geometry={geometry.pond} position={[-2, 0.01, -2.6]}>
        <meshStandardMaterial color={tones.info} roughness={0.25} />
      </mesh>

      <group position={[0, 0, -2]}>
        <mesh geometry={geometry.wall} position-y={0.55} castShadow receiveShadow>
          <meshStandardMaterial color={tones.wall} roughness={0.8} />
        </mesh>
        <mesh geometry={geometry.roof} position-y={1.385} castShadow>
          <meshStandardMaterial color={tones.accent} roughness={0.7} flatShading />
        </mesh>
        <mesh geometry={geometry.door} position={[0, 0.325, 0.71]}>
          <meshStandardMaterial color={tones.brand} roughness={0.6} />
        </mesh>
        {[-0.68, 0.68].map((x) => (
          <mesh key={x} geometry={geometry.window} position={[x, 0.68, 0.71]}>
            <meshStandardMaterial color={tones.info} roughness={0.3} />
          </mesh>
        ))}
        <mesh geometry={geometry.pole} position={[1.4, 1, 0.5]} castShadow>
          <meshStandardMaterial color={tones.line} roughness={0.6} />
        </mesh>
        <mesh ref={flag} geometry={geometry.flag} position={[1.67, 0.45, 0.5]} castShadow>
          <meshStandardMaterial color={tones.success} roughness={0.6} />
        </mesh>
        <CheckBadge innerRef={hallBadge} geometry={geometry} color={tones.success} checkColor={palette.onSuccess} position={[0, 2.6, 0]} />
      </group>

      <group ref={sign} position={[SIGN.x, 0, SIGN.z]} rotation-y={0.3} scale={0.0001}>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} geometry={geometry.post} position={[x, 0.5, 0]} castShadow>
            <meshStandardMaterial color={tones.trunk} roughness={0.9} />
          </mesh>
        ))}
        <mesh geometry={geometry.board} position-y={1} castShadow>
          <meshStandardMaterial color={tones.board} roughness={0.6} />
        </mesh>
        <mesh geometry={geometry.boardHeader} position={[0, 1.3, 0.045]}>
          <meshStandardMaterial ref={header} roughness={0.5} />
        </mesh>
        <mesh geometry={geometry.date} position={[-0.46, 1.03, 0.05]}>
          <meshStandardMaterial color={tones.accent} roughness={0.5} />
        </mesh>
        {[0.6, 0.42].map((width, i) => (
          <mesh key={width} geometry={geometry.textLine} position={[-0.28 + width / 2, 1.08 - i * 0.1, 0.045]} scale={[width, 1, 1]}>
            <meshStandardMaterial color={tones.line} roughness={0.8} />
          </mesh>
        ))}
        {PLOTS.map((_, i) => (
          <mesh key={i} geometry={geometry.dot} position={[-0.495 + (i % 6) * 0.198, 0.83 - Math.floor(i / 6) * 0.13, 0.045]} rotation-x={Math.PI / 2}>
            <meshStandardMaterial ref={(el) => { dots.current[i] = el }} color={tones.line} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {PLOTS.map((plot, i) => (
        <mesh key={i} ref={(el) => { plots.current[i] = el }} geometry={geometry.plot} position={[plot.x, 0.015, plot.z]} scale={0.0001} receiveShadow>
          <meshStandardMaterial color={tones.soil} roughness={1} />
        </mesh>
      ))}

      {OLD_TREES.map(([x, z, scale], i) => (
        <group key={x} position={[x, 0, z]} rotation-y={i * 2.1} scale={scale}>
          <mesh geometry={geometry.trunk} position-y={0.3} castShadow>
            <meshStandardMaterial color={tones.trunk} roughness={0.9} flatShading />
          </mesh>
          <mesh geometry={i % 2 ? geometry.cone : geometry.crown} position-y={i % 2 ? 0.8 : 0.95} castShadow>
            <meshStandardMaterial color={tones.foliage} roughness={0.85} flatShading />
          </mesh>
          <mesh geometry={i % 2 ? geometry.cone : geometry.crown} position={i % 2 ? [0, 1.15, 0] : [0.26, 0.72, 0.1]} scale={i % 2 ? 0.72 : 0.6} castShadow>
            <meshStandardMaterial color={tones.foliage} roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}
      {BUSHES.map(([x, z, scale]) => (
        <mesh key={x} geometry={geometry.crown} position={[x, scale * 0.3, z]} scale={[scale, scale * 0.75, scale]} castShadow>
          <meshStandardMaterial color={tones.foliage} roughness={0.85} flatShading />
        </mesh>
      ))}
      {ROCKS.map(([x, z, scale], i) => (
        <mesh key={x} geometry={geometry.rock} position={[x, scale * 0.4, z]} rotation-y={i * 1.7} scale={[scale, scale * 0.7, scale]} castShadow>
          <meshStandardMaterial color={tones.rock} roughness={1} flatShading />
        </mesh>
      ))}

      <Figure innerRef={coordinator} geometry={geometry} body={tones.accent} head={tones.head}>
        <mesh geometry={geometry.clipboard} position={[0.02, 0.3, 0.13]} rotation-x={-0.5}>
          <meshStandardMaterial color={tones.board} roughness={0.6} />
        </mesh>
      </Figure>

      {HOURS.map((_, i) => (
        <group key={i}>
          <Figure
            innerRef={(el) => { volunteers.current[i] = el }}
            geometry={geometry}
            body={volunteerColors[i % volunteerColors.length]}
            head={tones.head}
          />
          <group ref={(el) => { trees.current[i] = el }} position={[PLOTS[i].x, 0, PLOTS[i].z]} rotation-y={i * 1.3} scale={0.0001}>
            <mesh geometry={geometry.trunk} position-y={0.3} castShadow>
              <meshStandardMaterial color={tones.trunk} roughness={0.9} flatShading />
            </mesh>
            {i % 2 === 0 ? (
              <>
                <mesh geometry={geometry.cone} material={foliage[i]} position-y={0.8} castShadow />
                <mesh geometry={geometry.cone} material={foliage[i]} position-y={1.15} scale={0.72} castShadow />
              </>
            ) : (
              <>
                <mesh geometry={geometry.crown} material={foliage[i]} position-y={0.95} castShadow />
                <mesh geometry={geometry.crown} material={foliage[i]} position={[0.26, 0.72, 0.1]} scale={0.6} castShadow />
              </>
            )}
          </group>
          <CheckBadge
            innerRef={(el) => { badges.current[i] = el }}
            geometry={geometry}
            color={tones.success}
            checkColor={palette.onSuccess}
            position={[PLOTS[i].x, 1.42 * treeSize(i) + 0.3, PLOTS[i].z]}
          />
        </group>
      ))}

      <mesh ref={ring} geometry={geometry.ring} position-y={0.06} rotation-x={Math.PI / 2} visible={false}>
        <meshStandardMaterial color={tones.success} emissive={tones.success} emissiveIntensity={0.8} />
      </mesh>

      {CLOUDS.map((cloud, i) => (
        <group key={i} ref={(el) => { clouds.current[i] = el }} position={cloud.pos} scale={cloud.scale}>
          {[[0, 0, 0, 1], [0.55, -0.08, 0.1, 0.75], [-0.55, -0.1, -0.05, 0.65]].map(([x, y, z, scale]) => (
            <mesh key={x} geometry={geometry.cloud} position={[x, y, z]} scale={[scale, scale * 0.7, scale]}>
              <meshStandardMaterial color={tones.cloud} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function CommunityScene({ stageRef, palette, reducedMotion, active }) {
  return (
    <Canvas
      shadows="percentage"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: CAMERA[0].pos, fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <hemisphereLight args={['#ffffff', palette.sunken, palette.dark ? 0.7 : 1]} />
      <directionalLight
        castShadow
        position={[5, 9, 6]}
        intensity={palette.dark ? 1.9 : 1.7}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 1, 30]} />
      </directionalLight>
      <directionalLight position={[-6, 3, -2]} intensity={0.3} />
      <Island stageRef={stageRef} palette={palette} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

export default CommunityScene

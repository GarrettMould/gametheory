// Every sound in the arena, made on the spot with the Web Audio API: no audio files.
//
//   const sound = createSoundscape()
//   sound.wake()               call from a key press or click; browsers stay silent until then
//   sound.setTerrain('jungle') the background: wind, insects, frogs...
//   sound.step('water')        one footfall on 'ground', 'water', 'snow' or 'ice'
//   sound.setChase(level)      a heartbeat while chased, faster as level goes from 0 to 1; null stops it
//   sound.play('win')          one-off cues: challenge, pick, win, lose, draw, eat, armor, round, over
//   sound.setMuted(true)
//   sound.dispose()

// The background of each terrain: filtered noise that swells and fades, plus the odd animal call.
const AMBIENT = {
  savanna: { filter: 'lowpass', pitch: 480, q: 0.7, level: 0.05, swell: 0.12, calls: ['bird'], every: [5, 12] },
  jungle: { filter: 'bandpass', pitch: 3300, q: 1.4, level: 0.03, swell: 0.4, calls: ['parakeet', 'parakeet', 'bird'], every: [2.5, 7] },
  arctic: { filter: 'bandpass', pitch: 420, q: 2.6, level: 0.11, swell: 0.07, calls: ['gust'], every: [6, 14] },
  wetland: { filter: 'lowpass', pitch: 820, q: 0.7, level: 0.035, swell: 0.1, calls: ['frog', 'frog', 'cricket'], every: [2, 6] },
}
const STEPS = {
  ground: { filter: 'lowpass', pitch: 850, level: 0.13, length: 0.07 },
  water: { filter: 'bandpass', pitch: 1700, level: 0.16, length: 0.14 },
  snow: { filter: 'highpass', pitch: 2400, level: 0.09, length: 0.1 },
  ice: { filter: 'bandpass', pitch: 3200, level: 0.07, length: 0.04 },
}
const NOTE = { C4: 261.6, Eb4: 311.1, G4: 392, C5: 523.3, E5: 659.3, G5: 784, C6: 1046.5 }
const between = (a, b) => a + (b - a) * Math.random()

export function createSoundscape() {
  let ctx = null
  let master = null
  let noise = null // a couple of seconds of hiss, reused for wind, footsteps and splashes
  let bed = null // { filter, gain, swell } for the background
  let terrain = 'savanna'
  let muted = false
  let chase = null // 0..1 while being chased, otherwise null
  let beatTimer = null
  let callTimer = null

  function ensure() {
    if (ctx) return true
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return false
    ctx = new Audio()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.7
    master.connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
    startBed()
    queueCall()
    return true
  }

  /** A single pitched note. `to` slides the pitch over its length. */
  function tone(pitch, { at = 0, length = 0.15, level = 0.12, shape = 'sine', to = null } = {}) {
    const start = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = shape
    osc.frequency.setValueAtTime(pitch, start)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.02, length / 3))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + length + 0.02)
  }

  /** A short burst of filtered hiss: a footstep, a splash, a gust. */
  function hiss({ filter, pitch, level, length, at = 0, q = 1 }) {
    const start = ctx.currentTime + at
    const source = ctx.createBufferSource()
    source.buffer = noise
    const shaped = ctx.createBiquadFilter()
    shaped.type = filter
    shaped.frequency.value = pitch
    shaped.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.015, length / 3))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    source.connect(shaped).connect(gain).connect(master)
    source.start(start, Math.random())
    source.stop(start + length + 0.02)
  }

  function startBed() {
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    gain.gain.value = 0
    // a slow wobble on the loudness, so the wind breathes
    const swell = ctx.createOscillator()
    const depth = ctx.createGain()
    swell.connect(depth).connect(gain.gain)
    source.connect(filter).connect(gain).connect(master)
    source.start()
    swell.start()
    bed = { filter, gain, swell, depth }
    tuneBed()
  }

  function tuneBed() {
    if (!bed) return
    const mood = AMBIENT[terrain] || AMBIENT.savanna
    const now = ctx.currentTime
    bed.filter.type = mood.filter
    bed.filter.frequency.setTargetAtTime(mood.pitch, now, 0.6)
    bed.filter.Q.setTargetAtTime(mood.q, now, 0.6)
    bed.gain.gain.setTargetAtTime(mood.level, now, 0.8)
    bed.swell.frequency.setTargetAtTime(mood.swell, now, 0.5)
    bed.depth.gain.setTargetAtTime(mood.level * 0.6, now, 0.8)
  }

  const CALLS = {
    bird() {
      const pitch = between(2100, 3200)
      const count = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i += 1) tone(pitch * between(0.92, 1.1), { at: i * 0.11, length: 0.07, level: 0.035, to: pitch * 1.25 })
    },
    parakeet() {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i += 1) {
        tone(between(1500, 1900), { at: i * 0.16, length: 0.11, level: 0.03, shape: 'sawtooth', to: between(850, 1100) })
      }
    },
    frog() {
      const pitch = between(150, 230)
      for (let i = 0; i < 3; i += 1) tone(pitch, { at: i * 0.17, length: 0.09, level: 0.05, shape: 'square', to: pitch * 0.8 })
    },
    cricket() {
      for (let i = 0; i < 7; i += 1) tone(4600, { at: i * 0.055, length: 0.03, level: 0.02 })
    },
    gust() {
      hiss({ filter: 'bandpass', pitch: between(300, 600), q: 3, level: 0.14, length: between(1.5, 3) })
    },
  }

  function queueCall() {
    clearTimeout(callTimer)
    const mood = AMBIENT[terrain] || AMBIENT.savanna
    callTimer = setTimeout(() => {
      if (ctx && ctx.state === 'running' && !muted) {
        CALLS[mood.calls[Math.floor(Math.random() * mood.calls.length)]]()
      }
      queueCall()
    }, between(mood.every[0], mood.every[1]) * 1000)
  }

  /** The heartbeat while chased: lub-dub, closer together as the hunter closes in. */
  function beat() {
    clearTimeout(beatTimer)
    if (chase == null || !ctx) return
    if (ctx.state === 'running' && !muted) {
      const level = 0.2 + chase * 0.25
      tone(62, { length: 0.16, level, to: 40 })
      tone(54, { at: 0.17, length: 0.2, level: level * 0.8, to: 36 })
    }
    beatTimer = setTimeout(beat, (1.05 - 0.6 * chase) * 1000)
  }

  const CUES = {
    challenge: () => [330, 440, 660].forEach((pitch, i) => tone(pitch, { at: i * 0.09, length: 0.14, level: 0.1, shape: 'triangle' })),
    pick: () => tone(700, { length: 0.05, level: 0.08, shape: 'triangle' }),
    win: () => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((pitch, i) => tone(pitch, { at: i * 0.1, length: 0.22, level: 0.11, shape: 'triangle' })),
    lose: () => [NOTE.G4, NOTE.Eb4, NOTE.C4].forEach((pitch, i) => tone(pitch, { at: i * 0.16, length: 0.3, level: 0.11, shape: 'triangle' })),
    draw: () => [NOTE.G4, NOTE.G4].forEach((pitch, i) => tone(pitch, { at: i * 0.16, length: 0.2, level: 0.09, shape: 'triangle' })),
    eat: () => tone(520, { length: 0.09, level: 0.1, to: 980 }),
    armor: () => [900, 1350, 1810].forEach((pitch) => tone(pitch, { length: 0.35, level: 0.05, shape: 'square' })),
    round: () => {
      tone(196, { length: 1.8, level: 0.16 })
      tone(294, { length: 1.4, level: 0.07 })
    },
    over: () => [NOTE.C5, NOTE.G4, NOTE.Eb4, NOTE.C4].forEach((pitch, i) => tone(pitch / 2, { at: i * 0.28, length: 0.5, level: 0.13, shape: 'sawtooth' })),
  }

  const live = () => ensure() && ctx.state === 'running' && !muted

  return {
    /** Browsers only allow sound after the user does something, so call this from a key press or click. */
    wake() {
      if (ensure() && ctx.state === 'suspended') ctx.resume()
    },
    setTerrain(kind) {
      terrain = kind
      if (ctx) {
        tuneBed()
        queueCall()
      }
    },
    step(surface) {
      if (live()) hiss(STEPS[surface] || STEPS.ground)
    },
    setChase(level) {
      const was = chase
      chase = level
      if (level != null && was == null) beat()
      if (level == null) clearTimeout(beatTimer)
    },
    play(cue) {
      if (live() && CUES[cue]) CUES[cue]()
    },
    setMuted(value) {
      muted = value
      if (master) master.gain.setTargetAtTime(value ? 0 : 0.7, ctx.currentTime, 0.05)
    },
    dispose() {
      clearTimeout(beatTimer)
      clearTimeout(callTimer)
      ctx?.close()
      ctx = null
      master = null
      bed = null
    },
  }
}

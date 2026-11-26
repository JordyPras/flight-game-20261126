// Langit Nusantara — Island Courier: all sound is synthesized live with WebAudio.
// No audio files, no network: an engine hum, wind, a ring chime and a crash,
// built from oscillators and filtered noise, and silent until the player gestures.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windGain = null;
    this.muted = false;
    this.started = false;
  }

  /** Create the audio graph. Call from a user gesture; browsers block sound before one. */
  start() {
    if (this.started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);

      // Engine: two detuned sawtooth oscillators through a low-pass filter.
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.connect(this.master);
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(filter);
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();
      this.engineOsc2 = this.context.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 78;
      this.engineOsc2.connect(this.engineGain);
      this.engineOsc2.start();

      // Wind: looped filtered noise whose level follows airspeed.
      const noiseLength = this.context.sampleRate * 2;
      const noiseBuffer = this.context.createBuffer(1, noiseLength, this.context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let index = 0; index < noiseLength; index += 1) {
        noiseData[index] = Math.random() * 2 - 1;
      }
      const noise = this.context.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const windFilter = this.context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      this.windGain = this.context.createGain();
      this.windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      noise.start();
      this.started = true;
    } catch {
      // Sound is a garnish: a game with no audio context still flies.
      this.started = false;
    }
  }

  /** Resume a suspended context after a gesture (mobile browsers suspend often). */
  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
  }

  /** Engine and wind follow throttle and airspeed, called every frame. */
  update(throttle, speed, airborne) {
    if (!this.started || this.muted) return;
    const now = this.context.currentTime;
    const engineLevel = airborne ? 0.05 + throttle * 0.075 : throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(engineLevel, now, 0.1);
    const engineFreq = 46 + throttle * 62 + speed * 0.35;
    this.engineOsc.frequency.setTargetAtTime(engineFreq, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(engineFreq * 1.5, now, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0011), now, 0.15);
  }

  /** A short two-note chime when the plane threads a ring. */
  ring() {
    if (!this.started || this.muted) return;
    this.tone(880, 0.12, 0.16, 'sine');
    window.setTimeout(() => this.tone(1318, 0.18, 0.16, 'sine'), 90);
  }

  /** A low thud and noise burst when the plane crashes. */
  crash() {
    if (!this.started || this.muted) return;
    this.tone(70, 0.5, 0.5, 'triangle');
    this.noiseBurst(0.4, 0.35);
  }

  /** A soft click for menu actions. */
  click() {
    if (!this.started || this.muted) return;
    this.tone(660, 0.06, 0.12, 'square');
  }

  /** A rising arpeggio when the level goes up. */
  levelUp() {
    if (!this.started || this.muted) return;
    [523, 659, 784, 1046].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.14, 0.14, 'sine'), index * 80);
    });
  }

  tone(frequency, duration, volume, type) {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  noiseBurst(duration, volume) {
    const now = this.context.currentTime;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }
}

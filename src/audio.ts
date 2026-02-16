/**
 * Audio playback manager with spectral analysis via Web Audio API.
 *
 * Usage:
 *   const audio = new AudioManager();
 *   await audio.load('/Assembly.mp3');
 *   audio.play();                       // start / resume
 *   audio.pause();                      // pause
 *   audio.setVolume(0.8);               // 0 – 1
 *   const spectrum = audio.getFrequencyData();   // Float32Array (dB)
 *   const waveform = audio.getTimeDomainData();  // Float32Array (-1..1)
 *   const bands    = audio.getBands();            // { sub, bass, mid, high, presence, brilliance }
 */

/** Pre-defined frequency-band ranges (Hz). */
export interface FrequencyBands {
  /** ~20 – 60 Hz */
  sub: number;
  /** ~60 – 250 Hz */
  bass: number;
  /** ~250 – 2 000 Hz */
  mid: number;
  /** ~2 000 – 6 000 Hz */
  high: number;
  /** ~6 000 – 12 000 Hz */
  presence: number;
  /** ~12 000 – 20 000 Hz */
  brilliance: number;
}

export interface AudioManagerOptions {
  /** FFT size – must be a power of 2 between 32 and 32768.  Default 2048. */
  fftSize?: number;
  /** Smoothing constant for the analyser (0 – 1).  Default 0.8. */
  smoothingTimeConstant?: number;
  /** Min decibels for the analyser.  Default -100. */
  minDecibels?: number;
  /** Max decibels for the analyser.  Default -30. */
  maxDecibels?: number;
  /** Initial volume (0 – 1).  Default 1. */
  volume?: number;
  /** Whether playback should loop.  Default true. */
  loop?: boolean;
}

export class AudioManager {
  // ── Web Audio graph ───────────────────────────────────────────────────
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private element: HTMLAudioElement | null = null;

  // ── Reusable typed-array buffers ──────────────────────────────────────
  private freqBuffer: Float32Array<ArrayBuffer> | null = null;
  private timeBuffer: Float32Array<ArrayBuffer> | null = null;
  private byteFreqBuffer: Uint8Array<ArrayBuffer> | null = null;

  // ── Options ───────────────────────────────────────────────────────────
  private readonly fftSize: number;
  private readonly smoothing: number;
  private readonly minDecibels: number;
  private readonly maxDecibels: number;
  private volume: number;
  private loop: boolean;

  // ── State ─────────────────────────────────────────────────────────────
  private loaded = false;
  private started = false;

  constructor(opts: AudioManagerOptions = {}) {
    this.fftSize = opts.fftSize ?? 2048;
    this.smoothing = opts.smoothingTimeConstant ?? 0.8;
    this.minDecibels = opts.minDecibels ?? -100;
    this.maxDecibels = opts.maxDecibels ?? -30;
    this.volume = opts.volume ?? 1;
    this.loop = opts.loop ?? true;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Load an audio file by URL.  Can be called multiple times to switch
   * tracks – the previous source is stopped & replaced.
   */
  async load(url: string): Promise<void> {
    // Lazily create the AudioContext on first load so we don't hit the
    // browser auto-play policy before a user gesture.
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    // Tear down previous source if any
    this.disposeSource();

    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.loop = this.loop;
    el.preload = 'auto';
    el.src = url;

    // Wait until enough data is buffered to begin playback.
    await new Promise<void>((resolve, reject) => {
      el.addEventListener('canplaythrough', () => resolve(), { once: true });
      el.addEventListener('error', () => reject(new Error(`Failed to load audio: ${url}`)), { once: true });
    });

    // Build graph: source → gain → analyser → destination
    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume;

    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = this.smoothing;
    analyser.minDecibels = this.minDecibels;
    analyser.maxDecibels = this.maxDecibels;

    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(this.ctx.destination);

    this.sourceNode = source;
    this.gainNode = gain;
    this.analyser = analyser;
    this.element = el;

    // Allocate / reallocate buffers for the current FFT size
    const binCount = analyser.frequencyBinCount;
    this.freqBuffer = new Float32Array(binCount);
    this.timeBuffer = new Float32Array(binCount);
    this.byteFreqBuffer = new Uint8Array(binCount);

    this.loaded = true;
    this.started = false;
  }

  /** Start or resume playback. Handles AudioContext resume after user gesture. */
  async play(): Promise<void> {
    if (!this.element || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    await this.element.play();
    this.started = true;
  }

  /** Pause playback. */
  pause(): void {
    this.element?.pause();
  }

  /** Stop playback and rewind to the beginning. */
  stop(): void {
    if (this.element) {
      this.element.pause();
      this.element.currentTime = 0;
    }
    this.started = false;
  }

  /** Toggle play / pause. */
  async toggle(): Promise<void> {
    if (!this.element) return;
    if (this.element.paused) {
      await this.play();
    } else {
      this.pause();
    }
  }

  /** Set the master volume (0 – 1). */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /** Get current master volume. */
  getVolume(): number {
    return this.volume;
  }

  /** Set whether playback should loop. */
  setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.element) {
      this.element.loop = loop;
    }
  }

  /** Current playback position in seconds. */
  get currentTime(): number {
    return this.element?.currentTime ?? 0;
  }

  /** Total duration of the loaded track in seconds. */
  get duration(): number {
    return this.element?.duration ?? 0;
  }

  /** Whether audio is currently playing. */
  get isPlaying(): boolean {
    return !!this.element && !this.element.paused;
  }

  /** Whether a track has been loaded. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  // ── Spectral analysis ─────────────────────────────────────────────────

  /** Number of frequency bins (= fftSize / 2). */
  get binCount(): number {
    return this.analyser?.frequencyBinCount ?? 0;
  }

  /** Frequency resolution in Hz per bin. */
  get binHz(): number {
    if (!this.ctx || !this.analyser) return 0;
    return this.ctx.sampleRate / this.analyser.fftSize;
  }

  /**
   * Return the current frequency-domain data as **decibel** values
   * (range: minDecibels … maxDecibels).
   * The returned buffer is reused between calls — copy it if you need to
   * keep a snapshot.
   */
  getFrequencyData(): Float32Array {
    if (!this.analyser || !this.freqBuffer) return new Float32Array(0);
    this.analyser.getFloatFrequencyData(this.freqBuffer);
    return this.freqBuffer;
  }

  /**
   * Return the current frequency-domain data as **normalised 0 – 255**
   * unsigned bytes (useful for quick visualisation).
   */
  getByteFrequencyData(): Uint8Array {
    if (!this.analyser || !this.byteFreqBuffer) return new Uint8Array(0);
    this.analyser.getByteFrequencyData(this.byteFreqBuffer);
    return this.byteFreqBuffer;
  }

  /**
   * Return the current time-domain (waveform) data as floats in -1 … 1.
   * The returned buffer is reused between calls.
   */
  getTimeDomainData(): Float32Array {
    if (!this.analyser || !this.timeBuffer) return new Float32Array(0);
    this.analyser.getFloatTimeDomainData(this.timeBuffer);
    return this.timeBuffer;
  }

  /**
   * Return averaged energy in six perceptual frequency bands.
   * Values are in **decibels** (same range as `getFrequencyData`).
   */
  getBands(): FrequencyBands {
    const freq = this.getFrequencyData();
    const hz = this.binHz;

    return {
      sub:        this.avgRange(freq, hz, 20, 60),
      bass:       this.avgRange(freq, hz, 60, 250),
      mid:        this.avgRange(freq, hz, 250, 2_000),
      high:       this.avgRange(freq, hz, 2_000, 6_000),
      presence:   this.avgRange(freq, hz, 6_000, 12_000),
      brilliance: this.avgRange(freq, hz, 12_000, 20_000),
    };
  }

  /**
   * Return a normalised (0 – 1) version of `getBands()`, useful for
   * driving visual effects.  Each band is mapped from
   * [minDecibels … maxDecibels] → [0 … 1].
   */
  getNormalisedBands(): FrequencyBands {
    const raw = this.getBands();
    const range = this.maxDecibels - this.minDecibels;
    const norm = (v: number) => Math.max(0, Math.min(1, (v - this.minDecibels) / range));
    return {
      sub:        norm(raw.sub),
      bass:       norm(raw.bass),
      mid:        norm(raw.mid),
      high:       norm(raw.high),
      presence:   norm(raw.presence),
      brilliance: norm(raw.brilliance),
    };
  }

  /**
   * Convenience: return a single normalised "energy" value (0 – 1)
   * representing the overall loudness.  Useful for a simple beat-reactive
   * effect.
   */
  getEnergy(): number {
    const bands = this.getNormalisedBands();
    return (bands.sub + bands.bass + bands.mid + bands.high + bands.presence + bands.brilliance) / 6;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /** Release all Web Audio resources. */
  dispose(): void {
    this.disposeSource();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private disposeSource(): void {
    if (this.element) {
      this.element.pause();
      this.element.removeAttribute('src');
      this.element.load(); // release network resources
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.element = null;
    this.freqBuffer = null;
    this.timeBuffer = null;
    this.byteFreqBuffer = null;
    this.loaded = false;
    this.started = false;
  }

  /** Average the decibel values of bins whose centre frequencies lie within [loHz, hiHz). */
  private avgRange(freq: Float32Array, binHz: number, loHz: number, hiHz: number): number {
    if (freq.length === 0 || binHz === 0) return this.minDecibels;
    const loIdx = Math.max(0, Math.floor(loHz / binHz));
    const hiIdx = Math.min(freq.length - 1, Math.ceil(hiHz / binHz));
    if (loIdx > hiIdx) return this.minDecibels;
    let sum = 0;
    for (let i = loIdx; i <= hiIdx; i++) {
      sum += freq[i];
    }
    return sum / (hiIdx - loIdx + 1);
  }
}

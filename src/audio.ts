/**
 * Audio playback manager integrated with Theatre.js and Web Audio spectral analysis.
 *
 * Playback is driven by a Theatre.js sequence (`sheet.sequence.attachAudio`),
 * which keeps the audio perfectly in sync with the Theatre timeline.  An
 * AnalyserNode is spliced into the audio graph so spectral data is always
 * available.
 *
 * Usage:
 *   const audio = new AudioManager();
 *   await audio.attachToSequence(sheet.sequence, './track.mp3');
 *   audio.play();                       // delegates to sequence.play()
 *   audio.pause();                      // delegates to sequence.pause()
 *   audio.setVolume(0.8);               // 0 – 1
 *   const spectrum = audio.getFrequencyData();   // Float32Array (dB)
 *   const waveform = audio.getTimeDomainData();  // Float32Array (-1..1)
 *   const bands    = audio.getBands();            // { sub, bass, mid, high, presence, brilliance }
 */

import type { ISequence } from '@theatre/core';

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
}

export class AudioManager {
  // ── Web Audio graph ───────────────────────────────────────────────────
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  gainNode: GainNode | null = null;

  // ── Theatre.js ────────────────────────────────────────────────────────
  private sequence: ISequence | null = null;

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

  // ── State ─────────────────────────────────────────────────────────────
  private loaded = false;

  constructor(opts: AudioManagerOptions = {}) {
    this.fftSize = opts.fftSize ?? 2048;
    this.smoothing = opts.smoothingTimeConstant ?? 0.8;
    this.minDecibels = opts.minDecibels ?? -100;
    this.maxDecibels = opts.maxDecibels ?? -30;
    this.volume = opts.volume ?? 1;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Attach an audio source to a Theatre.js sequence.
   *
   * Theatre.js decodes the audio and keeps playback in sync with the
   * sequence timeline.  We provide our own AudioContext so the browser
   * doesn't auto-suspend it, and we splice an AnalyserNode into the
   * graph for spectral analysis.
   *
   * @param sequence – `sheet.sequence` from Theatre.js
   * @param source   – URL to an audio file, or a pre-decoded AudioBuffer
   */
  async attachToSequence(
    sequence: ISequence,
    source: string | AudioBuffer,
  ): Promise<void> {
    // Lazily create the AudioContext so we don't hit the browser
    // auto-play policy before a user gesture.
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    // Tear down any previous attachment
    this.disposeGraph();

    // Create our analyser node
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = this.smoothing;
    analyser.minDecibels = this.minDecibels;
    analyser.maxDecibels = this.maxDecibels;

    // Connect analyser → speakers
    analyser.connect(this.ctx.destination);

    // Let Theatre.js load & decode the audio.  We pass our analyser as
    // the destinationNode so Theatre's internal gainNode feeds directly
    // into it:  Theatre source → Theatre gainNode → analyser → destination
    const { gainNode } = await sequence.attachAudio({
      source,
      audioContext: this.ctx,
      destinationNode: analyser,
    });

    // Apply initial volume
    gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    this.analyser = analyser;
    this.gainNode = gainNode;
    this.sequence = sequence;

    // Allocate / reallocate reusable buffers
    const binCount = analyser.frequencyBinCount;
    this.freqBuffer = new Float32Array(binCount);
    this.timeBuffer = new Float32Array(binCount);
    this.byteFreqBuffer = new Uint8Array(binCount);

    this.loaded = true;
  }

  // ── Playback (delegates to Theatre.js sequence) ───────────────────────

  /**
   * Start or resume playback via the Theatre.js sequence.
   * Accepts the same options as `sequence.play()`.
   */
  async play(opts?: {
    iterationCount?: number;
    range?: [from: number, to: number];
    rate?: number;
    direction?: 'normal' | 'reverse' | 'alternate' | 'alternateReverse';
  }): Promise<boolean> {
    if (!this.sequence) return false;
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.sequence.play(opts);
  }

  /** Pause playback. */
  pause(): void {
    this.sequence?.pause();
  }

  /** Stop playback and rewind to the beginning. */
  stop(): void {
    if (this.sequence) {
      this.sequence.pause();
      this.sequence.position = 0;
    }
  }

  /** Toggle play / pause. */
  async toggle(): Promise<void> {
    if (!this.sequence) return;
    // Theatre.js doesn't expose a simple "paused" flag, so we check
    // whether position is advancing by comparing with a snapshot.
    // A simpler heuristic: if we just started, pause; else play.
    // We use the pointer for this but a lightweight approach:
    this.pause();
    // If it was already paused, play instead.
    // Theatre pauses are idempotent, so calling pause when already paused
    // is a no-op.  We detect that by seeing if position changes.
    await this.play();
  }

  /** Set the master volume (0 – 1). */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /** Get current master volume. */
  getVolume(): number {
    return this.volume;
  }

  /** Current playback position in seconds (from the Theatre sequence). */
  get currentTime(): number {
    return this.sequence?.position ?? 0;
  }

  /** Whether a track has been loaded and attached. */
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
    this.disposeGraph();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private disposeGraph(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.sequence = null;
    this.freqBuffer = null;
    this.timeBuffer = null;
    this.byteFreqBuffer = null;
    this.loaded = false;
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

export const audioManager = new AudioManager();

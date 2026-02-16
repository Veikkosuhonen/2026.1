import * as THREE from "three"
import { Pass } from "three/examples/jsm/Addons.js";
import { Profiler } from "../profiler";

export type PassProps = {
  renderer: THREE.WebGLRenderer,
  read: THREE.WebGLRenderTarget,
  write: THREE.WebGLRenderTarget
}

export abstract class RenderPass extends Pass {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  abstract pass({ renderer, read, write }: PassProps): void

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    Profiler.start(this.name)

    this.pass({
      renderer,
      read: readBuffer,
      write: writeBuffer
    })

    Profiler.end(this.name)
  }
}
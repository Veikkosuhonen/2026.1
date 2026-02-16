import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { fsQuad } from "./utils";
import { copyShader } from "../shaders/copy";

export class DebugPass extends RenderPass {
  texture: THREE.Texture;
  mode: number = 1.0;

  constructor(texture: THREE.Texture) {
    super("DebugPass");
    this.texture = texture;
    this.needsSwap = false;
  }

  pass({ renderer, read }: PassProps): void {
    if (this.mode) {
      renderer.setRenderTarget(read);
      copyShader.uniforms.src.value = this.texture;
      copyShader.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      fsQuad.material = copyShader;
      fsQuad.render(renderer);
    }
  }
}
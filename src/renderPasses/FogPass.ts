import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { fsQuad } from "./utils";
import { fogShader } from "../shaders/fog";

export class FogPass extends RenderPass {
  amount = 0.01;
  fogColor = new THREE.Color(0x000000);

  gBuffer: THREE.WebGLRenderTarget;

  constructor(gBuffer: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera) {
    super("FogPass")
    this.gBuffer = gBuffer;
    fogShader.uniforms.gPositionMetalness.value = gBuffer.textures[2]
  }

  pass({ renderer, read, write }: PassProps): void {
    renderer.setRenderTarget(write);
    renderer.clear();
    fsQuad.material = fogShader;

    fogShader.uniforms.src.value = read.texture;
    fogShader.uniforms.amount.value = this.amount;
    fogShader.uniforms.fogColor.value = this.fogColor;
    fogShader.uniforms.u_resolution.value.set(read.width, read.height)

    fsQuad.render(renderer);
  }
}
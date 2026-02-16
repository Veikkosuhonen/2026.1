import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { bokehShader } from "../shaders/bokeh";
import { fsQuad } from "./utils";

export class BokehPass extends RenderPass {
  focus = 1.0;
  aperture = 0.025;
  maxBlur = 0.001;

  gBuffer: THREE.WebGLRenderTarget;

  constructor(gBuffer: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera) {
    super("BokehPass")
    this.gBuffer = gBuffer;
    bokehShader.uniforms.gPositionMetalness.value = gBuffer.textures[2]
    bokehShader.uniforms.nearClip.value = camera.near;
    bokehShader.uniforms.farClip.value = camera.far;
  }

  pass({ renderer, read, write }: PassProps): void {
    renderer.setRenderTarget(write);
    renderer.clear();

    fsQuad.material = bokehShader;

    bokehShader.uniforms.src.value = read.texture;
    bokehShader.uniforms.aperture.value = this.aperture;
    bokehShader.uniforms.u_resolution.value.set(read.width, read.height)

    fsQuad.render(renderer);
  }
}
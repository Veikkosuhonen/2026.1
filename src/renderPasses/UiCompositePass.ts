import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { uiCompositeShader } from "../shaders/uiComposite";
import { fsQuad } from "./utils";

export class UiCompositePass extends RenderPass {

  uiBuffer: THREE.Texture;

  constructor(uiBuffer: THREE.Texture) {
    super("UiCompositePass")
    this.uiBuffer = uiBuffer;
  }

  pass({ renderer, read, write }: PassProps): void {
    renderer.setRenderTarget(write);

    fsQuad.material = uiCompositeShader;

    uiCompositeShader.uniforms.src.value = read.texture;
    uiCompositeShader.uniforms.uiTexture.value = this.uiBuffer;

    uiCompositeShader.uniforms.u_resolution.value.set(read.width, read.height)
    fsQuad.render(renderer);
  }
}
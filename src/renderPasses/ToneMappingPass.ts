import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { fsQuad } from "./utils";
import { ACESFilmicToneMappingShader } from "three/examples/jsm/Addons.js";

const toneMappingShader = new THREE.ShaderMaterial({
  name: ACESFilmicToneMappingShader.name,
  uniforms: THREE.UniformsUtils.clone(ACESFilmicToneMappingShader.uniforms),
  vertexShader: ACESFilmicToneMappingShader.vertexShader,
  fragmentShader: ACESFilmicToneMappingShader.fragmentShader,
});

export class ToneMappingPass extends RenderPass {
  exposure = 1.0;

  constructor() {
    super("ToneMappingPass");
  }

  pass({ renderer, read, write }: PassProps): void {
    fsQuad.material = toneMappingShader;

    toneMappingShader.uniforms.tDiffuse.value = read.texture;
    toneMappingShader.uniforms.exposure.value = this.exposure;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(write);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }

    fsQuad.render(renderer);
  }
}

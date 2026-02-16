import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { fsQuad } from "./utils";
import { bloomMixShader, downsampleShader, upsampleShader } from "../shaders/bloom";

export class BloomPass extends RenderPass {
  blurChain: THREE.WebGLRenderTarget[];
  bloomStrength;
  filterRadius;

  constructor(bloomStrength: number, filterRadius: number) {
    super("BloomPass");
    this.bloomStrength = bloomStrength;
    this.filterRadius = filterRadius;
    this.blurChain = [];

    let w = window.innerWidth;
    let h = window.innerHeight;

    const downscale = 5;

    for (let i = 0; i < downscale; i++) {
      w = Math.max(1, w / 2);
      h = Math.max(1, h / 2);

      const rt = new THREE.WebGLRenderTarget(w, h, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });

      this.blurChain.push(rt);
    }
  }

  pass({ renderer, read, write }: PassProps): void {
    renderer.setRenderTarget(this.blurChain[0]);
    renderer.clear();
  
    // Downsample
    fsQuad.material = downsampleShader;
    downsampleShader.uniforms.src.value = read.texture;
    downsampleShader.uniforms.u_resolution.value.set(this.blurChain[0].width, this.blurChain[0].height);
    fsQuad.render(renderer);

    for (let destIdx = 1; destIdx < this.blurChain.length; destIdx++) {
      const srcIdx = destIdx - 1;
      renderer.setRenderTarget(this.blurChain[destIdx]);
      renderer.clear();
      downsampleShader.uniforms.src.value = this.blurChain[srcIdx].texture;
      downsampleShader.uniforms.u_resolution.value.set(this.blurChain[destIdx].width, this.blurChain[destIdx].height);
      fsQuad.render(renderer);
    }

    // Upsample. Additively blend.
    fsQuad.material = upsampleShader;
    upsampleShader.uniforms.filterRadius.value = this.filterRadius;
    for (let i = this.blurChain.length - 2; i >= 0; i--) {
      renderer.setRenderTarget(this.blurChain[i]);
      renderer.clear();
      upsampleShader.uniforms.src.value = this.blurChain[i + 1].texture;
      upsampleShader.uniforms.u_resolution.value.set(this.blurChain[i].width, this.blurChain[i].height);
      fsQuad.render(renderer);
    }

    fsQuad.material = bloomMixShader;
    renderer.setRenderTarget(write);
    bloomMixShader.uniforms.src.value = read.texture;
    bloomMixShader.uniforms.bloom.value = this.blurChain[0].texture;
    bloomMixShader.uniforms.u_resolution.value.set(write.width, write.height);
    bloomMixShader.uniforms.bloomStrength.value = this.bloomStrength;
    fsQuad.render(renderer);
  }
}
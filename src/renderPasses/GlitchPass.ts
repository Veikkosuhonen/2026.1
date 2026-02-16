import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { glitchShader } from "../shaders/glitch";
import { fsQuad } from "./utils";

export class GlitchPass extends RenderPass {
  intensity = 0.5;
  scanlineIntensity = 0.05;
  colorShiftAmount = 0.01;
  lineShiftAmount = 0.1;
  bigShiftAmount = 0.3;
  noiseGrainIntensity = 0.06;

  private clock: THREE.Clock;

  constructor() {
    super("GlitchPass");
    this.clock = new THREE.Clock();
  }

  pass({ renderer, read, write }: PassProps): void {
    renderer.setRenderTarget(write);
    renderer.clear();

    fsQuad.material = glitchShader;

    glitchShader.uniforms.src.value = read.texture;
    glitchShader.uniforms.u_resolution.value.set(read.width, read.height);
    glitchShader.uniforms.u_time.value = this.clock.getElapsedTime();
    glitchShader.uniforms.intensity.value = this.intensity;
    glitchShader.uniforms.scanlineIntensity.value = this.scanlineIntensity;
    glitchShader.uniforms.colorShiftAmount.value = this.colorShiftAmount;
    glitchShader.uniforms.lineShiftAmount.value = this.lineShiftAmount;
    glitchShader.uniforms.bigShiftAmount.value = this.bigShiftAmount;
    glitchShader.uniforms.noiseGrainIntensity.value = this.noiseGrainIntensity;

    fsQuad.render(renderer);
  }
}

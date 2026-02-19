import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { lightningShader } from "../shaders";
import { lightningShaderInstanced } from "../shaders/lighting";

export class LightPass extends RenderPass {
  lightScene: THREE.Scene;
  camera: THREE.Camera;
  gBuffer: THREE.WebGLRenderTarget;
  lightBuffer: THREE.WebGLRenderTarget;

  constructor(
    lightScene: THREE.Scene,
    camera: THREE.Camera,
    gBuffer: THREE.WebGLRenderTarget,
    lightBuffer: THREE.WebGLRenderTarget,
  ) {
    super("LightVolumePass");
    this.needsSwap = false;
    this.lightScene = lightScene;
    this.camera = camera;
    this.gBuffer = gBuffer;
    this.lightBuffer = lightBuffer;

    lightningShader.uniforms.gColorAo.value = this.gBuffer.textures[0];
    lightningShaderInstanced.uniforms.gColorAo.value = this.gBuffer.textures[0];
    lightningShader.uniforms.gNormalRoughness.value = this.gBuffer.textures[1];
    lightningShaderInstanced.uniforms.gNormalRoughness.value =
      this.gBuffer.textures[1];
    lightningShader.uniforms.gPositionMetalness.value =
      this.gBuffer.textures[2];
    lightningShaderInstanced.uniforms.gPositionMetalness.value =
      this.gBuffer.textures[2];
    lightningShader.uniforms.u_resolution.value.set(
      window.innerWidth,
      window.innerHeight,
    );
    lightningShaderInstanced.uniforms.u_resolution.value.set(
      window.innerWidth,
      window.innerHeight,
    );
  }

  pass({ renderer }: PassProps) {
    renderer.setRenderTarget(this.lightBuffer);
    renderer.clear(true, true, false);

    // const t =  player.currentTime
    // const bpm = player.bpm;
    // const bps = bpm / 60;
    // const beat = Math.floor(2 * t * bps);
    // lightningShaderInstanced.uniforms.u_time.value = beat;

    renderer.render(this.lightScene, this.camera);
  }
}

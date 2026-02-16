import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { fsQuad } from "./utils";
import { skyShader } from "../shaders/procSky";

export class ProcSkyPass extends RenderPass {
  camera: THREE.Camera;
  exposure: number;
  gamma: number;
  fogAmount: number = 0.001;
  gBuffer: THREE.WebGLRenderTarget;

  constructor(
    gBuffer: THREE.WebGLRenderTarget,
    camera: THREE.PerspectiveCamera
  ) {
    super("SkyPass");
    this.gBuffer = gBuffer;
    this.camera = camera;
    this.exposure = 0.1;
    this.gamma = 2.2;
  }

  pass({ renderer, read, write }: PassProps): void {    
    renderer.setRenderTarget(write);
    
    skyShader.uniforms.src.value = read.texture;
    skyShader.uniforms.gPositionMetalness.value = this.gBuffer.textures[2];
    skyShader.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    skyShader.uniforms.inverseViewMatrix.value.copy(this.camera.matrixWorld);
    skyShader.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    skyShader.uniforms.exposure.value = this.exposure;
    skyShader.uniforms.gamma.value = this.gamma;
    skyShader.uniforms.fogAmount.value = this.fogAmount;
  
    fsQuad.material = skyShader;
    fsQuad.render(renderer);
  }
}

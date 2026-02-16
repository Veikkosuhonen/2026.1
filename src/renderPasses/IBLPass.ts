import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { iblShader } from "../shaders";
import { fsQuad } from "./utils";

export class IBLPass extends RenderPass {
  scene: THREE.Scene;
  camera: THREE.Camera;
  gBuffer: THREE.WebGLRenderTarget;
  lightBuffer: THREE.WebGLRenderTarget;
  constantAmbientLight: THREE.Color = new THREE.Color(0.1, 0.1, 0.1);
  irradianceIntensity: number = 1.0;
  iblGamma: number = 2.2;
  iblExposure: number = 1.0;

  constructor(scene: THREE.Scene, camera: THREE.Camera, 
    gBuffer: THREE.WebGLRenderTarget,
    lightBuffer: THREE.WebGLRenderTarget,
    ssaoTexture: THREE.Texture, 
    irradianceMap: THREE.Texture,
    prefilteredMap: THREE.Texture,
    brdfLUT: THREE.Texture,
  ) {
    super("IBLPass");
    this.needsSwap = false;
    this.scene = scene;
    this.camera = camera;
    this.gBuffer = gBuffer;
    this.lightBuffer = lightBuffer;
  
    iblShader.uniforms.gColorAo.value = this.gBuffer.textures[0];
    iblShader.uniforms.gNormalRoughness.value = this.gBuffer.textures[1];
    iblShader.uniforms.gPositionMetalness.value = this.gBuffer.textures[2];
    iblShader.uniforms.ssaoTexture.value = ssaoTexture;
    iblShader.uniforms.gEmission.value = this.gBuffer.textures[3];
    iblShader.uniforms.irradianceMap.value = irradianceMap;
    iblShader.uniforms.prefilterMap.value = prefilteredMap;
    iblShader.uniforms.brdfLUT.value = brdfLUT;
  }

  pass({ renderer }: PassProps): void {
    renderer.setRenderTarget(this.lightBuffer);
  
    iblShader.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    iblShader.uniforms.inverseViewMatrix.value.copy(this.camera.matrixWorld);

    iblShader.uniforms.u_constantAmbientLight.value.copy(this.constantAmbientLight);
    iblShader.uniforms.u_irradianceIntensity.value = this.irradianceIntensity
    iblShader.uniforms.exposure.value = this.iblExposure;
    iblShader.uniforms.gamma.value = this.iblGamma;

    fsQuad.material = iblShader;
    fsQuad.render(renderer);
  }
}
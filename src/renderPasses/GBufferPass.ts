import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { gBufferShaderVariants } from "../shaders/gbuffer";
import { bgCube } from "./utils";
import { skyGBufferShader } from "../shaders/skyGBuffer";

export class GBufferPass extends RenderPass {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  gBuffer: THREE.WebGLRenderTarget;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gBuffer: THREE.WebGLRenderTarget) {
    super("GBufferPass");
    this.scene = scene;
    this.camera = camera;
    this.gBuffer = gBuffer;
  }

  pass({ renderer }: PassProps) {
    renderer.setRenderTarget(this.gBuffer);
    renderer.clear(true, true, true);

    if (this.camera.userData.previousViewMatrix) {
      // console.log(this.camera.userData.previousViewMatrix)
      Object.values(gBufferShaderVariants).forEach((shader) => {
        // console.log(shader.uniforms)
        shader.uniforms.previousViewMatrix.value.copy(this.camera.userData.previousViewMatrix);
      })
    }

    renderer.render(this.scene, this.camera);

    // Render sky to gbuffer also
    bgCube.material = skyGBufferShader;
    skyGBufferShader.uniforms.previousViewMatrix.value.copy(this.camera.userData.previousViewMatrix);
    bgCube.position.copy(this.camera.position);
    bgCube.scale.set(this.camera.far, this.camera.far, this.camera.far);
    renderer.render(bgCube, this.camera);
  }
}

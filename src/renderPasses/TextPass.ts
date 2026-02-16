import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { gBufferShaderVariants } from "../shaders/gbuffer";
import { bgCube } from "./utils";
import { skyGBufferShader } from "../shaders/skyGBuffer";

export class TextPass extends RenderPass {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  textBuffer: THREE.WebGLRenderTarget;

  constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera, textBuffer: THREE.WebGLRenderTarget) {
    super("GBufferPass");
    this.scene = scene;
    this.camera = camera;
    this.textBuffer = textBuffer;
  }

  pass({ renderer }: PassProps) {
    renderer.setRenderTarget(this.textBuffer);
    
    renderer.setClearColor(0x000000, 1.0);
    renderer.clear(true, true, true);
    renderer.setClearColor(0x000000, 1.0);

    renderer.render(this.scene, this.camera);
  }
}

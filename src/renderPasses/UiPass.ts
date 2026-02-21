import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";

export class UiPass extends RenderPass {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  uiBuffer: THREE.WebGLRenderTarget;

  constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera, uiBuffer: THREE.WebGLRenderTarget) {
    super("UiPass");
    this.scene = scene;
    this.camera = camera;
    this.uiBuffer = uiBuffer;
  }

  pass({ renderer }: PassProps) {
    renderer.setRenderTarget(this.uiBuffer);
    renderer.setClearColor(new THREE.Color(0xff00ff), 0.0);
    renderer.clear();
    // renderer.setClearColor(new THREE.Color(0x000000));
    renderer.render(this.scene, this.camera);
  }
}

import { ISheet } from "@theatre/core";
import * as THREE from "three";
import { Entity } from "./common/entity";
import { MATRIX } from "./math";
import { setupTextCamera } from "./textCamera";
import { AudioManager } from "./audio";

export class GameState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene = new THREE.Scene();
  lights: THREE.Scene = new THREE.Scene();
  texts: THREE.Scene = new THREE.Scene();
  entities: Entity[] = [];
  mainCamera: THREE.PerspectiveCamera;
  textCamera: THREE.PerspectiveCamera;
  uiCamera: THREE.OrthographicCamera;
  sheet: ISheet;
  loadingManager: THREE.LoadingManager;
  audio: AudioManager | null = null;

  onRenders: (() => void)[] = [];

  constructor(renderer: THREE.WebGLRenderer, mainCamera: THREE.PerspectiveCamera, sheet: ISheet, loadingManager: THREE.LoadingManager) {
    this.renderer = renderer
    this.mainCamera = mainCamera
    this.textCamera = setupTextCamera(mainCamera);
    this.sheet = sheet;
    this.loadingManager = loadingManager
    this.uiCamera = new THREE.OrthographicCamera()
  }

  update(deltaTime: number) {
    this.entities.forEach(entity => entity.update(deltaTime))
  }

  addRenderListener(callback: () => void) {
    this.onRenders.push(callback);
  }

  onRender() {
    this.onRenders.forEach(callback => callback());
  }
}

import * as THREE from 'three'
import Stats from "three/examples/jsm/libs/stats.module.js";
import { setupScene } from './scene';
import { MapControls, FirstPersonControls, FlyControls, PointerLockControls } from 'three/examples/jsm/Addons.js';
import studio from '@theatre/studio'
import { getProject, ISheet } from '@theatre/core'
import { GameState } from './gameState';
// import { createLines } from './lineRenderer';
import theatreProject from "./demo project.theatre-project-state.json";
import { setupPipeline } from './pipeline';
import { Profiler } from './profiler';
import { CameraControls } from './utils/CameraControls';
import { audioManager, AudioManager } from './audio';

export const loadingManager = new THREE.LoadingManager();
export let onLoaded: () => void;

export const start = async (canvas: HTMLCanvasElement) => {
  studio.initialize();
  const project = getProject("demo project", { state: theatreProject });
  const sheet = project.sheet("demo sheet");

  const renderer = setupRenderer(canvas);
  const camera = setupCamera(sheet);
  const gameState = new GameState(renderer, camera, sheet, loadingManager);

  setupScene(gameState)

  const stats = setupStats();

  // const debugLines = createLines();
  const clock = new THREE.Clock();
  const controls = setupControls(gameState.mainCamera, renderer);
  if (restoreCameraState(gameState.mainCamera)) {
    (controls as any)._setOrientation();
  }

  const pipeline = await setupPipeline(gameState)

  let frameSinceLastSave = 0;
  const animate = () => {

    stats.begin();

    controls.update(clock.getDelta())

    if (++frameSinceLastSave >= 30) {
      frameSinceLastSave = 0;
      saveCameraState(gameState.mainCamera);
    }

    gameState.onRender();
    pipeline.render();
    gameState.mainCamera.userData.previousViewMatrix.copy(gameState.mainCamera.matrixWorldInverse);
    stats.end();
  }

  gameState.audio = audioManager;
  audioManager.load('./Assembly.mp3').then(() => {
    // audioManager.play().catch(err => console.error('Failed to play audio:', err));
  }).catch(err => {
    console.error('Failed to load audio:', err);
  });

  setInterval(() => {
    gameState.update(1 / 20);
  }, 1 / 20)

  renderer.setAnimationLoop(animate);
}

const setupRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({ 
    canvas,
    powerPreference: 'high-performance',
    antialias: false,
    depth: true,
    stencil: true,
    logarithmicDepthBuffer: true,
    precision: 'highp',
  });
  renderer.autoClear = false;
  renderer.autoClearStencil = false;
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}

const setupCamera = (sheet: ISheet) => {
  const fowY = 70;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 10_000;
  const camera = new THREE.PerspectiveCamera(fowY, aspect, near, far);

  camera.userData.halfSizeNearPlane = new THREE.Vector2(
    Math.tan(fowY) / 2.0 * aspect,
    Math.tan(fowY) / 2.0
  );

  camera.userData.previousViewMatrix = new THREE.Matrix4();

  return camera;
}

const setupControls = (camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
  const controls = new CameraControls(camera, renderer.domElement as any);
  controls.lookSpeed = 0.5;
  controls.movementSpeed = 20.0;
  // controls.autoRotate = true;
  // controls.autoRotateSpeed = 0.1;
  // controls.enableDamping = true;
  // controls.movementSpeed = 2;
  // controls.rollSpeed = 0.05;
  return controls;
}

const setupStats = () => {
  const stats = new Stats();
  stats.dom.style.position = 'absolute';
  stats.dom.style.top = "90vh";
  document.body.appendChild(stats.dom);
  return stats;
}

const CAMERA_STATE_KEY = 'cameraState_v1';

const saveCameraState = (camera: THREE.PerspectiveCamera) => {
  try {
    const state = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      qx: camera.quaternion.x,
      qy: camera.quaternion.y,
      qz: camera.quaternion.z,
      qw: camera.quaternion.w,
    };
    sessionStorage.setItem(CAMERA_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
};

const defaultCameraState = {"px":-26.133915762759354,"py":90.34499462273358,"pz":78.50436256983615,"qx":-0.23491267802517207,"qy":-0.7000189314766068,"qz":-0.26521344858159673,"qw":0.6200414147207011};

const restoreCameraState = (camera: THREE.PerspectiveCamera): boolean => {
  try {
    const raw = sessionStorage.getItem(CAMERA_STATE_KEY);
    let s = raw ? JSON.parse(raw) : defaultCameraState;
    if (typeof s.px !== 'number') return false;
    camera.position.set(s.px, s.py, s.pz);
    camera.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    return true;
  } catch {
    return false;
  }
};
import * as THREE from 'three'
import Stats from "three/examples/jsm/libs/stats.module.js";
import { setupScene } from './scene';
import studio from '@theatre/studio'
import { getProject, ISheet } from '@theatre/core'
import { GameState } from './gameState';
import theatreProject from "./finalestest.theatre-project-state.json";
import { setupPipeline } from './pipeline';
import { CameraControls } from './utils/CameraControls';
import { audioManager, AudioManager } from './audio';
import { connectCameraToTheatre, addCameraKeyframe, connectCameraFollowToTheatre, CameraFollowController, connectShaderToTheatre } from './theatreThree';
import { solidstateMaterialInstanced } from './materials/solidstate';
import { datalakeMaterial, datalakeMaterialInstanced } from './materials/datalake';
import { setupUI } from './arctic/ui';
import { setSheet } from './sequence';

export const loadingManager = new THREE.LoadingManager();
export let onLoaded: () => void;

export const start = async (canvas: HTMLCanvasElement) => {
  const DEV = import.meta.env.DEV;
  if (DEV) {
    studio.initialize();
  }
  const project = getProject("final", { state: theatreProject });
  const sheet = project.sheet("demo sheet");
  setSheet(sheet);

  console.log(sheet)

  const renderer = setupRenderer(canvas);
  const camera = setupCamera();
  const gameState = new GameState(renderer, camera, sheet, loadingManager);

  setupScene(gameState)

  // const stats = setupStats();

  // const debugLines = createLines();
  const clock = new THREE.Clock();
  const controls = setupControls(gameState.mainCamera, renderer);
  if (DEV && restoreCameraState(gameState.mainCamera)) {
    (controls as any)._setOrientation();
  }

  // Connect camera to Theatre.js after controls exist, so rotation sync works
  const cameraTheatreObj = connectCameraToTheatre(camera, sheet, controls);
  camera.userData.theatreObj = cameraTheatreObj;

  // Camera follow mode – follows a light entity boid
  let cameraFollow: CameraFollowController | null = null;
  if (gameState.lightEntity) {
    cameraFollow = connectCameraFollowToTheatre(camera, sheet, gameState.lightEntity);
  }

  connectMaterialsToTheatre(sheet);

  setupUI(gameState);

  const pipeline = await setupPipeline(gameState)
  
  // Press K to add a keyframe at the current sequence position with the camera's current transform
  if (DEV) window.addEventListener('keydown', (e) => {
    if (e.key === 'k' || e.key === 'K') {
      addCameraKeyframe(gameState.mainCamera, gameState.mainCamera.userData.theatreObj, sheet);
    }
  });

  let frameSinceLastSave = 0;
  const animate = () => {

    // stats.begin();

    const delta = clock.getDelta();

    // Skip manual controls when camera follow is active
    if (!cameraFollow?.enabled) {
      controls.update(delta);
    }

    if (DEV && (++frameSinceLastSave >= 30)) {
      frameSinceLastSave = 0;
      saveCameraState(gameState.mainCamera);
    }

    gameState.update(delta * 10.0);

    // Update camera follow after entities so boid positions are fresh
    cameraFollow?.update(delta);

    gameState.onRender();
    pipeline.render();
    gameState.mainCamera.userData.previousViewMatrix.copy(gameState.mainCamera.matrixWorldInverse);
    // stats.end();
  }

  gameState.audio = audioManager;
  audioManager.attachToSequence(sheet.sequence, './Assembly.mp3').then(() => {
    if (!DEV) 
      audioManager.play({ iterationCount: 1 });
  }).catch(err => {
    console.error('Failed to attach audio:', err);
  });

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

const setupCamera = () => {
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

const connectMaterialsToTheatre = (sheet: ISheet) => {
  connectShaderToTheatre(datalakeMaterial, ['u_glow'], sheet, 'SolidState Material');
  connectShaderToTheatre(datalakeMaterialInstanced, ['u_glow'], sheet, 'SolidState Material');
}
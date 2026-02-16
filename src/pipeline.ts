import * as THREE from "three";
import {
  ACESFilmicToneMappingShader,
  EffectComposer,
  RGBELoader,
  ShaderPass,
} from "three/examples/jsm/Addons.js";
import { BloomPass } from "./renderPasses/BloomPass";
import { BokehPass } from "./renderPasses/BokehPass";
import { GBufferPass } from "./renderPasses/GBufferPass";
import { IBLPass } from "./renderPasses/IBLPass";
import { LightPass } from "./renderPasses/LightPass";
import { SavePass } from "./renderPasses/SavePass";
import { SkyPass } from "./renderPasses/SkyPass";
import { SSAOPass } from "./renderPasses/SSAOPass";
import { SSRPass } from "./renderPasses/SSRPass";
import { TexturePass } from "./renderPasses/TexturePass";
import { RenderPass } from "./renderPasses/RenderPass";
import {
  cubeToIrradiance,
  equirectToCube,
  equirectToPrefilter,
  generateBrdfLUT,
} from "./envMaps";
import { connectPassToTheatre } from "./theatreThree";
import { GameState } from "./gameState";
import { DebugPass } from "./renderPasses/DebugPass";
import { FogPass } from "./renderPasses/FogPass";
import { MotionBlurPass } from "./renderPasses/MotionBlurPass";
import { TextPass } from "./renderPasses/TextPass";
import { buildingMaterial } from "./materials/building";
import { lightningShader } from "./shaders";
import { lampMaterial } from "./materials/lamp";
import { lightningShaderInstanced } from "./shaders/lighting";
import { ProcSkyPass } from "./renderPasses/ProcSkyPass";
import { GlitchPass } from "./renderPasses/GlitchPass";

export const setupPipeline = async (game: GameState) => {
  const depthStencilTexture = setupDepthStencilTexture();
  const gBuffer = setupGBuffer(depthStencilTexture);
  const lightBuffer = setupLightBuffer(depthStencilTexture);
  const textBuffer = setupTextBuffer();
  const brdfLUT = generateBrdfLUT(game.renderer);

  const composer = setupComposer(game.renderer, depthStencilTexture);

  const savePass = new SavePass(gBuffer.width, gBuffer.height);

  composer.addPass(new TextPass(game.texts, game.uiCamera, textBuffer))

  composer.addPass(new GBufferPass(game.scene, game.mainCamera, gBuffer));

  const ssaoPass = new SSAOPass(gBuffer, game.mainCamera);
  composer.addPass(ssaoPass);

  const lightingPass = new LightPass(
    game.lights,
    game.mainCamera,
    game.textCamera,
    gBuffer,
    lightBuffer,
  );
  composer.addPass(lightingPass);

  const iblPass = new IBLPass(
    game.scene,
    game.mainCamera,
    gBuffer,
    lightBuffer,
    ssaoPass.ssaoBuffer.texture,
    brdfLUT,
  )
  composer.addPass(iblPass);

  composer.addPass(
    new TexturePass("IBL Diffuse output", lightBuffer.textures[0]),
  );

  composer.addPass(new ProcSkyPass(gBuffer, game.mainCamera));

  const ssrPass = new SSRPass(
    gBuffer,
    game.mainCamera,
    savePass.buffer.texture,
    lightBuffer.textures[1],
    brdfLUT,
  );
  composer.addPass(ssrPass);

  // composer.addPass(new FogPass(gBuffer, game.mainCamera));

  composer.addPass(savePass);

  // composer.addPass(new BokehPass(gBuffer, game.mainCamera));

  const bloomPass = new BloomPass(0.1, 0.005);
  // composer.addPass(bloomPass);
  // composer.addPass(new DebugPass(lightBuffer.textures[0]));

  const glitchPass = new GlitchPass()
  composer.addPass(glitchPass);

  composer.addPass(new ShaderPass(ACESFilmicToneMappingShader));

  composer.passes.forEach((pass) =>
    connectPassToTheatre(pass as RenderPass, game.sheet),
  );

  return composer;
};

const setupDepthStencilTexture = () => {
  const depthStencilTexture = new THREE.DepthTexture(
    window.innerWidth,
    window.innerHeight,
    THREE.UnsignedInt248Type,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.NearestFilter,
    1,
    THREE.DepthStencilFormat,
  );

  return depthStencilTexture;
};

/**
 * gBuffer is a render target that stores the following information:
 * 0: Color + Ambient Occlusion
 * 1: Normal + Roughness
 * 2: Position + Metalness
 * 3: Emission
 * 4: Velocity
 */
const setupGBuffer = (depthTexture: THREE.DepthTexture) => {
  const gBuffer = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      count: 5,
      depthBuffer: true,
      stencilBuffer: true,
      depthTexture,
    },
  );

  return gBuffer;
};

const setupLightBuffer = (depthTexture: THREE.DepthTexture) => {
  const lightBuffer = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      count: 2,
      depthBuffer: true,
      stencilBuffer: true,
      depthTexture,
    },
  );

  return lightBuffer;
};

const setupTextBuffer = () => {
  const textBuffer = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      count: 1,
    },
  );

  buildingMaterial.uniforms.uiTexture.value = textBuffer.texture;
  lightningShaderInstanced.uniforms.uiTexture.value = textBuffer.texture;
  lampMaterial.uniforms.uiTexture.value = textBuffer.texture;

  return textBuffer;
};

const setupComposer = (
  renderer: THREE.WebGLRenderer,
  depthStencilTexture: THREE.DepthTexture,
) => {
  const rt = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      stencilBuffer: true,
      depthBuffer: true,
      depthTexture: depthStencilTexture,
      type: THREE.HalfFloatType,
    },
  );
  const composer = new EffectComposer(renderer, rt);
  return composer;
};

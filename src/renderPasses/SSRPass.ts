import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { blur4xShader } from "../shaders";
import { fsQuad } from "./utils";
import { ssrResolveShader, ssrShader } from "../shaders/ssr2";

export class SSRPass extends RenderPass {
  gBuffer: THREE.WebGLRenderTarget;
  ssrBuffer: THREE.WebGLRenderTarget;
  blurBuffer: THREE.WebGLRenderTarget;
  camera: THREE.Camera;

  constructor(gBuffer: THREE.WebGLRenderTarget, camera: THREE.Camera, reflectionSource: THREE.Texture, specularSource: THREE.Texture, brdfLUT: THREE.Texture) {
    super("SSRPass");
    this.needsSwap = false;
    this.gBuffer = gBuffer;
  
    this.ssrBuffer = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthTexture: gBuffer.depthTexture,
    });

    this.blurBuffer = new THREE.WebGLRenderTarget(window.innerWidth/2, window.innerHeight/2, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.camera = camera;
    
    ssrShader.uniforms.reflectionSource.value = reflectionSource;
    ssrShader.uniforms.gColorAo.value = this.gBuffer.textures[0];
    ssrShader.uniforms.gNormalRoughness.value = this.gBuffer.textures[1];
    ssrShader.uniforms.gPositionMetalness.value = this.gBuffer.textures[2];
    ssrShader.uniforms.velocity.value = this.gBuffer.textures[4];
    ssrShader.uniforms.brdfLUT.value = brdfLUT;

    ssrResolveShader.uniforms.ssr.value = this.ssrBuffer.texture;
    ssrResolveShader.uniforms.specular.value = specularSource
  }

  pass({ renderer, read }: PassProps): void {
    // Generate SSR
    renderer.setRenderTarget(this.ssrBuffer);
    renderer.clear(true, true, false);
    ssrShader.uniforms.resolution.value.set(this.ssrBuffer.width, this.ssrBuffer.height);
    ssrShader.uniforms.projection.value.copy(this.camera.projectionMatrix);
    ssrShader.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    ssrShader.uniforms.u_time.value = performance.now() / 1000;
    fsQuad.material = ssrShader;
    fsQuad.render(renderer);

    // Blur SSR
    renderer.setRenderTarget(this.blurBuffer);
    blur4xShader.uniforms.src.value = this.ssrBuffer.texture;
    blur4xShader.uniforms.u_resolution.value.set(this.blurBuffer.width, this.blurBuffer.height);
    fsQuad.material = blur4xShader;
    fsQuad.render(renderer);

    // Blur again
    renderer.setRenderTarget(this.ssrBuffer);
    blur4xShader.uniforms.src.value = this.blurBuffer.texture;
    blur4xShader.uniforms.u_resolution.value.set(this.ssrBuffer.width, this.ssrBuffer.height);
    fsQuad.material = blur4xShader;
    fsQuad.render(renderer);

    // Resolve specular reflections
    renderer.setRenderTarget(read);
    ssrResolveShader.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    fsQuad.material = ssrResolveShader;
    fsQuad.render(renderer);
  }
}
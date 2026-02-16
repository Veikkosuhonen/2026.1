import * as THREE from "three";
import { PassProps, RenderPass } from "./RenderPass";
import { blur4xShader, ssaoShader } from "../shaders";
import { fsQuad } from "./utils";


export class SSAOPass extends RenderPass {
  gBuffer: THREE.WebGLRenderTarget;
  ssaoBuffer: THREE.WebGLRenderTarget;
  ssaoBuffer2: THREE.WebGLRenderTarget;
  camera: THREE.Camera;
  noiseTexture: THREE.DataTexture;
  ssaoKernel: Float32Array;
  KERNEL_SIZE = 32;
  SCALE = 1;

  constructor(gBuffer: THREE.WebGLRenderTarget, camera: THREE.Camera) {
    super("SSAOPass");
    this.gBuffer = gBuffer;
    this.ssaoBuffer = new THREE.WebGLRenderTarget(window.innerWidth * this.SCALE, window.innerHeight * this.SCALE, {
      format: THREE.RedFormat,
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.ssaoBuffer2 = new THREE.WebGLRenderTarget(window.innerWidth * this.SCALE, window.innerHeight * this.SCALE, {
      format: THREE.RedFormat,
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    this.camera = camera;

    this.noiseTexture = new THREE.DataTexture(
      new Float32Array(12 * 12 * 4), 12, 12,
      THREE.RGBAFormat, THREE.FloatType, 
      THREE.Texture.DEFAULT_MAPPING, 
      THREE.RepeatWrapping, 
      THREE.RepeatWrapping, 
      THREE.NearestFilter,
      THREE.NearestFilter
    );
    // Fill noise texture with random values
    for (let i = 0; i < 12 * 12; i++) {
      this.noiseTexture.image.data[4 * i    ] = Math.random() * 2 - 1;
      this.noiseTexture.image.data[4 * i + 1] = Math.random() * 2 - 1;
      this.noiseTexture.image.data[4 * i + 2] = 0;
      this.noiseTexture.image.data[4 * i + 3] = 0;
    }

    this.noiseTexture.needsUpdate = true;

    // Fill ssao kernel with random values
    this.ssaoKernel = new Float32Array(this.KERNEL_SIZE * 3);

    for (let i = 0; i < this.KERNEL_SIZE; i++) {
      const sample = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random()
      );
      sample.normalize();
      sample.multiplyScalar(Math.random());
      let scale = i / this.KERNEL_SIZE;
      scale = 0.1 + scale * scale * (1 - 0.1); // lerp(0.1f, 1.0f, scale * scale);
      sample.multiplyScalar(scale);
      this.ssaoKernel[i * 3    ] = sample.x;
      this.ssaoKernel[i * 3 + 1] = sample.y;
      this.ssaoKernel[i * 3 + 2] = sample.z;
    }

    ssaoShader.uniforms.gColorAo.value = this.gBuffer.textures[0];
    ssaoShader.uniforms.gNormalRoughness.value = this.gBuffer.textures[1];
    ssaoShader.uniforms.gPositionMetalness.value = this.gBuffer.textures[2];
    ssaoShader.uniforms.noiseTexture.value = this.noiseTexture;
    ssaoShader.uniforms.ssaoKernel.value = this.ssaoKernel;
  }

  pass({ renderer }: PassProps): void {
    renderer.setRenderTarget(this.ssaoBuffer2);
    ssaoShader.uniforms.u_resolution.value.set(window.innerWidth * this.SCALE, window.innerHeight * this.SCALE);
    ssaoShader.uniforms.projection.value.copy(this.camera.projectionMatrix);
    fsQuad.material = ssaoShader;
    fsQuad.render(renderer);

    renderer.setRenderTarget(this.ssaoBuffer);
    blur4xShader.uniforms.u_resolution.value.set(window.innerWidth * this.SCALE, window.innerHeight * this.SCALE);
    blur4xShader.uniforms.src.value = this.ssaoBuffer2.texture;
    fsQuad.material = blur4xShader;
    fsQuad.render(renderer);
  }
}
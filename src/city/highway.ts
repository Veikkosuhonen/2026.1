import * as THREE from "three";
import { lampPost } from "../common/objects";
import { highwayMaterial } from "../materials/highway";
import {
  HIGHWAY_THICKNESS,
  HIGHWAY_WIDTH,
  RAIL_WIDTH,
  RAILWAY_WIDTH,
} from "./constants";

const HIGHWAY_STEP = 200;

export class HighwayPoint extends THREE.Vector2 {
  bridgeHeight: number;
  constructor(x: number, y: number, bridgeHeight: number) {
    super(x, y);
    this.bridgeHeight = bridgeHeight;
  }
}

export const generateHighway = (
  width: number,
  height: number,
  direction: THREE.Vector2 = new THREE.Vector2(1, 0),
) => {
  const dir = direction.clone().normalize();
  const path: THREE.Vector3[] = [];
  const currentPos = new THREE.Vector2(width / 2, height / 2);
  currentPos.multiply({
    x: dir.y,
    y: dir.x,
  });

  do {
    path.push(new THREE.Vector3(currentPos.x, 0, currentPos.y));

    const offset = dir.clone().multiplyScalar(HIGHWAY_STEP);

    currentPos.add(offset);

    const angleChange = ((1.5 * Math.PI) / 2) * (Math.random() - 0.5);
    dir.rotateAround(new THREE.Vector2(0, 0), angleChange);

    if (dir.angleTo(direction) > Math.PI / 4) {
      dir.rotateAround(new THREE.Vector2(0, 0), -2 * angleChange);
    }
  } while (
    currentPos.x <= width &&
    currentPos.y <= height &&
    currentPos.y >= 0 &&
    currentPos.x >= 0
  );

  const spline = new THREE.CatmullRomCurve3(path);

  const obj = new THREE.Object3D();

  const numLamps = spline.getLength() / 20;
  // for (let i = 0; i < numLamps; i++) {
  //   const pos = spline.getPointAt(i / numLamps);
  //   const t = spline.getTangent(i / numLamps);
  //   const left = new THREE.Vector3(-t.z, 0, t.x);
// 
  //   const l1 = lampPost();
  //   const pos1 = pos
  //     .clone()
  //     .add(left.clone().multiplyScalar(HIGHWAY_WIDTH * 0.9));
  //   const l2 = lampPost();
  //   const pos2 = pos
  //     .clone()
  //     .add(left.clone().multiplyScalar(-HIGHWAY_WIDTH * 0.9));
  //   l1.position.copy(pos1);
  //   l2.position.copy(pos2);
  //   obj.add(l1);
  //   obj.add(l2);
  // }

  const shape = new THREE.Shape([
    new THREE.Vector2(HIGHWAY_THICKNESS, -HIGHWAY_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS, -HIGHWAY_WIDTH),

    new THREE.Vector2(-HIGHWAY_THICKNESS, -RAILWAY_WIDTH - RAIL_WIDTH * 4),
    new THREE.Vector2(
      -HIGHWAY_THICKNESS - 0.1,
      -RAILWAY_WIDTH - RAIL_WIDTH * 4,
    ),

    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.1, -RAILWAY_WIDTH - RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.4, -RAILWAY_WIDTH - RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.4, -RAILWAY_WIDTH + RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.1, -RAILWAY_WIDTH + RAIL_WIDTH),

    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.1, RAILWAY_WIDTH - RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.4, RAILWAY_WIDTH - RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.4, RAILWAY_WIDTH + RAIL_WIDTH),
    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.1, RAILWAY_WIDTH + RAIL_WIDTH),

    new THREE.Vector2(-HIGHWAY_THICKNESS - 0.1, RAILWAY_WIDTH + RAIL_WIDTH * 4),
    new THREE.Vector2(-HIGHWAY_THICKNESS, RAILWAY_WIDTH + RAIL_WIDTH * 4),

    new THREE.Vector2(-HIGHWAY_THICKNESS, HIGHWAY_WIDTH),
    new THREE.Vector2(HIGHWAY_THICKNESS, HIGHWAY_WIDTH),
  ]);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    extrudePath: spline,
    steps: 200,
  });

  obj.add(new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial()));

  return {
    obj,
    path: spline,
  };
};

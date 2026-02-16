import * as THREE from "three";
import { CityBlock } from "./CityBlock";
import { Road } from "./Road";
import {
  BUILDING_SIZE,
  LANE_WIDTH,
  SIDEWALK_WIDTH_PER_LANE,
  HIGHWAY_WIDTH,
} from "./constants";
import { getHighwayPoints } from "./utils";
import { HighwayPoint } from "./highway";

export const generate = (
  width: number,
  height: number,
  highways: THREE.CatmullRomCurve3[],
) => {
  const elements: Array<Road | CityBlock> = [];

  const rootBlock = new CityBlock(
    new THREE.Vector2(0, 0),
    new THREE.Vector2(width, height),
    8,
  );

  const ROTATE_90 = new THREE.Euler(0, Math.PI / 2, 0);
  rootBlock.highwayPoints = highways.flatMap((path) => {
    const points: HighwayPoint[] = [];
    for (let i = 0; i < 150; i++) {
      const t = i / 150;
      const p = path.getPoint(t);
      // const n = path
      //   .getTangent(t)
      //   .applyEuler(ROTATE_90)
      //   .multiplyScalar(HIGHWAY_WIDTH * 0.8);
      // const p1 = p.clone().add(n);
      // const p2 = p.clone().sub(n);
      points.push(
        new HighwayPoint(p.x, p.z, p.y),
        // new HighwayPoint(p2.x, p2.z, p2.y),
      );
    }
    return getHighwayPoints(points, rootBlock);
  });

  const queue: CityBlock[] = [rootBlock];

  while (queue.length > 0) {
    const block = queue.shift()!;
    const width = block.bottomRight.x - block.topLeft.x;
    const height = block.bottomRight.y - block.topLeft.y;

    const currentSidewalkWidth = SIDEWALK_WIDTH_PER_LANE * block.lanes;

    const minSlotsW = 2 + Math.floor(Math.random() * 2.5);
    const minSlotsH = 2 + Math.floor(Math.random() * 2.5);
    const minBlockW =
      minSlotsW * BUILDING_SIZE +
      block.lanes * LANE_WIDTH +
      currentSidewalkWidth;
    const minBlockH =
      minSlotsH * BUILDING_SIZE +
      block.lanes * LANE_WIDTH +
      currentSidewalkWidth;

    const newLanes = Math.max(2, block.lanes - 2);
    const roadWidth = newLanes * LANE_WIDTH;

    // Pick a weighted random direction to split the block
    const canSplitVertical = width / 2 > minBlockW;
    const canSplitHorizontal = height / 2 > minBlockH;
    const rndVertical = Math.random() * width * (canSplitVertical ? 1 : 0);
    const rndHorizontal = Math.random() * height * (canSplitHorizontal ? 1 : 0);

    if (rndVertical > rndHorizontal && canSplitVertical) {
      // Split vertically
      const split = 0.5 * width;
      const road = new Road(
        new THREE.Vector2(block.topLeft.x + split, block.topLeft.y),
        new THREE.Vector2(block.topLeft.x + split, block.bottomRight.y),
        newLanes,
        new THREE.Vector2(0, 1),
      );

      elements.push(road);

      const left = new CityBlock(
        block.topLeft,
        new THREE.Vector2(
          block.topLeft.x + split - roadWidth / 2,
          block.bottomRight.y,
        ),
        newLanes,
      );

      left.left = block.left;
      left.top = block.top;
      left.right = road;
      left.bottom = block.bottom;

      left.highwayPoints = getHighwayPoints(block.highwayPoints, left);

      const right = new CityBlock(
        new THREE.Vector2(
          block.topLeft.x + split + roadWidth / 2,
          block.topLeft.y,
        ),
        block.bottomRight,
        newLanes,
      );

      right.left = road;
      right.top = block.top;
      right.right = block.right;
      right.bottom = block.bottom;

      right.highwayPoints = getHighwayPoints(block.highwayPoints, right);

      queue.push(left, right);
    } else if (canSplitHorizontal) {
      // Split horizontally
      const split = 0.5 * height;

      const road = new Road(
        new THREE.Vector2(block.topLeft.x, block.topLeft.y + split),
        new THREE.Vector2(block.bottomRight.x, block.topLeft.y + split),
        newLanes,
        new THREE.Vector2(1, 0),
      );

      elements.push(road);

      const top = new CityBlock(
        block.topLeft,
        new THREE.Vector2(
          block.bottomRight.x,
          block.topLeft.y + split - roadWidth / 2,
        ),
        newLanes,
      );

      top.left = block.left;
      top.top = block.top;
      top.right = block.right;
      top.bottom = road;

      top.highwayPoints = getHighwayPoints(block.highwayPoints, top);

      const bottom = new CityBlock(
        new THREE.Vector2(
          block.topLeft.x,
          block.topLeft.y + split + roadWidth / 2,
        ),
        block.bottomRight,
        newLanes,
      );

      bottom.left = block.left;
      bottom.top = road;
      bottom.right = block.right;
      bottom.bottom = block.bottom;

      bottom.highwayPoints = getHighwayPoints(block.highwayPoints, bottom);

      queue.push(top, bottom);
    } else {
      elements.push(block);
    }
  }

  return elements;
};

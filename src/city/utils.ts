import * as THREE from "three";
import { CityBlock } from "./CityBlock";
import { HighwayPoint } from "./highway";
import { HIGHWAY_WIDTH } from "./constants";

export const getHighwayPoints = (points: HighwayPoint[], block: CityBlock) => {
  return points.filter(
    (p) => rectangleSDF(block.topLeft, block.bottomRight, p) < HIGHWAY_WIDTH,
  );
};

export const rectangleSDF = (
  topLeft: THREE.Vector2,
  bottomRight: THREE.Vector2,
  point: THREE.Vector2,
): number => {
  const dx = Math.max(topLeft.x - point.x, point.x - bottomRight.x);
  const dy = Math.max(topLeft.y - point.y, point.y - bottomRight.y);
  return Math.max(dx, dy);
};

function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

const rnd = sfc32(123, 456, 789, 101112);

export const random = () => {
  return rnd();
}
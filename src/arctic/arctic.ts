import * as THREE from "three";
import { Shard } from "./shard";

export const generate = (
  width: number,
  height: number,
) => {
  const elements: Array<Shard> = [];

  for (let i = 0; i < 20; i++) {
    const x1 = Math.random() * width;
    const y1 = 10.0 + Math.random() * height;
    const x2 = x1 + 5 + Math.random() * 20;
    const y2 = y1 + 5 + Math.random() * 20;

    elements.push(new Shard(
      new THREE.Vector2(x1, y1),
      new THREE.Vector2(x2, y2),
    ));
  }
  
  return elements;
};

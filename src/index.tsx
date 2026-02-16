import "./index.css";
import { exit } from '@tauri-apps/plugin-process';

Math.random = random

import { start } from "./game";
import { random } from "./city/utils";

// addEventListener("keydown", async (event) => {
//   console.log("Key pressed:", event.key);
//   if (event.key === "Escape") {
//     console.log("Exiting game...");
//     await exit(0);
//   }
// })

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

if (canvas) {
  start(canvas);
}

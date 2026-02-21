import * as THREE from "three";
import { GameState } from "~/gameState";
import {Text} from 'troika-three-text'
import { connectObjectVisibilityToTheatre } from "~/theatreThree";
import { Entity } from "~/common/entity";

export const setupUI = (gameState: GameState) => {
  // addText(gameState, "2026.1", new THREE.Vector3(0, 0, -2));

  // End of the world text (???)

  addText(gameState, "Mehu",              new THREE.Vector3(-0.4, 0.8, -4), 0.2);
  addText(gameState, "badfelix",          new THREE.Vector3(-0.3, 0.6, -4), 0.2);
  addText(gameState, "cr!sp",             new THREE.Vector3(-0.2, 0.4, -4), 0.2);
  addText(gameState, "Extend",            new THREE.Vector3(-0.25, 0.2, -4), 0.2);
  addText(gameState, "JML",               new THREE.Vector3(-0.1, 0.0, -4), 0.2);
  addText(gameState, "Navetan demoskene", new THREE.Vector3( 0.0, -0.2, -4), 0.2);
  addText(gameState, "Toska",             new THREE.Vector3( 0.1, -0.4, -4), 0.2);
  addText(gameState, "Graffat ON",        new THREE.Vector3( 0.2, -0.6, -4), 0.2);

  addText(gameState, "Code", new THREE.Vector3(-0.9, 0.9, -4), 0.1);
  addText(gameState, "ZyL", new THREE.Vector3(-0.5, 0.65, -4), 0.3);
  addText(gameState, "Music", new THREE.Vector3(-0.9, -0.0, -4), 0.1);
  addText(gameState, "JayZSteP", new THREE.Vector3(-0.5, -0.15, -4), 0.3);

  addText(gameState, "a demo by Acuals", new THREE.Vector3(-0.9, -0.6, -4), 0.2);
}

const addText = (gameState: GameState, text: string, position: THREE.Vector3, fontSize: number) => {
  const myText = new Text()
  myText.name = text;

  myText.text = text;
  myText.fontSize = fontSize
  myText.position.copy(position)
  myText.color = 0xffffff

  gameState.texts.add(myText)

  connectObjectVisibilityToTheatre(myText, gameState.sheet);

  myText.sync()
}

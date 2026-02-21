import { ISequence, ISheet } from "@theatre/core";

let sheet: ISheet | null = null;

export const setSheet = (s: ISheet) => {
  sheet = s;
}

export const getSheet = () => {
  if (!sheet) {
    throw new Error("Sheet not set");
  }
  return sheet;
}

export const getSequence = () => {
  if (!sheet) {
    throw new Error("Sheet not set");
  }
  return sheet.sequence;
}
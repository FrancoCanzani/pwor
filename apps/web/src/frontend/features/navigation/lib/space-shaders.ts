import type { ComponentType, CSSProperties } from "react";
import {
  Dithering,
  GodRays,
  GrainGradient,
  MeshGradient,
  Metaballs,
  NeuroNoise,
  PerlinNoise,
  SimplexNoise,
  SmokeRing,
  Spiral,
  StaticMeshGradient,
  StaticRadialGradient,
  Swirl,
  Voronoi,
  Warp,
} from "@paper-design/shaders-react";

export const DEFAULT_SPACE_SHADER = "nebula" as const;

type ShaderComponent = ComponentType<{
  style?: CSSProperties;
  className?: string;
  speed?: number;
  [key: string]: unknown;
}>;

export type SpaceShaderPreset = {
  id: string;
  label: string;
  Component: ShaderComponent;
  props: Record<string, unknown>;
};

/** Curated Paper shader looks for space pics. */
export const SPACE_SHADERS: SpaceShaderPreset[] = [
  {
    id: "nebula",
    label: "Nebula",
    Component: StaticMeshGradient,
    props: {
      colors: ["#0b1026", "#1a237e", "#4a148c", "#7c4dff", "#00bcd4"],
      positions: 18,
      rotation: 270,
      waveX: 0.7,
      waveXShift: 0.4,
      waveY: 0.85,
      waveYShift: 0.3,
      mixing: 0.7,
      grainMixer: 0.15,
      grainOverlay: 0.08,
      speed: 0,
    },
  },
  {
    id: "ink",
    label: "Ink",
    Component: MeshGradient,
    props: {
      colors: ["#050814", "#0d1b2a", "#415a77", "#778da9"],
      distortion: 0.8,
      swirl: 0.4,
      speed: 0,
    },
  },
  {
    id: "ether",
    label: "Ether",
    Component: GodRays,
    props: {
      colors: ["#4cc9f0", "#4361ee", "#3a0ca3", "#7209b7"],
      colorBack: "#050814",
      intensity: 0.7,
      density: 0.35,
      spotty: 0.4,
      midSize: 0.25,
      midIntensity: 0.5,
      offsetY: -0.2,
      speed: 0,
    },
  },
  {
    id: "ember",
    label: "Ember",
    Component: SmokeRing,
    props: {
      colors: ["#370617", "#9d0208", "#dc2f02", "#f48c06"],
      colorBack: "#03071e",
      thickness: 0.45,
      radius: 0.35,
      innerNoise: 0.4,
      speed: 0,
    },
  },
  {
    id: "kelp",
    label: "Kelp",
    Component: Warp,
    props: {
      colors: ["#001219", "#005f73", "#0a9396", "#94d2bd"],
      proportion: 0.4,
      softness: 0.8,
      distortion: 0.5,
      swirl: 0.6,
      swirlIterations: 6,
      shape: "checks",
      shapeScale: 0.3,
      speed: 0,
    },
  },
  {
    id: "violet",
    label: "Violet",
    Component: StaticMeshGradient,
    props: {
      colors: ["#10002b", "#240046", "#5a189a", "#9d4edd", "#e0aaff"],
      positions: 62,
      rotation: 200,
      waveX: 0.55,
      waveXShift: 0.2,
      waveY: 0.9,
      waveYShift: 0.5,
      mixing: 0.85,
      grainMixer: 0.1,
      grainOverlay: 0.05,
      speed: 0,
    },
  },
  {
    id: "dawn",
    label: "Dawn",
    Component: MeshGradient,
    props: {
      colors: ["#ff6b35", "#f7c59f", "#efefd0", "#004e89"],
      distortion: 0.6,
      swirl: 0.25,
      speed: 0,
    },
  },
  {
    id: "mono",
    label: "Mono",
    Component: StaticMeshGradient,
    props: {
      colors: ["#111111", "#2a2a2a", "#5a5a5a", "#cfcfcf"],
      positions: 40,
      rotation: 90,
      waveX: 0.4,
      waveXShift: 0.1,
      waveY: 0.5,
      waveYShift: 0.7,
      mixing: 0.6,
      grainMixer: 0.2,
      grainOverlay: 0.12,
      speed: 0,
    },
  },
  {
    id: "neuro",
    label: "Neuro",
    Component: NeuroNoise,
    props: {
      colorFront: "#c77dff",
      colorMid: "#7b2cbf",
      colorBack: "#10002b",
      brightness: 0.15,
      contrast: 0.45,
      speed: 0,
    },
  },
  {
    id: "grain",
    label: "Grain",
    Component: GrainGradient,
    props: {
      colorBack: "#0a0000",
      colors: ["#6f0000", "#0080ff", "#f2ebc9", "#33cc33"],
      softness: 0.6,
      intensity: 0.5,
      noise: 0.35,
      shape: "corners",
      speed: 0,
    },
  },
  {
    id: "vortex",
    label: "Vortex",
    Component: Spiral,
    props: {
      colorFront: "#80ffdb",
      colorBack: "#001219",
      density: 1.2,
      distortion: 0.35,
      strokeWidth: 0.4,
      strokeTaper: 0.3,
      softness: 0.2,
      speed: 0,
    },
  },
  {
    id: "swirl",
    label: "Swirl",
    Component: Swirl,
    props: {
      colorBack: "#330000",
      colors: ["#ffd1d1", "#ff8a8a", "#660000"],
      bandCount: 6,
      twist: 0.55,
      softness: 0.3,
      noise: 0.15,
      speed: 0,
    },
  },
  {
    id: "cells",
    label: "Cells",
    Component: Voronoi,
    props: {
      colors: ["#83c9fb", "#1d3557", "#457b9d"],
      colorGap: "#e0fbfc",
      stepsPerColor: 2,
      gap: 0.04,
      glow: 0.35,
      distortion: 0.15,
      speed: 0,
    },
  },
  {
    id: "simplex",
    label: "Simplex",
    Component: SimplexNoise,
    props: {
      colors: ["#4449CF", "#FFD1E0", "#F94446", "#FFD36B"],
      stepsPerColor: 2,
      softness: 0.2,
      speed: 0,
    },
  },
  {
    id: "plasma",
    label: "Plasma",
    Component: Metaballs,
    props: {
      colorBack: "#102f84",
      colors: ["#ffc800", "#ff5500", "#ffc105"],
      count: 7,
      size: 0.7,
      speed: 0,
    },
  },
  {
    id: "dither",
    label: "Dither",
    Component: Dithering,
    props: {
      colorFront: "#f4a261",
      colorBack: "#1d3557",
      shape: "simplex",
      type: "4x4",
      size: 2,
      speed: 0,
    },
  },
  {
    id: "perlin",
    label: "Perlin",
    Component: PerlinNoise,
    props: {
      colorFront: "#e9c46a",
      colorBack: "#264653",
      proportion: 0.45,
      softness: 0.35,
      octaveCount: 4,
      persistence: 0.5,
      lacunarity: 2,
      speed: 0,
    },
  },
  {
    id: "radial",
    label: "Radial",
    Component: StaticRadialGradient,
    props: {
      colorBack: "#2e1f27",
      colors: ["#d72638", "#3f88c5", "#f49d37"],
      radius: 0.85,
      focalDistance: 0.35,
      mixing: 0.7,
      distortion: 0.25,
      grainMixer: 0.12,
      grainOverlay: 0.08,
      speed: 0,
    },
  },
];

export type SpaceShaderId = (typeof SPACE_SHADERS)[number]["id"];

export function isSpaceShaderId(
  value: string | null | undefined,
): value is SpaceShaderId {
  return SPACE_SHADERS.some((preset) => preset.id === value);
}

export function getSpaceShader(
  id: string | null | undefined,
): SpaceShaderPreset {
  return (
    SPACE_SHADERS.find((preset) => preset.id === id) ??
    SPACE_SHADERS.find((preset) => preset.id === DEFAULT_SPACE_SHADER)!
  );
}

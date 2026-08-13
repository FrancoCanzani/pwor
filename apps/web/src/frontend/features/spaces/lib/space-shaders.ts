import type { ComponentType, CSSProperties } from "react";
import {
  GemSmoke,
  GodRays,
  GrainGradient,
  MeshGradient,
  Metaballs,
  NeuroNoise,
  SimplexNoise,
  SmokeRing,
  Spiral,
  StaticMeshGradient,
  StaticRadialGradient,
  Swirl,
  Voronoi,
  Warp,
  Waves,
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
    id: "pulse",
    label: "Pulse",
    Component: NeuroNoise,
    props: {
      colorFront: "#e0aaff",
      colorMid: "#7b2cbf",
      colorBack: "#10002b",
      brightness: 0.85,
      contrast: 0.55,
      speed: 0,
    },
  },
  {
    id: "helix",
    label: "Helix",
    Component: Spiral,
    props: {
      colorBack: "#0a0a0a",
      colorFront: "#f4a261",
      density: 0.7,
      distortion: 0.2,
      strokeWidth: 0.35,
      softness: 0.4,
      speed: 0,
    },
  },
  {
    id: "cells",
    label: "Cells",
    Component: Voronoi,
    props: {
      colors: ["#14213d", "#fca311", "#e5e5e5"],
      colorGap: "#000000",
      colorGlow: "#fca311",
      distortion: 0.35,
      gap: 0.04,
      glow: 0.45,
      speed: 0,
    },
  },
  {
    id: "tide",
    label: "Tide",
    Component: Waves,
    props: {
      colorFront: "#90e0ef",
      colorBack: "#023e8a",
      frequency: 0.6,
      amplitude: 0.45,
      spacing: 0.35,
      proportion: 0.5,
      softness: 0.7,
      rotation: 25,
    },
  },
  {
    id: "lava",
    label: "Lava",
    Component: Metaballs,
    props: {
      colorBack: "#1a0000",
      colors: ["#ff4800", "#ff5400", "#ff6d00", "#ff9100"],
      count: 7,
      size: 0.65,
      speed: 0,
    },
  },
  {
    id: "ribbon",
    label: "Ribbon",
    Component: Swirl,
    props: {
      colorBack: "#0d0221",
      colors: ["#ff6bcb", "#c77dff", "#7b2cbf", "#3c096c"],
      bandCount: 5,
      twist: 0.7,
      center: 0.45,
      proportion: 0.55,
      softness: 0.35,
      noise: 0.15,
      speed: 0,
    },
  },
  {
    id: "dust",
    label: "Dust",
    Component: GrainGradient,
    props: {
      colorBack: "#1a1a1a",
      colors: ["#d4a373", "#faedcd", "#ccd5ae"],
      softness: 0.6,
      intensity: 0.55,
      noise: 0.4,
      shape: "blob",
      speed: 0,
    },
  },
  {
    id: "corona",
    label: "Corona",
    Component: StaticRadialGradient,
    props: {
      colorBack: "#050505",
      colors: ["#ffba08", "#faa307", "#f48c06", "#e85d04", "#dc2f02"],
      radius: 0.75,
      focalDistance: 0.35,
      focalAngle: 220,
      falloff: 0.55,
      mixing: 0.7,
      grainMixer: 0.12,
      grainOverlay: 0.08,
      speed: 0,
    },
  },
  {
    id: "haze",
    label: "Haze",
    Component: SimplexNoise,
    props: {
      colors: ["#22223b", "#4a4e69", "#9a8c98", "#c9ada7", "#f2e9e4"],
      stepsPerColor: 3,
      softness: 0.55,
      speed: 0,
    },
  },
  {
    id: "gem",
    label: "Gem",
    Component: GemSmoke,
    props: {
      colors: ["#48cae4", "#00b4d8", "#0077b6", "#023e8a"],
      colorBack: "#03045e",
      colorInner: "#caf0f8",
      shape: "diamond",
      size: 0.55,
      innerGlow: 0.5,
      outerGlow: 0.35,
      innerDistortion: 0.3,
      outerDistortion: 0.4,
      speed: 0,
    },
  },
];

export type SpaceShaderId = (typeof SPACE_SHADERS)[number]["id"];

export function isSpaceShaderId(value: string | null | undefined): value is SpaceShaderId {
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

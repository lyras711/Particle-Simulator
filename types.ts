
// Visual parameters that control the chaos simulation
export interface ChaosParams {
  speed: number;        // Global time multiplier (0.0 to 2.0)
  noiseScale: number;   // Turbulence frequency (0.1 to 3.0)
  chaosLevel: number;   // Blend between pattern and noise (0.0 to 1.0)
  particleCount: number;// Number of particles (1000 to 40000)
  particleSize: number; // Size of individual particles (0.1 to 2.0)
  colorPrimary: string; // Hex color code
  colorSecondary: string;// Hex color code
  bloomStrength: number;// Post-processing bloom intensity (0 to 3)
  
  // New Physics Parameters
  drag: number;         // Viscosity/Resistance (0.8 to 0.99)
  forceMagnitude: number; // How strong the forces are (0.1 to 5.0)
  patternScale: number; // Frequency of the structure/lattice (0.1 to 5.0)
  repulsion: number;    // Particle repulsion strength (0.0 to 2.0)
  
  // Interactive Text
  text?: string;        // Text to visualize
  textDepth: number;    // Extrusion depth of the text (0.0 to 5.0)

  // Camera Controls
  autoRotate: boolean;
  autoRotateSpeed: number;

  // Effects
  trails: boolean;      // Enable geometry-based motion trails
  enableColorCycle: boolean; // Toggle time-based hue shifting

  // Audio Reactivity
  audioReactive: boolean; // Enable audio modulation
  audioSensitivity: number; // Multiplier for audio impact (0.1 to 5.0)
}

export const DEFAULT_PARAMS: ChaosParams = {
  speed: 0.5,
  noiseScale: 0.8,
  chaosLevel: 0.1,
  particleCount: 10000,
  particleSize: 1.2,
  colorPrimary: '#ff0055',
  colorSecondary: '#4400ff',
  bloomStrength: 1.2,
  
  drag: 0.96,
  forceMagnitude: 1.0,
  patternScale: 1.0,
  repulsion: 0.0,
  text: '',
  textDepth: 1.0,

  autoRotate: true,
  autoRotateSpeed: 0.5,

  trails: false,
  enableColorCycle: true,

  audioReactive: false,
  audioSensitivity: 1.5,
};

// API Response type
export interface GeminiConfigResponse {
  params: ChaosParams;
  reasoning: string;
}


import { GoogleGenAI, Type } from "@google/genai";
import { ChaosParams, DEFAULT_PARAMS, GeminiConfigResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateChaosConfig = async (userPrompt: string): Promise<GeminiConfigResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following user description into visual parameters for a 3D chaotic particle system.
      
      User Description: "${userPrompt}"

      The system supports the following parameters:
      - speed: Time simulation speed (float 0.0 - 2.0). 0.0 is frozen, 1.0 is normal.
      - noiseScale: Frequency of the turbulent noise (float 0.1 - 3.0).
      - chaosLevel: Randomness factor (float 0.0 - 1.0). 0 is structured flow, 1 is chaotic.
      - particleCount: Number of particles (int 1000 - 40000).
      - particleSize: Visual size (float 0.1 - 2.0).
      - colorPrimary: Main Hex color.
      - colorSecondary: Secondary Hex color.
      - bloomStrength: Glow intensity (float 0.0 - 3.0).
      - drag: Air resistance (float 0.80 - 0.99). Lower is slippery/fast, Higher is thick/slow fluid.
      - forceMagnitude: Strength of the vector field forces (float 0.1 - 5.0).
      - patternScale: Frequency of the structured lattice pattern (float 0.1 - 4.0).
      - repulsion: Particle repulsion strength (float 0.0 - 2.0). Use higher values for 'solid' or 'filled' looks.
      - textDepth: 3D extrusion depth for text (float 0.0 - 5.0).
      - autoRotate: Whether the camera spins around the scene (boolean).
      - autoRotateSpeed: Speed of camera rotation (float -5.0 to 5.0). Negative spins left.
      - trails: Enable particle motion trails (boolean). Good for "fast", "warp", "speed" descriptions.
      - enableColorCycle: Whether colors should shift hue over time (boolean). Set to true for "rainbow", "psychedelic", "dynamic". Set to false for "monochrome", "specific color", "static".

      Provide a short 'reasoning' string explaining why you chose these values based on the mood.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            params: {
              type: Type.OBJECT,
              properties: {
                speed: { type: Type.NUMBER },
                noiseScale: { type: Type.NUMBER },
                chaosLevel: { type: Type.NUMBER },
                particleCount: { type: Type.INTEGER },
                particleSize: { type: Type.NUMBER },
                colorPrimary: { type: Type.STRING },
                colorSecondary: { type: Type.STRING },
                bloomStrength: { type: Type.NUMBER },
                drag: { type: Type.NUMBER },
                forceMagnitude: { type: Type.NUMBER },
                patternScale: { type: Type.NUMBER },
                repulsion: { type: Type.NUMBER },
                textDepth: { type: Type.NUMBER },
                autoRotate: { type: Type.BOOLEAN },
                autoRotateSpeed: { type: Type.NUMBER },
                trails: { type: Type.BOOLEAN },
                enableColorCycle: { type: Type.BOOLEAN },
              },
              required: ["speed", "noiseScale", "chaosLevel", "particleCount", "particleSize", "colorPrimary", "colorSecondary", "bloomStrength", "drag", "forceMagnitude", "patternScale", "repulsion", "autoRotate", "autoRotateSpeed"]
            },
            reasoning: { type: Type.STRING }
          },
          required: ["params", "reasoning"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiConfigResponse;
    }
    throw new Error("No text response from Gemini");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { params: DEFAULT_PARAMS, reasoning: "Failed to generate config, using defaults." };
  }
};

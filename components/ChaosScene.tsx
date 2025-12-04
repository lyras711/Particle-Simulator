
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ChaosParams } from '../types';
import { createNoise3D } from 'simplex-noise';
import { audioAnalyzer } from '../services/audioAnalyzer';

interface ChaosSceneProps {
  params: ChaosParams;
}

const noise3D = createNoise3D();

const ParticleShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: 1.0 },
    uTime: { value: 0.0 },
    uAudioPulse: { value: 0.0 }, // New uniform for audio bass kick
    uColorCycle: { value: 1.0 }, // 1.0 = on, 0.0 = off
  },
  vertexShader: `
    attribute float size;
    attribute float alpha;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uPixelRatio;
    uniform float uAudioPulse;
    
    void main() {
      vColor = color;
      vAlpha = alpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Audio pulse affects particle size slightly
      float pulse = 1.0 + uAudioPulse * 0.5;
      
      // Better size attenuation equation
      gl_PointSize = size * pulse * uPixelRatio * (200.0 / -mvPosition.z); 
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uColorCycle;
    varying vec3 vColor;
    varying float vAlpha;
    
    // Function to shift hue of a color
    vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(hue);
        return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
    }
    
    void main() {
      // Circular particle
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord) * 2.0;
      
      if (r > 1.0) discard;
      
      // High quality glow gradient: (1 - r^2) for soft falloff
      float glow = 1.0 - (r * r);
      glow = pow(glow, 2.0); // Sharpen center
      
      vec3 finalColor = vColor;

      // Dynamic color shift: Cycle hue based on time if enabled
      if (uColorCycle > 0.5) {
         // uTime * 0.1 controls the speed of the color cycle
         finalColor = hueShift(vColor, uTime * 0.1);
      }

      gl_FragColor = vec4(finalColor, vAlpha * glow);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
});

// Basic material for trails
const TrailMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.6, // Increased visibility
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const MAX_PARTICLES = 40000;
const HASH_SIZE = 65536; // 2^16 for spatial hash

const ChaosScene: React.FC<ChaosSceneProps> = ({ params }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const trailsRef = useRef<THREE.LineSegments>(null);
  const viewport = useThree((state) => state.viewport);
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  const [targetPoints, setTargetPoints] = useState<Float32Array | null>(null);

  // Initialize simulation state
  const { particles, velocities, initialPositions, grid, nextList, trails, lifetimes } = useMemo(() => {
    const count = MAX_PARTICLES;
    const positions = new Float32Array(count * 3);
    const initialPositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    
    // Trail Buffers (2 points per particle = 1 line segment)
    // Format: [x1,y1,z1, x2,y2,z2, ...]
    const trailPositions = new Float32Array(count * 3 * 2);
    const trailColors = new Float32Array(count * 3 * 2);

    // Arrays for Spatial Hashing
    const grid = new Int32Array(HASH_SIZE); 
    const nextList = new Int32Array(count);

    for (let i = 0; i < count; i++) {
      // Spawn in a sphere
      const r = 8 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Init trails at same spot (zero length)
      trailPositions[i * 6 + 0] = x;
      trailPositions[i * 6 + 1] = y;
      trailPositions[i * 6 + 2] = z;
      trailPositions[i * 6 + 3] = x;
      trailPositions[i * 6 + 4] = y;
      trailPositions[i * 6 + 5] = z;

      // Keep track of start for potential resets
      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      sizes[i] = (0.2 + Math.random() * 0.8); 
      alphas[i] = 0.0; // Start invisible, fade in with lifetime
      lifetimes[i] = Math.random(); // Random start life
    }

    return { 
      particles: { positions, colors, sizes, alphas }, 
      velocities: vel,
      initialPositions,
      grid,
      nextList,
      trails: { positions: trailPositions, colors: trailColors },
      lifetimes
    };
  }, []);

  // Handle Resize / Pixel Ratio updates for shader
  useEffect(() => {
    ParticleShaderMaterial.uniforms.uPixelRatio.value = pixelRatio;
  }, [pixelRatio]);

  // Handle Text Rasterization
  useEffect(() => {
    if (!params.text || params.text.trim() === '') {
      setTargetPoints(null);
      return;
    }

    // Wait for fonts to load slightly to avoid Flash of Unstyled Text
    // A simple timeout isn't perfect but helps with React re-renders
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a large font size for resolution
    const fontSize = 150; 
    // Construct font string with fallback
    // e.g. "900 150px 'Playfair Display', sans-serif"
    const font = `900 ${fontSize}px "${params.fontFamily || 'Inter'}", sans-serif`;
    ctx.font = font;
    
    const text = params.text;
    const measure = ctx.measureText(text);
    const width = Math.ceil(measure.width);
    const height = Math.ceil(fontSize * 1.5);

    canvas.width = width;
    canvas.height = height;

    // Draw text
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const points = [];

    // Volume generation parameters
    const textDepth = params.textDepth || 0;
    // Calculate how many layers to generate based on depth
    // More depth = more layers to fill volume
    const numLayers = Math.max(1, Math.ceil(textDepth * 4) + 1); 

    // Scan for pixels and map to 3D space
    // Step size controls XY density. 
    // Using step 3 to keep performance manageable while filling volume
    const step = 3; 

    for (let y = 0; y < height; y += step) { 
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        // Check red channel for white text
        if (data[i] > 128) { 
           // Base XY Coordinates
           const px = (x - width / 2) * 0.15; 
           const py = -(y - height / 2) * 0.15;
           
           // Create voxel column along Z axis
           for(let l = 0; l < numLayers; l++) {
               let zOffset = 0;
               if (numLayers > 1) {
                  // Distribute from -depth/2 to +depth/2
                  zOffset = ((l / (numLayers - 1)) - 0.5) * textDepth;
               }
               
               // Add tiny jitter to avoid perfect grid aliasing
               const jitter = 0.05;
               const jx = (Math.random() - 0.5) * jitter;
               const jy = (Math.random() - 0.5) * jitter;
               const jz = (Math.random() - 0.5) * jitter;

               points.push(px + jx, py + jy, zOffset + jz);
           }
        }
      }
    }
    
    setTargetPoints(new Float32Array(points));
  }, [params.text, params.textDepth, params.fontFamily]);

  // Handle Color & Size updates
  useEffect(() => {
    if (!pointsRef.current) return;
    
    // Always update the full buffer of particles so they are ready if the count increases
    const count = MAX_PARTICLES;
    const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const sizes = pointsRef.current.geometry.attributes.size.array as Float32Array;
    
    // Also update trail colors
    const trailCol = trails.colors;

    const c1 = new THREE.Color(params.colorPrimary);
    const c2 = new THREE.Color(params.colorSecondary);

    for (let i = 0; i < count; i++) {
      // Gradient mix
      const mixFactor = i / count;
      const noise = (Math.random() - 0.5) * 0.3;
      const color = c1.clone().lerp(c2, Math.max(0, Math.min(1, mixFactor + noise)));
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Update Line Colors (2 vertices per particle, same color)
      trailCol[i * 6 + 0] = color.r;
      trailCol[i * 6 + 1] = color.g;
      trailCol[i * 6 + 2] = color.b;
      trailCol[i * 6 + 3] = color.r;
      trailCol[i * 6 + 4] = color.g;
      trailCol[i * 6 + 5] = color.b;

      // Base size
      sizes[i] = (0.5 + Math.random()) * params.particleSize;
    }
    
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
    pointsRef.current.geometry.attributes.size.needsUpdate = true;
    
    if (trailsRef.current) {
        trailsRef.current.geometry.attributes.color.needsUpdate = true;
    }
  }, [params.colorPrimary, params.colorSecondary, params.particleSize, trails.colors]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    
    // Audio Processing
    let audioBass = 0;
    let audioTreble = 0;
    
    if (params.audioReactive) {
        const audioData = audioAnalyzer.getAudioData();
        const sensitivity = params.audioSensitivity || 1.5;
        
        audioBass = audioData.bass * sensitivity;
        audioTreble = audioData.treble * sensitivity;
        
        // Pass bass kick to shader for size pulsing
        ParticleShaderMaterial.uniforms.uAudioPulse.value = audioBass;
    } else {
        ParticleShaderMaterial.uniforms.uAudioPulse.value = 0.0;
    }
    
    ParticleShaderMaterial.uniforms.uTime.value = time;
    // Update color cycle uniform
    ParticleShaderMaterial.uniforms.uColorCycle.value = params.enableColorCycle ? 1.0 : 0.0;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const alphas = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const trailPos = trails.positions;

    // Simulation Constants (modulated by audio if active)
    const baseSpeed = params.speed; 
    // High freq audio makes things move faster/jitter more
    const speed = params.audioReactive ? baseSpeed + (audioTreble * 0.5) : baseSpeed; 
    
    // Bass impacts force strength
    const baseForce = params.forceMagnitude;
    const forceMag = (params.audioReactive ? baseForce + (audioBass * 2.0) : baseForce) * 0.005;

    const pFreq = params.patternScale * 0.5; // Pattern Frequency
    const nFreq = params.noiseScale * 0.5;   // Noise Frequency
    const chaos = params.chaosLevel;         // Blend factor
    const drag = params.drag || 0.96;        // Fallback if undefined
    
    // Bass impacts repulsion (pushing particles apart on beat)
    const baseRepulsion = params.repulsion || 0.0;
    const repulsion = params.audioReactive ? Math.max(baseRepulsion, audioBass * 1.5) : baseRepulsion;
    
    const showTrails = params.trails;

    const hasText = targetPoints && targetPoints.length > 0;
    const numTextPoints = hasText ? targetPoints!.length / 3 : 0;
    
    // Calculate active count
    let activeCount = params.particleCount;
    if (hasText) activeCount = Math.max(activeCount, numTextPoints);
    activeCount = Math.min(activeCount, MAX_PARTICLES);

    // --- SPATIAL HASHING FOR REPULSION ---
    if (repulsion > 0.05) {
        grid.fill(-1);
        const cellSize = params.particleSize * 1.5;
        const cellInv = 1.0 / cellSize;
        for(let i = 0; i < activeCount; i++) {
            const x = positions[i*3];
            const y = positions[i*3+1];
            const z = positions[i*3+2];
            const xi = Math.floor(x * cellInv);
            const yi = Math.floor(y * cellInv);
            const zi = Math.floor(z * cellInv);
            const hash = Math.abs((xi * 73856093) ^ (yi * 19349663) ^ (zi * 83492791)) % HASH_SIZE;
            nextList[i] = grid[hash];
            grid[hash] = i;
        }
    }

    // Safety bounding radius squared (very large, just to prevent NaN/Infinity issues)
    const MAX_BOUNDS_SQ = 100000; 

    for (let i = 0; i < activeCount; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      let x = positions[ix];
      let y = positions[iy];
      let z = positions[iz];

      // --- REPULSION FORCE ---
      if (repulsion > 0.05) {
         const cellSize = params.particleSize * 1.5;
         const cellInv = 1.0 / cellSize;
         const xi = Math.floor(x * cellInv);
         const yi = Math.floor(y * cellInv);
         const zi = Math.floor(z * cellInv);
         const hash = Math.abs((xi * 73856093) ^ (yi * 19349663) ^ (zi * 83492791)) % HASH_SIZE;
         
         let neighbor = grid[hash];
         let checks = 0;
         while (neighbor !== -1 && checks < 10) {
             if (neighbor !== i) {
                 const nx = positions[neighbor*3];
                 const ny = positions[neighbor*3+1];
                 const nz = positions[neighbor*3+2];
                 const dx = x - nx;
                 const dy = y - ny;
                 const dz = z - nz;
                 const distSq = dx*dx + dy*dy + dz*dz;
                 const minDist = cellSize;
                 if (distSq < minDist*minDist && distSq > 0.0001) {
                     const dist = Math.sqrt(distSq);
                     const force = (minDist - dist) / dist;
                     const repStr = repulsion * 0.05; 
                     velocities[ix] += dx * force * repStr;
                     velocities[iy] += dy * force * repStr;
                     velocities[iz] += dz * force * repStr;
                 }
             }
             neighbor = nextList[neighbor];
             checks++;
         }
      }

      // --- VECTOR FIELD / FORCE CALCULATION ---
      
      if (hasText) {
        // TARGET MODE (Text)
        // Reset lifetime so text particles don't die
        lifetimes[i] = 1.0;

        const pointIndex = i % numTextPoints;
        const tx = targetPoints![pointIndex * 3];
        const ty = targetPoints![pointIndex * 3 + 1];
        const tz = targetPoints![pointIndex * 3 + 2]; 

        const dx = tx - x;
        const dy = ty - y;
        const dz = tz - z;
        
        // Audio affects attraction strength (more bass = tighter text)
        const attractionStr = 0.12 * (params.forceMagnitude || 1.0) * (1.0 + audioBass * 0.5);
        
        velocities[ix] += dx * attractionStr;
        velocities[iy] += dy * attractionStr;
        velocities[iz] += dz * attractionStr;

        const shimmerFreq = 3.0;
        const shimmerSpeed = time * 4.0;
        // Audio impacts shimmer
        const shimmerAmp = 0.003 * (params.chaosLevel * 3.0 + 1.0) * (1.0 + audioTreble * 2.0);

        velocities[ix] += Math.sin(y * shimmerFreq + shimmerSpeed) * shimmerAmp;
        velocities[iy] += Math.cos(z * shimmerFreq + shimmerSpeed) * shimmerAmp;
        velocities[iz] += Math.sin(x * shimmerFreq + shimmerSpeed) * shimmerAmp;

        const textDrag = (params.drag || 0.96) * 0.85; 
        velocities[ix] *= textDrag;
        velocities[iy] *= textDrag;
        velocities[iz] *= textDrag;

      } else {
        // CHAOS MODE (Original)
        
        // Decrease Lifetime
        // Life decays faster if speed is higher, but has a base decay rate
        const decay = 0.05 * speed + 0.1;
        lifetimes[i] -= delta * decay;

        const pfX = Math.sin(y * pFreq + time * 0.1);
        const pfY = Math.sin(z * pFreq + time * 0.1); 
        const pfZ = Math.sin(x * pFreq + time * 0.1);

        const nfX = noise3D(x * nFreq, y * nFreq, z * nFreq + time * 0.2);
        const nfY = noise3D(y * nFreq, z * nFreq, x * nFreq + time * 0.2);
        const nfZ = noise3D(z * nFreq, x * nFreq, y * nFreq + time * 0.2);

        const forceX = (pfX * (1 - chaos) + nfX * chaos);
        const forceY = (pfY * (1 - chaos) + nfY * chaos);
        const forceZ = (pfZ * (1 - chaos) + nfZ * chaos);

        velocities[ix] += forceX * forceMag;
        velocities[iy] += forceY * forceMag;
        velocities[iz] += forceZ * forceMag;

        velocities[ix] *= drag;
        velocities[iy] *= drag;
        velocities[iz] *= drag;
      }

      // Update Position
      x += velocities[ix] * speed;
      y += velocities[iy] * speed;
      z += velocities[iz] * speed;

      // Update Trails (Velocity-based streaks)
      // We draw a line from Current Position BACKWARDS along the velocity vector.
      // This creates a "warp speed" streak effect.
      if (showTrails) {
        const trailScale = 6.0; // Multiplier to make streaks visible

        // Head (Current Pos)
        trailPos[i * 6 + 0] = x;
        trailPos[i * 6 + 1] = y;
        trailPos[i * 6 + 2] = z;

        // Tail (Dragged behind)
        trailPos[i * 6 + 3] = x - (velocities[ix] * speed * trailScale);
        trailPos[i * 6 + 4] = y - (velocities[iy] * speed * trailScale);
        trailPos[i * 6 + 5] = z - (velocities[iz] * speed * trailScale);
      }

      // --- BOUNDARY / RESPAWN LOGIC ---
      const distSq = x*x + y*y + z*z;
      
      // Respawn if:
      // 1. Life has expired (and not showing text)
      // 2. OR it has flown exceptionally far (safety net)
      const shouldRespawn = !hasText && (lifetimes[i] <= 0 || distSq > MAX_BOUNDS_SQ);

      if (shouldRespawn) {
        // Respawn logic
        // Reset life
        lifetimes[i] = 1.0; 
        
        // Pick new random start position (spawn volume)
        // Spawn within a smaller central sphere to create outward flow
        const r = 4 * Math.cbrt(Math.random()); 
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);

        // Reset velocity
        velocities[ix] = 0;
        velocities[iy] = 0;
        velocities[iz] = 0;
        
        // Reset alpha immediately
        alphas[i] = 0;

        // Reset trail to point to avoid cross-screen flash
        if (showTrails) {
          trailPos[i*6+0] = x; trailPos[i*6+1] = y; trailPos[i*6+2] = z;
          trailPos[i*6+3] = x; trailPos[i*6+4] = y; trailPos[i*6+5] = z;
        }
      }

      // --- ALPHA / VISIBILITY UPDATE ---
      
      let targetAlpha = 0.0;

      if (hasText) {
          // Text Mode: Alpha based on pulse / shimmer
          const velMag = Math.sqrt(velocities[ix]**2 + velocities[iy]**2 + velocities[iz]**2);
          targetAlpha = 0.5 + Math.sin(time * 3.0 + x * 0.5) * 0.25; 
          targetAlpha += Math.min(0.5, velMag * 3.0);
      } else {
          // Chaos Mode: Alpha based on Lifetime (Fade In -> Sustain -> Fade Out)
          const life = lifetimes[i];
          // Smooth sine curve for fade in/out
          // life 1.0 -> 0.0
          // sin(life * PI) creates 0 -> 1 -> 0
          targetAlpha = Math.sin(life * Math.PI) * 1.2; 
          targetAlpha = Math.min(1.0, Math.max(0.0, targetAlpha));
          
          // Speed based flash
          const velMag = Math.sqrt(velocities[ix]**2 + velocities[iy]**2 + velocities[iz]**2);
          targetAlpha *= (1.0 + velMag); 
      }
      
      // Audio brightens particles on beat
      if (params.audioReactive) {
          targetAlpha += audioBass * 0.5;
      }

      targetAlpha = Math.max(0.0, Math.min(1.0, targetAlpha));
      
      // Linear interpolation for smooth alpha transitions
      alphas[i] = alphas[i] * 0.9 + targetAlpha * 0.1; 

      positions[ix] = x;
      positions[iy] = y;
      positions[iz] = z;
    }
    
    // Cleanup unused particles
    for (let i = activeCount; i < MAX_PARTICLES; i++) {
        alphas[i] = 0.0;
        if (showTrails) {
            // Collapse trails for hidden particles
            const zero = 0;
            trailPos[i*6+0] = zero; trailPos[i*6+1] = zero; trailPos[i*6+2] = zero;
            trailPos[i*6+3] = zero; trailPos[i*6+4] = zero; trailPos[i*6+5] = zero;
        }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
    
    if (showTrails && trailsRef.current) {
        trailsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      {/* @ts-ignore */}
      <points ref={pointsRef} material={ParticleShaderMaterial}>
        {/* @ts-ignore */}
        <bufferGeometry>
          {/* @ts-ignore */}
          <bufferAttribute
            attach="attributes-position"
            count={particles.positions.length / 3}
            array={particles.positions}
            itemSize={3}
          />
          {/* @ts-ignore */}
          <bufferAttribute
            attach="attributes-color"
            count={particles.colors.length / 3}
            array={particles.colors}
            itemSize={3}
          />
          {/* @ts-ignore */}
          <bufferAttribute
            attach="attributes-size"
            count={particles.sizes.length}
            array={particles.sizes}
            itemSize={1}
          />
          {/* @ts-ignore */}
          <bufferAttribute
            attach="attributes-alpha"
            count={particles.alphas.length}
            array={particles.alphas}
            itemSize={1}
          />
        {/* @ts-ignore */}
        </bufferGeometry>
      {/* @ts-ignore */}
      </points>

      {/* Render Trails if Enabled */}
      {params.trails && (
        // @ts-ignore
        <lineSegments ref={trailsRef} material={TrailMaterial}>
            {/* @ts-ignore */}
            <bufferGeometry>
                {/* @ts-ignore */}
                <bufferAttribute
                    attach="attributes-position"
                    count={trails.positions.length / 3}
                    array={trails.positions}
                    itemSize={3}
                />
                {/* @ts-ignore */}
                <bufferAttribute
                    attach="attributes-color"
                    count={trails.colors.length / 3}
                    array={trails.colors}
                    itemSize={3}
                />
            {/* @ts-ignore */}
            </bufferGeometry>
        {/* @ts-ignore */}
        </lineSegments>
      )}
    </>
  );
};

export default ChaosScene;
import React, { useState, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import ChaosScene from './components/ChaosScene';
import ControlPanel from './components/ControlPanel';
import { ChaosParams, DEFAULT_PARAMS } from './types';
import { videoRecorder } from './services/videoRecorder';

const App: React.FC = () => {
  const [params, setParams] = useState<ChaosParams>(DEFAULT_PARAMS);
  const [isRecording, setIsRecording] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleToggleRecord = () => {
    if (isRecording) {
      videoRecorder.stop();
      setIsRecording(false);
    } else {
      if (canvasRef.current) {
        videoRecorder.start(canvasRef.current);
        setIsRecording(true);
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas 
          onCreated={({ gl }) => {
            canvasRef.current = gl.domElement;
          }}
          camera={{ position: [0, 0, 15], fov: 50 }} 
          dpr={[1, 2]} // Support high-DPI screens for crisp rendering
          gl={{ 
            antialias: false, 
            alpha: false, 
            stencil: false, 
            depth: false,
            preserveDrawingBuffer: true // Required for accurate screen capture in some browsers
          }} 
        >
          {/* @ts-ignore */}
          <color attach="background" args={['#020202']} />
          
          <Suspense fallback={null}>
            <ChaosScene params={params} />
            <Environment preset="city" />
            
            {/* Post Processing for the "Energy" feel */}
            <EffectComposer enableNormalPass={false}>
               <Bloom 
                 luminanceThreshold={0.1}
                 luminanceSmoothing={0.9} 
                 intensity={params.bloomStrength} 
                 mipmapBlur
               />
               <Noise opacity={0.05} />
               <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          </Suspense>

          <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={5} 
            maxDistance={500} 
            autoRotate={params.autoRotate ?? true}
            autoRotateSpeed={params.autoRotateSpeed ?? 0.5}
          />
        </Canvas>
      </div>

      {/* UI Layer */}
      <ControlPanel 
        currentParams={params} 
        onUpdate={setParams} 
        isRecording={isRecording}
        onToggleRecording={handleToggleRecord}
      />
      
      {/* Ambient decorative elements */}
      <div className="absolute bottom-6 right-6 z-10 text-right pointer-events-none hidden md:block">
        <h2 className="text-white/20 text-6xl font-bold tracking-tighter">CHAOS</h2>
        <p className="text-white/20 text-sm tracking-[0.3em] font-light">VISUALIZATION ENGINE</p>
      </div>
    </div>
  );
};

export default App;
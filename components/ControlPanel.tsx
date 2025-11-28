import React, { useState } from 'react';
import { ChaosParams, DEFAULT_PARAMS } from '../types';
import { Sparkles, Sliders, Play, RotateCcw, Mic, Square, Type, Camera, Eye, Layers, Maximize2, Activity, Music, Upload, Video, XCircle, Menu, ChevronLeft } from 'lucide-react';
import { generateChaosConfig } from '../services/geminiService';
import { audioAnalyzer } from '../services/audioAnalyzer';

interface ControlPanelProps {
  currentParams: ChaosParams;
  onUpdate: (params: ChaosParams) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ currentParams, onUpdate, isRecording, onToggleRecording }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // Audio state
  const [micActive, setMicActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setReasoning(null);
    try {
      const result = await generateChaosConfig(prompt);
      // Preserve existing text if AI doesn't return it (it won't, but good practice)
      onUpdate({ ...result.params, text: currentParams.text });
      setReasoning(result.reasoning);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChange = (key: keyof ChaosParams, value: number | string | boolean) => {
    onUpdate({ ...currentParams, [key]: value });
  };
  
  const toggleMic = async () => {
      if (micActive) {
          audioAnalyzer.stop();
          setMicActive(false);
          handleChange('audioReactive', false);
      } else {
          try {
              // Ensure we stop any file playback first
              audioAnalyzer.stop();
              setFileName(null);
              
              await audioAnalyzer.startMicrophone();
              setMicActive(true);
              handleChange('audioReactive', true);
          } catch (e) {
              alert("Microphone access denied or error.");
          }
      }
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Stop mic if active
          if (micActive) {
              setMicActive(false);
          }
          audioAnalyzer.startFile(file);
          setFileName(file.name);
          handleChange('audioReactive', true);
      }
  };
  
  const stopAudio = () => {
      audioAnalyzer.stop();
      setMicActive(false);
      setFileName(null);
      handleChange('audioReactive', false);
  };

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-4 left-4 z-50 p-2.5 bg-black/60 text-white rounded-lg hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all shadow-lg pointer-events-auto"
        title={isPanelOpen ? "Hide Controls" : "Show Controls"}
      >
        {isPanelOpen ? <ChevronLeft className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <div 
        className={`absolute top-0 left-0 h-full w-full md:w-96 p-4 md:p-6 pointer-events-none flex flex-col justify-between z-40 transition-transform duration-300 ease-in-out ${
          isPanelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        
        {/* Top Section: AI Input */}
        <div className="bg-black/80 backdrop-blur-md rounded-2xl p-6 border border-white/10 pointer-events-auto shadow-2xl mt-12 md:mt-0">
          <div className="flex items-center gap-2 mb-4 pl-10 md:pl-8">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h1 className="text-white font-bold text-lg tracking-wider">CHAOS GENAI</h1>
          </div>

          {/* Text Shape Input */}
          <div className="mb-4">
              <div className="relative mb-2">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Type className="w-4 h-4" />
                  </div>
                  <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                      placeholder="Enter text to shape particles..."
                      value={currentParams.text || ''}
                      onChange={(e) => handleChange('text', e.target.value)}
                  />
              </div>
              
              {/* Text Depth Slider - Only show if text is entered */}
              {currentParams.text && (
                   <div className="animate-in fade-in slide-in-from-top-1 duration-300 bg-white/5 rounded-lg p-2 border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                          <Layers className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">3D Depth</span>
                          <span className="text-xs text-gray-500 ml-auto">{currentParams.textDepth?.toFixed(1) ?? '1.0'}</span>
                      </div>
                      <input
                        type="range" min="0.0" max="5.0" step="0.1"
                        value={currentParams.textDepth ?? 1.0}
                        onChange={(e) => handleChange('textDepth', parseFloat(e.target.value))}
                        className="w-full accent-blue-400 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                   </div>
              )}
          </div>

          <div className="relative mb-2">
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm resize-none"
              rows={3}
              placeholder="Describe a mood (e.g., 'Volcanic Eruption', 'Cyberpunk Rain', 'Calm Ocean')..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="absolute bottom-3 right-3 p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>

          {reasoning && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg border-l-2 border-purple-500">
              <p className="text-xs text-gray-300 italic">"{reasoning}"</p>
            </div>
          )}
        </div>

        {/* Bottom Section: Manual Controls */}
        <div className="bg-black/80 backdrop-blur-md rounded-2xl p-5 border border-white/10 pointer-events-auto mt-4 max-h-[40vh] overflow-y-auto shadow-2xl space-y-2">
          
          {/* Video Recording Controls */}
          {onToggleRecording && (
            <div className="pb-2 border-b border-white/10 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold">Video Export</span>
                </div>
                {isRecording && (
                   <div className="flex items-center gap-2 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-xs text-red-400 font-mono uppercase">REC</span>
                   </div>
                )}
              </div>
              
              <button 
                onClick={onToggleRecording}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-colors font-medium ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
              >
                {isRecording ? <Square className="w-3 h-3 fill-current" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                {isRecording ? 'Stop Recording & Save' : 'Start Recording'}
              </button>
            </div>
          )}

          {/* Audio Reactivity Toggle */}
          <div className="pb-2 border-b border-white/10 mb-2">
              <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                       <Music className="w-4 h-4 text-green-400" />
                       <span className="text-sm font-semibold">Audio Reactivity</span>
                  </div>
                  <div className="text-xs text-gray-500">{currentParams.audioReactive ? 'On' : 'Off'}</div>
              </div>
              
              <div className="flex gap-2">
                  <button 
                      onClick={toggleMic}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-colors ${micActive ? 'bg-green-600/80 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                      <Mic className="w-3 h-3" />
                      {micActive ? 'Stop Mic' : 'Use Mic'}
                  </button>
                  
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs transition-colors cursor-pointer ${fileName ? 'bg-blue-600/80 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      <Upload className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{fileName ? 'Playing' : 'Upload File'}</span>
                      <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                  </label>
              </div>

              {currentParams.audioReactive && (
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                       <button 
                          onClick={stopAudio}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors border border-red-500/20"
                       >
                          <XCircle className="w-3 h-3" />
                          Stop Audio
                       </button>
                       
                       <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Sensitivity</span>
                              <span>{currentParams.audioSensitivity?.toFixed(1)}</span>
                          </div>
                          <input
                              type="range" min="0.1" max="5.0" step="0.1"
                              value={currentParams.audioSensitivity ?? 1.5}
                              onChange={(e) => handleChange('audioSensitivity', parseFloat(e.target.value))}
                              className="w-full accent-green-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                  </div>
              )}
          </div>

          {/* Camera Controls Toggle */}
          <div>
            <button 
              onClick={() => setShowCamera(!showCamera)}
              className="flex items-center justify-between w-full text-white/80 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-semibold">Camera Controls</span>
              </div>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded">{showCamera ? 'Hide' : 'Show'}</span>
            </button>

            {showCamera && (
              <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-2 border-b border-white/10 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Auto Rotate</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentParams.autoRotate ?? true}
                      onChange={(e) => handleChange('autoRotate', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Rotate Speed</span>
                    <span>{currentParams.autoRotateSpeed?.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="-5.0" max="5.0" step="0.1"
                    value={currentParams.autoRotateSpeed ?? 0.5}
                    onChange={(e) => handleChange('autoRotateSpeed', parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Simulation Parameters Toggle */}
          <div>
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-white/80 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span className="text-sm font-semibold">Simulation Parameters</span>
              </div>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded">{showAdvanced ? 'Hide' : 'Show'}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Motion Trails Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                       <Activity className="w-3 h-3 text-indigo-400" />
                       <span className="text-xs text-gray-400">Motion Trails</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentParams.trails ?? false}
                      onChange={(e) => handleChange('trails', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Speed (Time) */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Simulation Speed</span>
                    <span>{currentParams.speed?.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="2.0" step="0.05"
                    value={currentParams.speed}
                    onChange={(e) => handleChange('speed', parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Drag (Viscosity) */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Drag / Viscosity</span>
                    <span>{currentParams.drag?.toFixed(3)}</span>
                  </div>
                  <input
                    type="range" min="0.800" max="0.995" step="0.001"
                    value={currentParams.drag || 0.96}
                    onChange={(e) => handleChange('drag', parseFloat(e.target.value))}
                    className="w-full accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Force Strength */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Force Strength</span>
                    <span>{currentParams.forceMagnitude?.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="0.1" max="5.0" step="0.1"
                    value={currentParams.forceMagnitude || 1.0}
                    onChange={(e) => handleChange('forceMagnitude', parseFloat(e.target.value))}
                    className="w-full accent-red-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                 {/* Repulsion Strength */}
                 <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                      <Maximize2 className="w-3 h-3 text-pink-400" />
                      <span>Particle Repulsion</span>
                    </div>
                    <span>{currentParams.repulsion?.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="2.0" step="0.1"
                    value={currentParams.repulsion || 0.0}
                    onChange={(e) => handleChange('repulsion', parseFloat(e.target.value))}
                    className="w-full accent-pink-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Pattern Scale */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Pattern Frequency</span>
                    <span>{currentParams.patternScale?.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="0.1" max="4.0" step="0.1"
                    value={currentParams.patternScale || 1.0}
                    onChange={(e) => handleChange('patternScale', parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Noise Scale */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Noise Frequency</span>
                    <span>{currentParams.noiseScale?.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="0.1" max="3.0" step="0.1"
                    value={currentParams.noiseScale}
                    onChange={(e) => handleChange('noiseScale', parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Chaos Level */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Chaos Blend</span>
                    <span>{currentParams.chaosLevel?.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={currentParams.chaosLevel}
                    onChange={(e) => handleChange('chaosLevel', parseFloat(e.target.value))}
                    className="w-full accent-yellow-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Count */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Particles</span>
                    <span>{currentParams.particleCount}</span>
                  </div>
                  <input
                    type="range" min="1000" max="40000" step="1000"
                    value={currentParams.particleCount}
                    onChange={(e) => handleChange('particleCount', parseInt(e.target.value))}
                    className="w-full accent-green-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-gray-400 block mb-1">Primary</label>
                     <div className="flex items-center gap-2">
                        <input type="color" value={currentParams.colorPrimary} onChange={(e) => handleChange('colorPrimary', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                        <span className="text-xs text-gray-500 font-mono">{currentParams.colorPrimary}</span>
                     </div>
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 block mb-1">Secondary</label>
                     <div className="flex items-center gap-2">
                        <input type="color" value={currentParams.colorSecondary} onChange={(e) => handleChange('colorSecondary', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                        <span className="text-xs text-gray-500 font-mono">{currentParams.colorSecondary}</span>
                     </div>
                   </div>
                </div>
                
                <button 
                  onClick={() => {
                      onUpdate(DEFAULT_PARAMS);
                      setReasoning(null);
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-xs bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Defaults
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ControlPanel;
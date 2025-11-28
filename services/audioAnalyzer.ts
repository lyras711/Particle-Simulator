
export class AudioAnalyzer {
    private ctx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;
    private audioElement: HTMLAudioElement | null = null;
  
    constructor() {
      // Lazy init to comply with browser autoplay policies
    }
  
    private initContext() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512; // Moderate size for performance balance
        this.analyser.smoothingTimeConstant = 0.8;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
  
    async startMicrophone() {
      this.initContext();
      this.stop(); // Stop any existing source
  
      if (!this.ctx || !this.analyser) return;
  
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.source = this.ctx.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        throw err;
      }
    }
  
    startFile(file: File) {
      this.initContext();
      this.stop();
  
      if (!this.ctx || !this.analyser) return;
  
      const url = URL.createObjectURL(file);
      this.audioElement = new Audio(url);
      this.audioElement.loop = true;
      this.audioElement.play();
  
      this.source = this.ctx.createMediaElementSource(this.audioElement);
      this.source.connect(this.analyser);
      // Connect to destination so we can hear the music
      this.source.connect(this.ctx.destination); 
    }
  
    stop() {
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
        this.audioElement = null;
      }
    }
  
    getAudioData() {
      if (!this.analyser || !this.dataArray) {
        return { bass: 0, mid: 0, treble: 0, volume: 0 };
      }
  
      this.analyser.getByteFrequencyData(this.dataArray);
  
      const length = this.dataArray.length;
      let sum = 0;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
  
      // Simple frequency band division
      const bassRange = Math.floor(length * 0.1); // Bottom 10%
      const midRange = Math.floor(length * 0.5);  // Next 40%
      
      for (let i = 0; i < length; i++) {
        const val = this.dataArray[i] / 255.0; // Normalize 0-1
        sum += val;
  
        if (i < bassRange) {
          bassSum += val;
        } else if (i < midRange) {
          midSum += val;
        } else {
          trebleSum += val;
        }
      }
  
      return {
        volume: sum / length,
        bass: bassSum / bassRange || 0,
        mid: midSum / (midRange - bassRange) || 0,
        treble: trebleSum / (length - midRange) || 0
      };
    }
  }
  
  export const audioAnalyzer = new AudioAnalyzer();
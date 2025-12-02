
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private fileExtension = 'webm';
  private mimeType = 'video/webm';

  start(canvas: HTMLCanvasElement) {
    // Capture at 60fps
    const stream = canvas.captureStream(60);
    
    // Priority list for formats: MP4 (friendly) -> VP9 (Quality) -> WebM (Standard)
    const types = [
        'video/mp4; codecs=avc1.42E01E,mp4a.40.2', // H.264
        'video/mp4',                                // Generic MP4 container
        'video/webm; codecs=vp9',                   // High quality WebM
        'video/webm'                                // Standard WebM
    ];

    let selectedType = '';
    
    // Find the first supported type
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            selectedType = type;
            break;
        }
    }

    // Default fallback
    if (!selectedType) {
        selectedType = 'video/webm';
    }

    this.mimeType = selectedType;
    this.fileExtension = selectedType.includes('mp4') ? 'mp4' : 'webm';

    try {
        // Attempt high bitrate (12 Mbps) for crisp particle details
        this.mediaRecorder = new MediaRecorder(stream, { 
            mimeType: this.mimeType,
            videoBitsPerSecond: 12000000 
        });
    } catch (e) {
        console.warn(`Failed to init recorder with ${this.mimeType}, trying simple fallback`, e);
        // Fallback to browser default if high profile fails
        this.mediaRecorder = new MediaRecorder(stream);
        // Update internals to match what the browser actually gave us
        this.mimeType = this.mediaRecorder.mimeType; 
        this.fileExtension = this.mimeType.includes('mp4') ? 'mp4' : 'webm';
    }

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start();
    console.log(`Recording started using format: ${this.mimeType}`);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
          resolve();
          return;
      }

      this.mediaRecorder.onstop = () => {
        // Create blob with the actual mime type used
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Format filename with timestamp and correct extension
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `chaos_recording_${timestamp}.${this.fileExtension}`;
        
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
        this.chunks = [];
        resolve();
      };

      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    });
  }
}

export const videoRecorder = new VideoRecorder();

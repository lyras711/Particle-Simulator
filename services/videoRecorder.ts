
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  start(canvas: HTMLCanvasElement) {
    // Capture at 60fps
    const stream = canvas.captureStream(60);
    
    // Prefer VP9 for better quality/compression, fallback to standard WebM
    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
    }

    try {
        // Attempt high bitrate (12 Mbps) for crisp particle details
        this.mediaRecorder = new MediaRecorder(stream, { 
            mimeType,
            videoBitsPerSecond: 12000000 
        });
    } catch (e) {
        console.warn("High bitrate/codec not supported, falling back to default", e);
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    }

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start();
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
          resolve();
          return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        // Format filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `chaos_recording_${timestamp}.webm`;
        
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

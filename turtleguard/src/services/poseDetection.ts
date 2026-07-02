import { FilesetResolver, FaceDetector, Detection } from '@mediapipe/tasks-vision';
import { getPostureStandardConfig, type PostureStandard } from './postureStandard';

export interface PostureResult {
  isBadPosture: boolean;
  deviation: number;
  detection: Detection;
}

export interface CalibrationResult {
  ok: boolean;
  baselineScale?: number;
  reason?: 'NO_FACE_SAMPLES';
}

export class PostureDetector {
  private faceDetector: FaceDetector | null = null;
  private baselineScale: number | null = null;
  private baselineY: number | null = null;
  private emaScale: number | null = null;
  
  private isCalibrating = false;
  private calibrationSamplesScale: number[] = [];
  private calibrationSamplesY: number[] = [];
  private onCalibrationComplete?: (result: CalibrationResult) => void;

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );
    
    // Switch to FaceDetector for more accurate distance estimation in front of monitor
    this.faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO'
    });
  }

  startCalibration(onComplete: (result: CalibrationResult) => void) {
    this.isCalibrating = true;
    this.calibrationSamplesScale = [];
    this.calibrationSamplesY = [];
    this.onCalibrationComplete = onComplete;
    setTimeout(() => {
      this.isCalibrating = false;
      if (this.calibrationSamplesScale.length > 0) {
        this.baselineScale = this.calibrationSamplesScale.reduce((a, b) => a + b, 0) / this.calibrationSamplesScale.length;
        this.baselineY = this.calibrationSamplesY.reduce((a, b) => a + b, 0) / this.calibrationSamplesY.length;
        this.emaScale = this.baselineScale;
        if (this.onCalibrationComplete) {
          this.onCalibrationComplete({ ok: true, baselineScale: this.baselineScale });
        }
        return;
      } else {
        this.baselineScale = null;
        this.baselineY = null;
        this.emaScale = null;
      }

      if (this.onCalibrationComplete) {
        this.onCalibrationComplete({ ok: false, reason: 'NO_FACE_SAMPLES' });
      }
    }, 3000); // 3 seconds calibration
  }

  detectPosture(
    video: HTMLVideoElement,
    timestamp: number,
    postureStandard: PostureStandard = 'default',
  ): PostureResult | null {
    if (!this.faceDetector) return null;

    const result = this.faceDetector.detectForVideo(video, timestamp);
    // Early return if no face is detected
    if (!result.detections || result.detections.length === 0) return null;

    const detection = result.detections[0];
    if (!detection.boundingBox) return null;
    
    const boundingBox = detection.boundingBox;
    // Current Scale is the width of the bounding box
    const currentScale = boundingBox.width;
    // Center Y coordinate of the face
    const currentY = boundingBox.originY + (boundingBox.height / 2);

    if (this.isCalibrating) {
      this.calibrationSamplesScale.push(currentScale);
      this.calibrationSamplesY.push(currentY);
      return { isBadPosture: false, deviation: 0, detection };
    }

    if (this.baselineScale === null || this.baselineY === null) return { isBadPosture: false, deviation: 0, detection };

    // Exponential Moving Average (EMA) Filter with alpha = 0.2 for smooth tracking
    const alpha = 0.15;
    if (this.emaScale === null) {
      this.emaScale = currentScale;
    } else {
      const diff = currentScale - this.emaScale;
      // Add deadzone: only update EMA if the change is significant (e.g., > 1.5% of baseline)
      // This prevents stationary micro-jitter from causing continuous drift
      if (this.baselineScale && Math.abs(diff) > this.baselineScale * 0.015) {
        this.emaScale = this.emaScale + (alpha * diff);
      }
    }
    
    const standardConfig = getPostureStandardConfig(postureStandard);
    const scaleThreshold = this.baselineScale * (1 + standardConfig.scaleIncreaseRatio);
    const yThreshold =
      this.baselineY + boundingBox.height * standardConfig.yDropFaceHeightMultiplier;
    
    const isBadPosture = this.emaScale > scaleThreshold || currentY > yThreshold;
    
    // Calculate relative deviation percentage (0 = baseline, positive = closer to monitor)
    const deviationPercentage = ((this.emaScale - this.baselineScale) / this.baselineScale) * 100;

    return { isBadPosture, deviation: deviationPercentage, detection };
  }
}

export const postureDetector = new PostureDetector();

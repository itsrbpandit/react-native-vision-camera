import { SCREEN_HEIGHT, SCREEN_WIDTH, USE_ULTRAWIDE_IF_AVAILABLE } from './Constants';
import type { CameraDevice, CameraDeviceFormat, FrameRateRange, VideoStabilizationMode } from 'react-native-vision-camera';

/**
 * Compares two devices with the following criteria:
 * * Cameras with wide-angle-cameras are 5x **better** than cameras without.
 * * Cameras with ultra-wide-angle-cameras are 5x **worse** than cameras without.
 * * Cameras with more physical devices are "better"
 *
 * @returns
 * * `-1` if left is BETTER than right
 * * `0` if left equals right
 * * `1` if left is WORSE than right
 *
 * Note that this makes the `sort()` function descending, so the first element (`[0]`) is the "best" device.
 */
export const compareDevices = (left: CameraDevice, right: CameraDevice): number => {
  let leftPoints = 0;
  let rightPoints = 0;

  const leftHasWideAngle = left.devices.includes('wide-angle-camera');
  const rightHasWideAngle = right.devices.includes('wide-angle-camera');
  if (leftHasWideAngle) leftPoints += 5;
  if (rightHasWideAngle) rightPoints += 5;

  if (!USE_ULTRAWIDE_IF_AVAILABLE) {
    const leftHasUltraWideAngle = left.devices.includes('ultra-wide-angle-camera');
    const rightHasUltraWideAngle = right.devices.includes('ultra-wide-angle-camera');
    if (leftHasUltraWideAngle) leftPoints -= 5;
    if (rightHasUltraWideAngle) rightPoints -= 5;
  }

  if (left.devices.length > right.devices.length) leftPoints += 3;
  if (right.devices.length > left.devices.length) rightPoints += 3;

  return rightPoints - leftPoints;
};

type Size = { width: number; height: number };
const CAMERA_VIEW_SIZE: Size = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};
const CAMERA_VIEW_PIXELS = CAMERA_VIEW_SIZE.width * CAMERA_VIEW_SIZE.height;

const applyScaledMask = (
  clippedElementDimensions: Size, // 12 x 12
  maskDimensions: Size, //            6 x 12
): Size => {
  const wScale = maskDimensions.width / clippedElementDimensions.width; //   0.5
  const hScale = maskDimensions.height / clippedElementDimensions.height; // 1.0

  if (wScale > hScale) {
    return {
      width: maskDimensions.width / hScale,
      height: maskDimensions.height / hScale,
    };
  } else {
    return {
      width: maskDimensions.width / wScale,
      height: maskDimensions.height / wScale,
    };
  }
};

const videoStabilizationModesPointRanking: Record<VideoStabilizationMode, number> = {
  'cinematic-extended': 3,
  cinematic: 2,
  standard: 1,
  auto: 1,
  off: 0,
};

const getVideoStabilizationPoints = (videoStabilizationModes: VideoStabilizationMode[]): number =>
  videoStabilizationModes.reduce((prev, curr) => {
    return prev + videoStabilizationModesPointRanking[curr];
  }, 0);

/**
 * Compares two Formats with the following comparators:
 * * Photo Dimensions (higher is better) (weights x3)
 * * Video Dimensions (higher is better) (weights x2)
 * * Max FPS (higher is better) (weights x2)
 * * HDR Support (true is better) (weights x2)
 * * Max Zoom Factor (higher is better) (weights x1)
 * * MaxISO (higher is better) (weights x1)
 * * MinISO (lower is better) (weights x1)
 *
 * @returns
 * * `-1` if left is BETTER than right
 * * `0` if left equals right
 * * `1` if left is WORSE than right
 *
 * Note that this makes the `sort()` function descending, so the first element (`[0]`) is the "best" format.
 */
export const compareFormats = (left: CameraDeviceFormat, right: CameraDeviceFormat): number => {
  let leftPoints = 0;
  let rightPoints = 0;

  const leftPhotoPixels = left.photoHeight * left.photoWidth;
  const rightPhotoPixels = right.photoHeight * right.photoWidth;
  if (leftPhotoPixels > rightPhotoPixels) leftPoints += 5;
  if (rightPhotoPixels > leftPhotoPixels) rightPoints += 5;

  // if (left.videoHeight != null && left.videoWidth != null && right.videoHeight != null && right.videoWidth != null) {
  //   const leftVideoPixels = left.videoWidth * left.videoHeight ?? 0;
  //   const rightVideoPixels = right.videoWidth * right.videoHeight ?? 0;
  //   if (leftVideoPixels > rightVideoPixels) leftPoints += 3;
  //   if (rightVideoPixels > leftVideoPixels) rightPoints += 3;
  // }

  const leftDownscaled = applyScaledMask(
    CAMERA_VIEW_SIZE,
    { width: left.photoHeight, height: left.photoWidth }, // cameras are horizontal, we rotate to portrait
  );
  const rightDownscaled = applyScaledMask(
    CAMERA_VIEW_SIZE,
    { width: right.photoHeight, height: right.photoWidth }, // cameras are horizontal, we rotate to portrait
  );
  const leftOverflow = leftDownscaled.width * leftDownscaled.height - CAMERA_VIEW_PIXELS;
  const rightOverflow = rightDownscaled.width * rightDownscaled.height - CAMERA_VIEW_PIXELS;
  if (leftOverflow < rightOverflow) leftPoints += 3;
  if (rightOverflow < leftOverflow) rightPoints += 3;

  // const leftVideoStabilizationPoints = getVideoStabilizationPoints(left.videoStabilizationModes);
  // const rightVideoStabilizationPoints = getVideoStabilizationPoints(right.videoStabilizationModes);
  // if (leftVideoStabilizationPoints > rightVideoStabilizationPoints) leftPoints += 2;
  // if (rightVideoStabilizationPoints > leftVideoStabilizationPoints) rightPoints += 2;

  // if (left.supportsVideoHDR) leftPoints += 1;
  // if (right.supportsVideoHDR) rightPoints += 1;

  // if (left.supportsPhotoHDR) leftPoints += 1;
  // if (right.supportsPhotoHDR) rightPoints += 1;

  return rightPoints - leftPoints;
};

export const frameRateIncluded = (range: FrameRateRange, fps: number): boolean => fps >= range.minFrameRate && fps <= range.maxFrameRate;

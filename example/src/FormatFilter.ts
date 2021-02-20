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

const applyScaledMask = (
  clippedElementDimensions: Size, // 2376 x 4224 (1.7777 aka 16:9)
  maskDimensions: Size, //            375 x 821  (2.1893 aka 19:9)
): Size => {
  const wScale = maskDimensions.width / clippedElementDimensions.width; //   0.157
  const hScale = maskDimensions.height / clippedElementDimensions.height; // 0.194

  if (wScale < hScale) {
    // aspect ratio of mask has longer height
    return {
      width: clippedElementDimensions.width * (1 + hScale),
      height: clippedElementDimensions.height,
    };
  } else {
    // aspect ratio of mask has longer width
    return {
      width: clippedElementDimensions.width,
      height: clippedElementDimensions.height * (1 + wScale),
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

  if (left.videoHeight != null && left.videoWidth != null && right.videoHeight != null && right.videoWidth != null) {
    const leftVideoPixels = left.videoWidth * left.videoHeight ?? 0;
    const rightVideoPixels = right.videoWidth * right.videoHeight ?? 0;
    if (leftVideoPixels > rightVideoPixels) leftPoints += 3;
    if (rightVideoPixels > leftVideoPixels) rightPoints += 3;
  }

  const leftScaled = applyScaledMask(
    { width: left.photoHeight, height: left.photoWidth }, // cameras are horizontal, we rotate to portrait
    CAMERA_VIEW_SIZE,
  );
  const rightScaled = applyScaledMask(
    { width: right.photoHeight, height: right.photoWidth }, // cameras are horizontal, we rotate to portrait
    CAMERA_VIEW_SIZE,
  );
  const leftOverflow = leftScaled.width * leftScaled.height - left.photoWidth * left.photoHeight;
  console.log(
    `Screen: ${JSON.stringify(CAMERA_VIEW_SIZE)} | Cam ${JSON.stringify({
      width: left.photoHeight,
      height: left.photoWidth,
    })} | Scaled ${JSON.stringify({
      width: Math.round(leftScaled.width),
      height: Math.round(leftScaled.height),
    })} | Overflow ${Math.round(leftOverflow)}`,
  );
  const rightOverflow = rightScaled.width * rightScaled.height - right.photoWidth * right.photoHeight;
  if (leftOverflow > rightOverflow) {
    // left has a higher overflow, aka more pixels that aren't on-screen and therefore wasted. Maybe left is 4:3 and right is 16:9
    leftPoints -= 3;
  }
  if (rightOverflow > leftOverflow) {
    // right has a higher overflow, aka more pixels that aren't on-screen and therefore wasted. Maybe right is 4:3 and left is 16:9
    rightPoints -= 3;
  }

  const leftVideoStabilizationPoints = getVideoStabilizationPoints(left.videoStabilizationModes);
  const rightVideoStabilizationPoints = getVideoStabilizationPoints(right.videoStabilizationModes);
  if (leftVideoStabilizationPoints > rightVideoStabilizationPoints) leftPoints += 2;
  if (rightVideoStabilizationPoints > leftVideoStabilizationPoints) rightPoints += 2;

  if (left.supportsVideoHDR) leftPoints += 1;
  if (right.supportsVideoHDR) rightPoints += 1;

  if (left.supportsPhotoHDR) leftPoints += 1;
  if (right.supportsPhotoHDR) rightPoints += 1;

  return rightPoints - leftPoints;
};

export const frameRateIncluded = (range: FrameRateRange, fps: number): boolean => fps >= range.minFrameRate && fps <= range.maxFrameRate;

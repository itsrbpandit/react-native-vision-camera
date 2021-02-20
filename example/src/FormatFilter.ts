import { SCREEN_HEIGHT, SCREEN_WIDTH, USE_ULTRAWIDE_IF_AVAILABLE } from './Constants';
import type { CameraDevice, CameraDeviceFormat, FrameRateRange } from 'react-native-vision-camera';

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

const getFormatAspectRatioOverflow = (format: CameraDeviceFormat): number => {
  const downscaled = applyScaledMask(
    CAMERA_VIEW_SIZE,
    // cameras are landscape, so we intentionally rotate
    { width: format.photoHeight, height: format.photoWidth },
  );
  return downscaled.width * downscaled.height - CAMERA_VIEW_PIXELS;
};

export const filterFormatsByAspectRatio = (formats: CameraDeviceFormat[]): CameraDeviceFormat[] => {
  const minOverflow = formats.reduce((prev, curr) => {
    const overflow = getFormatAspectRatioOverflow(curr);
    if (overflow < prev) return overflow;
    else return prev;
  }, Number.MAX_SAFE_INTEGER);

  return formats.filter((f) => getFormatAspectRatioOverflow(f) === minOverflow);
};

export const sortFormatByResolution = (left: CameraDeviceFormat, right: CameraDeviceFormat): number => {
  let leftPoints = left.photoHeight * left.photoWidth;
  let rightPoints = right.photoHeight * right.photoWidth;

  if (left.videoHeight != null && left.videoWidth != null && right.videoHeight != null && right.videoWidth != null) {
    leftPoints += left.videoWidth * left.videoHeight ?? 0;
    rightPoints += right.videoWidth * right.videoHeight ?? 0;
  }

  // "returns a negative value if left is better than one"
  return rightPoints - leftPoints;
};

export const frameRateIncluded = (range: FrameRateRange, fps: number): boolean => fps >= range.minFrameRate && fps <= range.maxFrameRate;

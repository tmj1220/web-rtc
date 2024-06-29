/**
 * 常量文件
 */

export const SDKID = "b93f1827e0d144dbbf4f5cf9c7b1ef80";

// 媒体流初始化设置
export const MEDIA_CONSTRAINTS = {
  audio: true,
  video: {
    width: { ideal: 854 },
    height: { ideal: 480 },
    frameRate: { min: 5, max: 30, ideal: 20 },
  },
};

export const CONSTRAINTS_OPTIONS = {
  // "144P": {
  //   width: { ideal: 256 },
  //   height: { ideal: 144 },
  //   frameRate: { min: 5, max: 30, ideal: 20 },
  // },
  // "288P": {
  //   width: { ideal: 512 },
  //   height: { ideal: 288 },
  //   frameRate: { min: 5, max: 30, ideal: 20 },
  // },
  "360P": {
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { min: 5, max: 30, ideal: 20 },
  },
  "480P": {
    width: { ideal: 854 },
    height: { ideal: 480 },
    frameRate: { min: 5, max: 30, ideal: 20 },
  },
  "720P": {
    width: { ideal: 1281 },
    height: { ideal: 721 },
    frameRate: { min: 5, max: 30, ideal: 20 },
  },
  "1080P": {
    width: { ideal: 1921 },
    height: { ideal: 1081 },
    frameRate: { min: 5, max: 30, ideal: 20 },
  },
};

export const DISPLAY_CONSTRAINTS_OPTIONS = {
  // "144P": {
  //   width: { ideal: 256 },
  //   height: { ideal: 144 },
  // },
  // "288P": {
  //   width: { ideal: 512 },
  //   height: { ideal: 288 },
  // },
  "360P": {
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: 10,
  },
  "480P": {
    width: { ideal: 854 },
    height: { ideal: 480 },
    frameRate: 10,
  },
  "720P": {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: 10,
  },
  "1080P": {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: 10,
  },
};

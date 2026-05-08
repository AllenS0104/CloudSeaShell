const camera = require('../shared/core/camera-presets');

describe('相机预设核心', () => {
  test('预设库包含必要字段并能列出选项', () => {
    expect(camera.getAllCameraPresets().length).toBe(Object.keys(camera.CAMERA_PRESETS).length);
    expect(camera.getAllPhonePresets().length).toBe(Object.keys(camera.PHONE_PRESETS).length);
    for (const preset of Object.values(camera.CAMERA_PRESETS)) {
      expect(preset).toEqual(expect.objectContaining({ brand: expect.any(String), model: expect.any(String), sensor: expect.any(String), lenses: expect.any(Object), tips: expect.any(Array) }));
    }
  });

  test('相机推荐按夜间、蓝调、云海慢门和普通风景分支选择参数', () => {
    expect(camera.getCameraRecommendation('missing', 10, { phase: 'daylight' }, 2, 80)).toBeNull();
    const night = camera.getCameraRecommendation('canon-5d4', 2, { phase: 'night' }, 2, 20);
    expect(night.shutter).toBe('15-30s');
    expect(night.iso).toBe('ISO 3200');
    const blue = camera.getCameraRecommendation('sony-a7r5', 6, { phase: 'blue-hour-evening' }, 2, 20);
    expect(blue.shutter).toBe('2-10s');
    const cloud = camera.getCameraRecommendation('nikon-z8', 12, { phase: 'daylight' }, 3, 80);
    expect(cloud.shutter).toContain('ND');
    expect(cloud.altLens).toBeTruthy();
    const normal = camera.getCameraRecommendation('fuji-xt5', 14, { phase: 'daylight' }, 12, 10);
    expect(normal.shutter).toBe('自动');
    expect(normal.lens).toContain('16-55');
  });

  test('手机推荐按夜景、云海、蓝调、黄金和日间分支选择镜头与专业参数', () => {
    expect(camera.getPhoneRecommendation('missing', 80, { phase: 'daylight' }, 2)).toBeNull();
    expect(camera.getPhoneRecommendation('iphone-16pro', 80, { phase: 'night' }, 2).mode).toBe('夜景模式');
    const cloud = camera.getPhoneRecommendation('iphone-16pro', 80, { phase: 'golden-sunrise' }, 2);
    expect(cloud.primaryLens.focal).toBeLessThanOrEqual(15);
    expect(cloud.altLens.focal).toBeGreaterThanOrEqual(60);
    expect(cloud.proSettings.wb).toContain('偏暖');
    expect(camera.getPhoneRecommendation('huawei-p70pro', 20, { phase: 'blue-hour-morning' }, 8).proSettings.iso).toBe('200-800');
    expect(camera.getPhoneRecommendation('pixel-9pro', 20, { phase: 'golden-sunset' }, 8).mode).toBe('HDR 模式');
    expect(camera.getPhoneRecommendation('pixel-9pro', 20, { phase: 'daylight' }, 8).mode).toContain('风景模式');
  });
});

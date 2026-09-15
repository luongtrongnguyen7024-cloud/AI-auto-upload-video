/**
 * PTAT Studio — Tests.gs
 * Các hàm kiểm thử an toàn, không gọi Meta, không gửi token, không ảnh hưởng dữ liệu thật.
 */

/**
 * Kiểm tra an toàn cấu hình hệ thống (không gọi Meta, không lộ token)
 */
function validateDirectReelPublisherConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const hasToken = Boolean(properties.getProperty(PTAT_CONFIG.META_PAGE_ACCESS_TOKEN_PROPERTY));
  const today = todayKey_();
  const currentSlot = getCurrentSlot_();
  const candidate = findPublishCandidate_(today, currentSlot);

  const triggers = getTriggersStatus();

  const report = {
    tokenStored: hasToken,
    currentSlot: currentSlot,
    today: today,
    eligibleContentId: candidate ? candidate.contentId : null,
    publisherTriggerEnabled: triggers.publishScheduleEnabled,
    driveTriggerEnabled: triggers.driveSyncEnabled,
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * Kiểm thử cấu trúc cột Sheet và tự động bổ sung cột Phase 1
 */
function testQueueStructure_() {
  ensureExtendedColumnsExist_();
  const rows = listAllQueueRows_();
  console.log(`Kiểm thử cấu trúc Sheet thành công. Đọc được ${rows.length} hàng.`);
  return { rowCount: rows.length, sample: rows[0] || null };
}

/**
 * Kiểm thử ánh xạ slot giờ
 */
function testSlotMapping_() {
  const morning = getCurrentSlot_(new Date(2026, 8, 15, 8, 15));
  const noon = getCurrentSlot_(new Date(2026, 8, 15, 12, 5));
  const evening = getCurrentSlot_(new Date(2026, 8, 15, 20, 0));

  console.log({
    testMorning: morning === 'SÁNG' ? 'PASS' : 'FAIL',
    testNoon: noon === 'TRƯA' ? 'PASS' : 'FAIL',
    testEvening: evening === 'TỐI' ? 'PASS' : 'FAIL',
  });
}

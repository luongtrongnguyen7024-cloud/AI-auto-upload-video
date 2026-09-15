/**
 * PTAT Studio — ScheduleService.gs
 * Quản lý ánh xạ slot giờ (Sáng / Trưa / Tối), ngày đăng và cấu hình Triggers.
 */

/**
 * Trả về key ngày hôm nay theo múi giờ cấu hình (yyyy-MM-dd)
 */
function todayKey_() {
  return Utilities.formatDate(new Date(), PTAT_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

/**
 * Chuẩn hóa chuỗi ngày đăng về định dạng yyyy-MM-dd
 */
function scheduledDateKey_(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

/**
 * Xác định slot hiện tại dựa trên giờ chạy của Trigger
 * SÁNG: ~08:00 (07:00 - 10:00)
 * TRƯA: ~12:00 (11:00 - 15:00)
 * TỐI: ~20:00 (19:00 - 23:00)
 */
function getCurrentSlot_(optDate) {
  const date = optDate || new Date();
  const hourStr = Utilities.formatDate(date, PTAT_CONFIG.TIME_ZONE, 'H');
  const hour = parseInt(hourStr, 10);

  if (hour >= 6 && hour <= 10) return 'SÁNG';
  if (hour >= 11 && hour <= 15) return 'TRƯA';
  if (hour >= 18 && hour <= 23) return 'TỐI';

  // Nếu nằm ngoài khung, trả về slot gần nhất
  if (hour < 6) return 'SÁNG';
  if (hour > 15 && hour < 18) return 'TRƯA';
  return 'TỐI';
}

/**
 * Tạo lại trigger quét Drive mỗi 15 phút
 */
function createOrResetQuarterHourTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === PTAT_CONFIG.HANDLER)
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger(PTAT_CONFIG.HANDLER)
    .timeBased()
    .everyMinutes(15)
    .create();

  logOperation_('SCHEDULE', 'SYSTEM', 'OK', 'Đã đặt lại trigger đồng bộ Drive 15 phút', 'Operator');
}

/**
 * Tạo lại 3 trigger đăng Reel hằng ngày vào 08:00, 12:00, 20:00
 */
function createOrResetReelPublishTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER)
    .forEach((t) => ScriptApp.deleteTrigger(t));

  PTAT_CONFIG.PUBLISH_SCHEDULE_HOURS.forEach((hour) => {
    ScriptApp.newTrigger(PTAT_CONFIG.PUBLISH_HANDLER)
      .timeBased()
      .atHour(hour)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone(PTAT_CONFIG.TIME_ZONE)
      .create();
  });

  logOperation_('SCHEDULE', 'SYSTEM', 'OK', 'Đã đặt lại 3 trigger đăng Reel (08h, 12h, 20h)', 'Operator');
}

/**
 * Tắt khẩn cấp lịch publisher (chỉ xóa 3 trigger đăng, giữ nguyên trigger Drive)
 */
function disableReelPublishTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER);

  triggers.forEach((t) => ScriptApp.deleteTrigger(t));

  logOperation_('SCHEDULE', 'SYSTEM', 'WARN', `Đã tắt khẩn cấp ${triggers.length} trigger publisher`, 'Operator');
  return { success: true, removedCount: triggers.length };
}

/**
 * Đọc trạng thái các Triggers hiện tại trong Apps Script
 */
function getTriggersStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const driveTriggers = triggers.filter((t) => t.getHandlerFunction() === PTAT_CONFIG.HANDLER);
  const publishTriggers = triggers.filter((t) => t.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER);

  return {
    driveSyncEnabled: driveTriggers.length > 0,
    driveSyncCount: driveTriggers.length,
    publishScheduleEnabled: publishTriggers.length > 0,
    publishScheduleCount: publishTriggers.length,
    totalTriggers: triggers.length,
  };
}

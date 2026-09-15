/**
 * PTAT Studio — AuditService.gs
 * Ghi nhật ký kiểm toán (Operations Log) an toàn, append-only, không chứa token hay secret.
 */

const AUDIT_HEADERS = Object.freeze([
  'Thời gian',
  'Loại thao tác',
  'Content ID',
  'Kết quả',
  'Diễn giải rút gọn',
  'Người thao tác',
]);

/**
 * Lấy hoặc khởi tạo tab Operations Log nếu chưa có
 */
function getLogSheet_() {
  const ss = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(PTAT_CONFIG.LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PTAT_CONFIG.LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setFontWeight('bold').setBackground('#E2E8F0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Ghi 1 dòng audit log
 * @param {string} actionType - UPLOAD | APPROVE | REJECT | SYNC | PUBLISH | LOCK_CLEAR | SCHEDULE
 * @param {string} contentId - Mã PTAT-xxx hoặc 'SYSTEM'
 * @param {string} result - OK | ERROR | WARN
 * @param {string} message - Diễn giải ngắn đã lọc
 * @param {string} actor - 'Operator' | 'Trigger' | 'System'
 */
function logOperation_(actionType, contentId, result, message, actor) {
  try {
    const sheet = getLogSheet_();
    const timestamp = Utilities.formatDate(new Date(), PTAT_CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
    const sanitizedMsg = sanitizeAuditMessage_(message);
    const sanitizedActor = actor || 'Operator';

    sheet.appendRow([
      timestamp,
      actionType || 'INFO',
      contentId || '-',
      result || 'OK',
      sanitizedMsg,
      sanitizedActor,
    ]);
  } catch (err) {
    console.error('Không thể ghi audit log: ' + err.message);
  }
}

/**
 * Lấy danh sách audit log gần nhất để hiển thị lên Dashboard
 * @param {number} limit - Số dòng lấy (mặc định 50)
 */
function getOperationsLog(limit) {
  try {
    const sheet = getLogSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const numRows = Math.min(limit || 50, lastRow - 1);
    const startRow = lastRow - numRows + 1;
    const values = sheet.getRange(startRow, 1, numRows, AUDIT_HEADERS.length).getDisplayValues();

    // Đảo ngược để dòng mới nhất lên đầu
    return values.reverse().map((row) => ({
      timestamp: row[0],
      action: row[1],
      contentId: row[2],
      result: row[3],
      message: row[4],
      actor: row[5],
    }));
  } catch (err) {
    console.error('Lỗi khi đọc audit log: ' + err.message);
    return [];
  }
}

/**
 * Lọc sạch mọi khả năng chứa token hoặc chuỗi nhạy cảm
 */
function sanitizeAuditMessage_(msg) {
  if (!msg) return '';
  let str = String(msg);
  // Loại bỏ token pattern thông thường nếu có
  str = str.replace(/EAA[A-Za-z0-9]+/g, '[REDACTED_TOKEN]');
  str = str.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  return str.substring(0, 500); // Giới hạn độ dài để không tràn ô
}

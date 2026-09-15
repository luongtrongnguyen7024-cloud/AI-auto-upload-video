/**
 * PTAT STUDIO — GOOGLE APPS SCRIPT BUNDLE (ALL-IN-ONE)
 * Tự động tạo từ các module: Config.gs, AuditService.gs, QueueRepository.gs, DriveService.gs, ScheduleService.gs, ApprovalService.gs, ReelPublisher.gs, DashboardApi.gs, Tests.gs
 */

/* ==========================================================================
 * MODULE: Config.gs
 * ========================================================================== */

/**
 * PTAT Studio — Config.gs
 * Cấu hình hệ thống, hằng số không nhạy cảm, tên tab, slot và giới hạn an toàn.
 */

const PTAT_CONFIG = Object.freeze({
  // Google Sheet & Drive IDs
  SPREADSHEET_ID: '1ut8gLmqhQC_5mWm-CxqgF-L-4ugFhjtoxvDkyIdK5s0',
  SHEET_NAME: 'Content Queue',
  LOG_SHEET_NAME: 'Operations Log',
  INTAKE_FOLDER_ID: '1iMihy_Ge2gQV3nmXj0i7QuZ8RRtJPm6Q',

  // Nhận diện file
  VIDEO_NAME: /^(PTAT-\d+)\.mp4$/i,

  // Handlers cho Trigger
  HANDLER: 'syncDriveVideosToQueue',
  PUBLISH_HANDLER: 'publishReadyReelToFacebook',

  // Cấu hình thời gian & Slot
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
  PUBLISH_SCHEDULE_HOURS: Object.freeze([8, 12, 20]),
  SLOTS: Object.freeze({
    'SÁNG': { hour: 8, label: '08:00 (Sáng)' },
    'TRƯA': { hour: 12, label: '12:00 (Trưa)' },
    'TỐI': { hour: 20, label: '20:00 (Tối)' },
  }),

  // Giới hạn vận hành & An toàn
  MAX_REELS_PER_DAY: 3,
  MAX_URLFETCH_FILE_BYTES: 50 * 1024 * 1024, // 50 MB

  // Meta Graph API
  META_GRAPH_VERSION: 'v26.0',

  // Script Properties Keys (Chỉ lưu ở Script Properties, không in ra client)
  META_PAGE_ACCESS_TOKEN_PROPERTY: 'PTAT_META_PAGE_ACCESS_TOKEN',
  META_IN_FLIGHT_PROPERTY: 'PTAT_REEL_IN_FLIGHT',
  META_DAILY_COUNT_PROPERTY: 'PTAT_REEL_DAILY_COUNT',
});

// Các cột chuẩn bắt buộc trong Content Queue
const REQUIRED_HEADERS = Object.freeze([
  'Content ID',
  'Trạng thái video',
  'Trạng thái đăng tự động',
  'Trạng thái đăng',
  'Ngày đăng',
  'File video (Drive)',
  'Caption Facebook',
]);

// Các cột Phase 1 bổ sung (Cổng duyệt & Slot & Audit)
const EXTENDED_HEADERS = Object.freeze([
  'Duyệt đăng',        // CHỜ DUYỆT | ĐÃ DUYỆT | TỪ CHỐI
  'Slot đăng',         // SÁNG | TRƯA | TỐI
  'Đã duyệt lúc',      // ISO timestamp
  'Lý do từ chối',     // Text
  'Đã đăng lúc',       // ISO timestamp
  'Meta Reel ID',      // Facebook Video ID
  'Lỗi đăng gần nhất', // Short error message
]);


/* ==========================================================================
 * MODULE: AuditService.gs
 * ========================================================================== */

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


/* ==========================================================================
 * MODULE: QueueRepository.gs
 * ========================================================================== */

/**
 * PTAT Studio — QueueRepository.gs
 * Đọc, ghi và chuẩn hóa dữ liệu Content Queue an toàn trên Google Sheets.
 */

/**
 * Lấy toàn bộ hàng đợi Content Queue kèm thông tin header đã chuẩn hóa
 */
function getQueueSheetContext_() {
  const ss = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PTAT_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Không tìm thấy tab: ${PTAT_CONFIG.SHEET_NAME}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 1) throw new Error('Bảng Content Queue rỗng');

  const headers = values[0];
  const column = indexHeaders_(headers);

  return { sheet, values, column };
}

/**
 * Tự động kiểm tra và thêm các cột Phase 1 nếu chưa tồn tại trong hàng tiêu đề
 */
function ensureExtendedColumnsExist_() {
  const ss = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PTAT_CONFIG.SHEET_NAME);
  if (!sheet) return;

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const normalizedHeaders = currentHeaders.map(normalize_);

  const missingColumns = [];
  EXTENDED_HEADERS.forEach((colName) => {
    if (!normalizedHeaders.includes(normalize_(colName))) {
      missingColumns.push(colName);
    }
  });

  if (missingColumns.length > 0) {
    const startCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, startCol, 1, missingColumns.length).setValues([missingColumns]);
    sheet.getRange(1, startCol, 1, missingColumns.length).setFontWeight('bold');
    console.log(`Đã tự động thêm các cột mở rộng: ${missingColumns.join(', ')}`);
  }
}

/**
 * Đọc toàn bộ danh sách hàng trong Content Queue thành mảng object
 */
function listAllQueueRows_() {
  ensureExtendedColumnsExist_();
  const { values, column } = getQueueSheetContext_();
  if (values.length < 2) return [];

  const list = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const contentId = normalize_(row[column['CONTENT ID']]);
    if (!contentId) continue;

    list.push({
      rowNumber: i + 1,
      contentId: contentId,
      channel: row[column['KÊNH']] || '',
      format: row[column['ĐỊNH DẠNG']] || '',
      pillar: row[column['TRỤ NỘI DUNG']] || '',
      idea: row[column['Ý TƯỞNG']] || '',
      hook: row[column['HOOK MỞ ĐẦU']] || '',
      script: row[column['KỊCH BẢN']] || '',
      caption: row[column['CAPTION FACEBOOK']] || '',
      videoStatus: normalize_(row[column['TRẠNG THÁI VIDEO']]) || 'CHƯA CÓ',
      autoStatus: normalize_(row[column['TRẠNG THÁI ĐĂNG TỰ ĐỘNG']]) || 'CHƯA',
      approvalStatus: normalize_(row[column['DUYỆT ĐĂNG']]) || 'CHƯA',
      scheduledDate: row[column['NGÀY ĐĂNG']] || '',
      slot: normalize_(row[column['SLOT ĐĂNG']]) || '',
      driveUrl: row[column['FILE VIDEO (DRIVE)']] || '',
      postUrl: row[column['LINK BÀI/REEL']] || '',
      postingStatus: normalize_(row[column['TRẠNG THÁI ĐĂNG']]) || 'CHƯA ĐĂNG',
      approvedAt: row[column['ĐÃ DUYỆT LÚC']] || '',
      rejectionReason: row[column['LÝ DO TỪ CHỐI']] || '',
      publishedAt: row[column['ĐÃ ĐĂNG LÚC']] || '',
      metaReelId: row[column['META REEL ID']] || '',
      lastError: row[column['LỖI ĐĂNG GẦN NHẤT']] || '',
    });
  }

  return list;
}

/**
 * Cập nhật một số ô cho một hàng theo tên cột
 * @param {number} rowNumber - Hàng trên Sheet (1-indexed)
 * @param {Object} updates - Map tên cột -> giá trị mới
 */
function updateQueueRow_(rowNumber, updates) {
  const { sheet, column } = getQueueSheetContext_();

  Object.keys(updates).forEach((colName) => {
    const colIdx = column[normalize_(colName)];
    if (colIdx !== undefined) {
      const cell = sheet.getRange(rowNumber, colIdx + 1);
      const val = updates[colName];
      cell.setValue(allowedDropdownValue_(cell, val));
    } else {
      console.warn(`Không tìm thấy cột ${colName} để cập nhật.`);
    }
  });
}

/**
 * Tìm hàng theo Content ID
 */
function findRowByContentId_(contentId) {
  const rows = listAllQueueRows_();
  const targetId = normalize_(contentId);
  return rows.find((r) => r.contentId === targetId) || null;
}

function indexHeaders_(headers) {
  const positions = {};
  headers.forEach((header, index) => {
    positions[normalize_(header)] = index;
  });

  const missing = REQUIRED_HEADERS.filter((h) => positions[normalize_(h)] === undefined);
  if (missing.length > 0) {
    throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}`);
  }
  return positions;
}

function normalize_(value) {
  return String(value || '').normalize('NFC').trim().toUpperCase();
}

function allowedDropdownValue_(cell, fallback) {
  try {
    const rule = cell.getDataValidation();
    if (!rule) return fallback;

    const source = rule.getCriteriaValues()[0];
    const values = Array.isArray(source)
      ? source
      : source && typeof source.getDisplayValues === 'function'
        ? source.getDisplayValues().flat()
        : [];

    return values.find((val) => normalize_(val) === normalize_(fallback)) || fallback;
  } catch (e) {
    return fallback;
  }
}


/* ==========================================================================
 * MODULE: DriveService.gs
 * ========================================================================== */

/**
 * PTAT Studio — DriveService.gs
 * Quản lý đồng bộ Drive, quét thư mục đầu vào và upload video an toàn từ giao diện.
 */

/**
 * Quét thư mục Drive đầu vào (được trigger 15 phút gọi hoặc bấm Quét ngay từ UI)
 */
function syncDriveVideosToQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log('Quá trình đồng bộ Drive khác đang chạy.');
    return { updated: 0, message: 'Đang có tiến trình đồng bộ khác chạy' };
  }

  try {
    ensureExtendedColumnsExist_();
    const rows = listAllQueueRows_();
    const rowsByContentId = new Map();
    rows.forEach((r) => rowsByContentId.set(r.contentId, r));

    const folder = DriveApp.getFolderById(PTAT_CONFIG.INTAKE_FOLDER_ID);
    const files = folder.getFiles();
    let updated = 0;

    while (files.hasNext()) {
      const file = files.next();
      const match = file.getName().match(PTAT_CONFIG.VIDEO_NAME);
      if (!match) continue;

      const contentId = match[1].toUpperCase();
      const item = rowsByContentId.get(contentId);
      if (!item) {
        console.log(`Bỏ qua ${file.getName()}: không tìm thấy dòng cho ${contentId}`);
        continue;
      }

      // Giữ nguyên quyết định của người vận hành và các bài đã đăng
      if (
        item.autoStatus === 'BỎ QUA' ||
        item.autoStatus === 'ĐÃ ĐĂNG' ||
        item.postingStatus === 'BỎ QUA' ||
        item.postingStatus === 'ĐÃ ĐĂNG'
      ) {
        continue;
      }

      // Nếu video đã có link và đã là VIDEO_READY thì không cập nhật lại
      if (item.videoStatus === 'VIDEO_READY' && item.driveUrl) {
        continue;
      }

      const updates = {
        'Trạng thái video': 'VIDEO_READY',
        'File video (Drive)': file.getUrl(),
      };

      // Đổi sang CHỜ DUYỆT nếu chưa có quyết định duyệt
      if (!item.approvalStatus || item.approvalStatus === 'CHƯA') {
        updates['Duyệt đăng'] = 'CHỜ DUYỆT';
      }

      if (!item.postingStatus) {
        updates['Trạng thái đăng'] = 'CHƯA ĐĂNG';
      }

      // LƯU Ý BẢO MẬT: KHÔNG tự động chuyển sang SẴN SÀNG ĐĂNG.
      // Người vận hành phải bấm duyệt trên Dashboard!

      updateQueueRow_(item.rowNumber, updates);
      logOperation_('SYNC_DRIVE', contentId, 'OK', `Nhận diện ${file.getName()} -> CHỜ DUYỆT`, 'System');
      updated += 1;
    }

    console.log(`Đồng bộ Drive hoàn tất. Đã cập nhật ${updated} hàng.`);
    return { updated, message: `Hoàn tất đồng bộ. Cập nhật ${updated} video.` };
  } catch (err) {
    console.error('Lỗi khi đồng bộ Drive: ' + err.message);
    logOperation_('SYNC_DRIVE', 'SYSTEM', 'ERROR', err.message, 'System');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Nhận file upload trực tiếp từ Upload Studio trên Dashboard
 * @param {Object} formObject - Chứa contentId và videoFile (Blob)
 */
function uploadReelVideoFromForm(formObject) {
  const contentId = normalize_(formObject && formObject.contentId);
  if (!contentId) throw new Error('Vui lòng chọn Content ID hợp lệ.');

  const fileBlob = formObject.videoFile;
  if (!fileBlob) throw new Error('Không nhận được dữ liệu video.');

  const item = findRowByContentId_(contentId);
  if (!item) throw new Error(`Không tìm thấy Content ID ${contentId} trong hàng đợi.`);

  if (item.postingStatus === 'ĐÃ ĐĂNG') {
    throw new Error(`Nội dung ${contentId} đã đăng thành công, không thể ghi đè.`);
  }

  const bytes = fileBlob.getBytes();
  const fileSize = bytes.length;
  if (fileSize > PTAT_CONFIG.MAX_URLFETCH_FILE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    throw new Error(`Video dung lượng ${sizeMb} MB vượt quá giới hạn 50 MB của hệ thống.`);
  }

  // Đặt tên chuẩn PTAT-xxx.mp4
  const expectedName = `${contentId}.mp4`;
  fileBlob.setName(expectedName);
  fileBlob.setContentType('video/mp4');

  const folder = DriveApp.getFolderById(PTAT_CONFIG.INTAKE_FOLDER_ID);

  // Kiểm tra nếu đã có file cũ cùng tên thì xóa hoặc di chuyển
  const existingFiles = folder.getFilesByName(expectedName);
  while (existingFiles.hasNext()) {
    const oldFile = existingFiles.next();
    oldFile.setTrashed(true);
  }

  const newFile = folder.createFile(fileBlob);
  const driveUrl = newFile.getUrl();

  // Cập nhật trạng thái Sheet
  const updates = {
    'Trạng thái video': 'VIDEO_READY',
    'File video (Drive)': driveUrl,
    'Duyệt đăng': 'CHỜ DUYỆT',
  };
  if (!item.postingStatus) {
    updates['Trạng thái đăng'] = 'CHƯA ĐĂNG';
  }

  updateQueueRow_(item.rowNumber, updates);

  const sizeMb = (fileSize / (1024 * 1024)).toFixed(2);
  logOperation_(
    'UPLOAD',
    contentId,
    'OK',
    `Upload ${expectedName} (${sizeMb} MB) -> CHỜ DUYỆT`,
    'Operator',
  );

  return {
    success: true,
    contentId: contentId,
    driveUrl: driveUrl,
    fileName: expectedName,
    sizeMb: sizeMb,
  };
}

/**
 * Trích xuất Drive file ID từ URL
 */
function driveFileId_(url) {
  const pathMatch = String(url).match(/\/d\/([A-Za-z0-9_-]+)/);
  const queryMatch = String(url).match(/[?&]id=([A-Za-z0-9_-]+)/);
  const fileId = (pathMatch && pathMatch[1]) || (queryMatch && queryMatch[1]);
  if (!fileId) throw new Error('Không thể đọc ID tệp Drive từ URL.');
  return fileId;
}


/* ==========================================================================
 * MODULE: ScheduleService.gs
 * ========================================================================== */

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


/* ==========================================================================
 * MODULE: ApprovalService.gs
 * ========================================================================== */

/**
 * PTAT Studio — ApprovalService.gs
 * Cổng kiểm duyệt người thật (Human-in-the-loop Approval Gate) và cập nhật bản nháp.
 */

/**
 * Duyệt đăng một Reel đủ điều kiện
 * @param {string} contentId - Mã PTAT-xxx
 */
function approveReel(contentId) {
  const normalizedId = normalize_(contentId);
  const item = findRowByContentId_(normalizedId);
  if (!item) throw new Error(`Không tìm thấy hàng ${normalizedId} trong hàng đợi.`);

  if (item.postingStatus === 'ĐÃ ĐĂNG') {
    throw new Error(`${normalizedId} đã được đăng trước đó.`);
  }

  if (item.videoStatus !== 'VIDEO_READY' || !item.driveUrl) {
    throw new Error(`${normalizedId} chưa có video tải lên Drive.`);
  }

  if (!item.caption || item.caption.trim().length === 0) {
    throw new Error(`${normalizedId} chưa có Caption Facebook.`);
  }

  if (!item.scheduledDate) {
    throw new Error(`${normalizedId} chưa có Ngày đăng.`);
  }

  if (!item.slot || !['SÁNG', 'TRƯA', 'TỐI'].includes(item.slot)) {
    throw new Error(`${normalizedId} chưa chọn Slot đăng hợp lệ (SÁNG / TRƯA / TỐI).`);
  }

  const nowStr = Utilities.formatDate(new Date(), PTAT_CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
  const updates = {
    'Duyệt đăng': 'ĐÃ DUYỆT',
    'Trạng thái đăng tự động': 'SẴN SÀNG ĐĂNG',
    'Đã duyệt lúc': nowStr,
    'Lý do từ chối': '',
  };

  updateQueueRow_(item.rowNumber, updates);
  logOperation_(
    'APPROVE',
    normalizedId,
    'OK',
    `Đã duyệt đăng [Ngày: ${item.scheduledDate} | Slot: ${item.slot}]`,
    'Operator'
  );

  return {
    success: true,
    contentId: normalizedId,
    message: `Đã duyệt ${normalizedId} sẵn sàng đăng vào slot ${item.slot} ngày ${item.scheduledDate}.`,
  };
}

/**
 * Từ chối duyệt một Reel kèm lý do bắt buộc
 * @param {string} contentId - Mã PTAT-xxx
 * @param {string} reason - Lý do từ chối (bắt buộc)
 */
function rejectReel(contentId, reason) {
  const normalizedId = normalize_(contentId);
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('Vui lòng nhập lý do từ chối để lưu vào nhật ký.');
  }

  const item = findRowByContentId_(normalizedId);
  if (!item) throw new Error(`Không tìm thấy hàng ${normalizedId} trong hàng đợi.`);

  if (item.postingStatus === 'ĐÃ ĐĂNG') {
    throw new Error(`${normalizedId} đã đăng thành công, không thể từ chối.`);
  }

  const updates = {
    'Duyệt đăng': 'TỪ CHỐI',
    'Trạng thái đăng tự động': 'CHƯA',
    'Lý do từ chối': cleanReason,
  };

  updateQueueRow_(item.rowNumber, updates);
  logOperation_(
    'REJECT',
    normalizedId,
    'WARN',
    `Từ chối duyệt: ${cleanReason}`,
    'Operator'
  );

  return {
    success: true,
    contentId: normalizedId,
    reason: cleanReason,
  };
}

/**
 * Sửa thông tin bản nháp (caption, ngày đăng, slot đăng) từ Dashboard
 * @param {Object} draftData - { contentId, caption, scheduledDate, slot }
 */
function saveReelDraft(draftData) {
  if (!draftData || !draftData.contentId) {
    throw new Error('Dữ liệu bản nháp không hợp lệ.');
  }

  const normalizedId = normalize_(draftData.contentId);
  const item = findRowByContentId_(normalizedId);
  if (!item) throw new Error(`Không tìm thấy ${normalizedId}`);

  if (item.postingStatus === 'ĐÃ ĐĂNG') {
    throw new Error(`${normalizedId} đã đăng, không thể sửa kịch bản hoặc lịch.`);
  }

  const updates = {};
  if (draftData.caption !== undefined) {
    updates['Caption Facebook'] = draftData.caption.trim();
  }
  if (draftData.scheduledDate !== undefined) {
    updates['Ngày đăng'] = draftData.scheduledDate.trim();
  }
  if (draftData.slot !== undefined) {
    const slotVal = normalize_(draftData.slot);
    if (['SÁNG', 'TRƯA', 'TỐI', ''].includes(slotVal)) {
      updates['Slot đăng'] = slotVal;
    }
  }

  updateQueueRow_(item.rowNumber, updates);
  logOperation_('EDIT_DRAFT', normalizedId, 'OK', 'Cập nhật caption / ngày / slot', 'Operator');

  return { success: true, contentId: normalizedId };
}


/* ==========================================================================
 * MODULE: ReelPublisher.gs
 * ========================================================================== */

/**
 * PTAT Studio — ReelPublisher.gs
 * Bộ xuất bản Facebook Reels trực tiếp qua Meta Graph API v26.0.
 * Chỉ file này được phép đọc PTAT_META_PAGE_ACCESS_TOKEN từ Script Properties.
 */

/**
 * Hàm đăng Reel được 3 Trigger thời gian gọi vào các mốc 08:00, 12:00, 20:00
 */
function publishReadyReelToFacebook() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log('Tiến trình đăng Reel khác đang chạy.');
    return;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty(PTAT_CONFIG.META_PAGE_ACCESS_TOKEN_PROPERTY);
    if (!token) {
      throw new Error('Chưa cấu hình Page Access Token trong Script Properties.');
    }

    const day = todayKey_();
    const daily = readDailyCount_(properties, day);
    if (daily.count >= PTAT_CONFIG.MAX_REELS_PER_DAY) {
      console.log(`Đã đạt giới hạn tối đa ${PTAT_CONFIG.MAX_REELS_PER_DAY} Reel trong ngày ${day}.`);
      return;
    }

    // Cơ chế Fail-Closed: Nếu có khóa recovery lock dở dang, KHÔNG tự thử lại
    if (properties.getProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY)) {
      console.warn('Đang tồn tại khóa Recovery Lock. Vui lòng kiểm tra Fanpage trước khi gỡ khóa.');
      logOperation_('PUBLISH', 'SYSTEM', 'WARN', 'Dừng đăng do còn Recovery Lock', 'System');
      return;
    }

    const currentSlot = getCurrentSlot_();
    const candidate = findPublishCandidate_(day, currentSlot);
    if (!candidate) {
      console.log(`Không có Reel nào đủ điều kiện đăng cho slot ${currentSlot} ngày ${day}.`);
      return;
    }

    const file = DriveApp.getFileById(driveFileId_(candidate.driveUrl));
    const blob = file.getBlob().setName(file.getName());
    const fileSize = blob.getBytes().length;

    if (fileSize > PTAT_CONFIG.MAX_URLFETCH_FILE_BYTES) {
      const err = `Video ${file.getName()} (${(fileSize / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn 50 MB.`;
      markPostingStatus_(candidate.rowNumber, 'LỖI', err);
      logOperation_('PUBLISH', candidate.contentId, 'ERROR', err, 'System');
      throw new Error(err);
    }

    // Đặt recovery lock trước khi gọi Meta
    properties.setProperty(
      PTAT_CONFIG.META_IN_FLIGHT_PROPERTY,
      JSON.stringify({
        contentId: candidate.contentId,
        rowNumber: candidate.rowNumber,
        slot: currentSlot,
        startedAt: new Date().toISOString(),
      })
    );

    let metaPublishFinished = false;
    try {
      // 1. Start upload session
      const started = metaFormPost_(
        `https://graph.facebook.com/${PTAT_CONFIG.META_GRAPH_VERSION}/me/video_reels`,
        { upload_phase: 'start' },
        token
      );

      const uploadUrl = started && (started.upload_url || (started.data && started.data.upload_url));
      const videoId = started && (started.video_id || (started.data && started.data.video_id));
      if (!uploadUrl || !videoId) {
        throw new Error('Meta không trả về upload_url hoặc video_id.');
      }

      // 2. Binary upload bytes
      uploadReelBytes_(uploadUrl, token, blob, fileSize);

      // 3. Finish publish
      metaFormPost_(
        `https://graph.facebook.com/${PTAT_CONFIG.META_GRAPH_VERSION}/me/video_reels`,
        {
          upload_phase: 'finish',
          video_id: videoId,
          video_state: 'PUBLISHED',
          description: candidate.caption,
          title: candidate.contentId,
        },
        token
      );
      metaPublishFinished = true;

      // 4. Cập nhật thành công vào Sheet
      const nowStr = Utilities.formatDate(new Date(), PTAT_CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
      updateQueueRow_(candidate.rowNumber, {
        'Trạng thái đăng': 'ĐÃ ĐĂNG',
        'Đã đăng lúc': nowStr,
        'Meta Reel ID': String(videoId),
        'Lỗi đăng gần nhất': '',
      });

      // 5. Tăng đếm ngày và xóa khóa recovery
      properties.setProperty(
        PTAT_CONFIG.META_DAILY_COUNT_PROPERTY,
        JSON.stringify({ day, count: daily.count + 1 })
      );
      properties.deleteProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);

      const successMsg = `Đã đăng thành công ${candidate.contentId} (Slot: ${currentSlot}); Tổng ngày: ${daily.count + 1}/3.`;
      console.log(successMsg);
      logOperation_('PUBLISH', candidate.contentId, 'OK', successMsg, 'System');
    } catch (error) {
      if (!metaPublishFinished) {
        try {
          markPostingStatus_(candidate.rowNumber, 'LỖI', error.message);
        } catch (statusErr) {
          console.error('Không thể đánh dấu trạng thái LỖI vào Sheet.');
        }
      }
      logOperation_('PUBLISH', candidate.contentId, 'ERROR', `Thất bại: ${error.message}`, 'System');
      console.warn('Publisher dừng; giữ nguyên recovery lock để người vận hành kiểm tra Page.');
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Tìm Reel đủ điều kiện xuất bản
 * ĐIỀU KIỆN CHẶT CHẼ BẮT BUỘC:
 * 1. Trạng thái video = VIDEO_READY
 * 2. Duyệt đăng = ĐÃ DUYỆT (Cổng duyệt người)
 * 3. Trạng thái đăng tự động = SẴN SÀNG ĐĂNG
 * 4. Trạng thái đăng = CHƯA ĐĂNG
 * 5. Ngày đăng = Hôm nay
 * 6. Slot đăng = Slot hiện tại (hoặc khớp slot)
 * 7. Có Caption và Link Drive hợp lệ
 */
function findPublishCandidate_(targetDay, targetSlot) {
  const rows = listAllQueueRows_();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isVideoReady = r.videoStatus === 'VIDEO_READY';
    const isApproved = r.approvalStatus === 'ĐÃ DUYỆT';
    const isReadyToPost = r.autoStatus === 'SẴN SÀNG ĐĂNG';
    const isUnpublished = r.postingStatus === 'CHƯA ĐĂNG';
    const isToday = scheduledDateKey_(r.scheduledDate) === targetDay;
    const isMatchingSlot = !targetSlot || r.slot === targetSlot || r.slot === '';
    const hasCaption = Boolean(r.caption && r.caption.trim().length > 0);
    const hasDriveUrl = Boolean(r.driveUrl && r.driveUrl.trim().length > 0);

    if (
      isVideoReady &&
      isApproved &&
      isReadyToPost &&
      isUnpublished &&
      isToday &&
      isMatchingSlot &&
      hasCaption &&
      hasDriveUrl
    ) {
      return r;
    }
  }

  return null;
}

function markPostingStatus_(rowNumber, status, optError) {
  const updates = { 'Trạng thái đăng': status };
  if (optError) updates['Lỗi đăng gần nhất'] = sanitizeAuditMessage_(optError);
  updateQueueRow_(rowNumber, updates);
}

function readDailyCount_(properties, day) {
  const saved = JSON.parse(properties.getProperty(PTAT_CONFIG.META_DAILY_COUNT_PROPERTY) || '{}');
  return saved.day === day ? { day, count: Number(saved.count) || 0 } : { day, count: 0 };
}

function metaFormPost_(endpoint, fields, token) {
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: Object.assign({}, fields, { access_token: token }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(metaResponseError_('Meta request', response));
  }
  try {
    return JSON.parse(response.getContentText());
  } catch (err) {
    throw new Error('Meta trả về JSON không hợp lệ.');
  }
}

function uploadReelBytes_(uploadUrl, token, blob, fileSize) {
  const response = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: 'application/octet-stream',
    headers: {
      Authorization: `OAuth ${token}`,
      offset: '0',
      file_size: String(fileSize),
    },
    payload: blob,
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(metaResponseError_('Meta binary upload', response));
  }
}

function metaResponseError_(label, response) {
  const status = response.getResponseCode();
  try {
    const metaError = JSON.parse(response.getContentText()).error;
    if (metaError && typeof metaError === 'object') {
      const details = [
        metaError.type && `type=${metaError.type}`,
        metaError.code !== undefined && `code=${metaError.code}`,
        metaError.error_subcode !== undefined && `subcode=${metaError.error_subcode}`,
        metaError.message && `message=${String(metaError.message).replace(/\s+/g, ' ')}`,
      ]
        .filter(Boolean)
        .join('; ');
      if (details) return `${label} thất bại (HTTP ${status}): ${details}`;
    }
  } catch (err) {
    // Bỏ qua lỗi parse
  }
  return `${label} thất bại (HTTP ${status})`;
}

/**
 * Gỡ khóa phục hồi chống đăng lặp sau khi người vận hành đã kiểm tra Fanpage
 * Bắt buộc nhập lý do để ghi vào Audit Log
 */
function clearDirectPublisherRecoveryLock(reason) {
  const cleanReason = String(reason || 'Gỡ khóa thủ công sau kiểm tra Fanpage').trim();
  PropertiesService.getScriptProperties().deleteProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);
  logOperation_('LOCK_CLEAR', 'SYSTEM', 'OK', `Đã gỡ Recovery Lock: ${cleanReason}`, 'Operator');
  return { success: true, message: 'Đã gỡ khóa Recovery Lock an toàn.' };
}


/* ==========================================================================
 * MODULE: DashboardApi.gs
 * ========================================================================== */

/**
 * PTAT Studio — DashboardApi.gs
 * Điểm vào Web App (doGet) và các hàm API an toàn phục vụ giao diện HTML Service.
 */

/**
 * Xử lý yêu cầu HTTP GET khi mở Web App trên trình duyệt
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  const output = template.evaluate();

  output.setTitle('PTAT Studio — Trung Tâm Điều Hành Video & Bài Viết');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  output.setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/forms/favicon_qp2.png');

  return output;
}

/**
 * Helper nạp các file CSS và JS con vào template Dashboard
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lấy snapshot tổng quan hệ thống hiển thị lên màn hình Overview
 */
function getDashboardSnapshot() {
  const properties = PropertiesService.getScriptProperties();
  const today = todayKey_();
  const currentSlot = getCurrentSlot_();
  const daily = readDailyCount_(properties, today);
  const lockData = properties.getProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);
  const triggers = getTriggersStatus();
  const rows = listAllQueueRows_();

  let pendingVideo = 0;
  let pendingApproval = 0;
  let scheduledToday = 0;
  let publishedCount = 0;
  let errorCount = 0;

  const nextTasks = [];

  rows.forEach((r) => {
    if (r.postingStatus === 'ĐÃ ĐĂNG') {
      publishedCount += 1;
    } else if (r.postingStatus === 'LỖI') {
      errorCount += 1;
    }

    if (r.videoStatus !== 'VIDEO_READY') {
      pendingVideo += 1;
    } else if (r.approvalStatus === 'CHỜ DUYỆT') {
      pendingApproval += 1;
      if (nextTasks.length < 3) {
        nextTasks.push({
          type: 'NEED_APPROVAL',
          contentId: r.contentId,
          text: `${r.contentId} đã có video, đang chờ bạn duyệt`,
        });
      }
    }

    if (
      scheduledDateKey_(r.scheduledDate) === today &&
      r.postingStatus === 'CHƯA ĐĂNG' &&
      r.approvalStatus === 'ĐÃ DUYỆT'
    ) {
      scheduledToday += 1;
    }
  });

  if (lockData) {
    nextTasks.unshift({
      type: 'RECOVERY_LOCK',
      contentId: 'SYSTEM',
      text: 'Có khóa Recovery Lock! Kiểm tra Fanpage trước khi gỡ khóa.',
    });
  }

  return {
    today,
    currentSlot,
    dailyCount: daily.count,
    maxDaily: PTAT_CONFIG.MAX_REELS_PER_DAY,
    hasRecoveryLock: Boolean(lockData),
    recoveryLockDetail: lockData ? JSON.parse(lockData) : null,
    triggers,
    stats: {
      total: rows.length,
      pendingVideo,
      pendingApproval,
      scheduledToday,
      publishedCount,
      errorCount,
    },
    nextTasks,
  };
}

/**
 * Lấy danh sách hàng đợi Reels kèm bộ lọc
 */
function listReels(filterType, searchQuery) {
  let rows = listAllQueueRows_();
  const today = todayKey_();
  const query = (searchQuery || '').toLowerCase().trim();

  if (query) {
    rows = rows.filter((r) =>
      r.contentId.toLowerCase().includes(query) ||
      r.idea.toLowerCase().includes(query) ||
      r.caption.toLowerCase().includes(query)
    );
  }

  if (filterType === 'NEED_VIDEO') {
    rows = rows.filter((r) => r.videoStatus !== 'VIDEO_READY' && r.postingStatus !== 'ĐÃ ĐĂNG');
  } else if (filterType === 'NEED_APPROVAL') {
    rows = rows.filter((r) => r.videoStatus === 'VIDEO_READY' && r.approvalStatus === 'CHỜ DUYỆT');
  } else if (filterType === 'APPROVED') {
    rows = rows.filter((r) => r.approvalStatus === 'ĐÃ DUYỆT' && r.postingStatus === 'CHƯA ĐĂNG');
  } else if (filterType === 'TODAY') {
    rows = rows.filter((r) => scheduledDateKey_(r.scheduledDate) === today);
  } else if (filterType === 'PUBLISHED') {
    rows = rows.filter((r) => r.postingStatus === 'ĐÃ ĐĂNG');
  } else if (filterType === 'ERROR') {
    rows = rows.filter((r) => r.postingStatus === 'LỖI');
  }

  return rows;
}

/**
 * Xem chi tiết 1 Reel theo Content ID
 */
function getReelDetail(contentId) {
  return findRowByContentId_(contentId);
}

/**
 * Kiểm tra tình trạng kết nối an toàn (Health Check)
 */
function getSystemHealth() {
  const properties = PropertiesService.getScriptProperties();
  const hasToken = Boolean(properties.getProperty(PTAT_CONFIG.META_PAGE_ACCESS_TOKEN_PROPERTY));
  const triggers = getTriggersStatus();
  const lockData = properties.getProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);
  const today = todayKey_();
  const daily = readDailyCount_(properties, today);

  return {
    metaTokenConfigured: hasToken,
    dailyReelsPublished: daily.count,
    maxDailyReels: PTAT_CONFIG.MAX_REELS_PER_DAY,
    recoveryLockActive: Boolean(lockData),
    triggers,
  };
}

/**
 * Kích hoạt đồng bộ Drive thủ công từ UI
 */
function syncDriveNow() {
  return syncDriveVideosToQueue();
}

/**
 * Dừng khẩn cấp lịch publisher từ UI
 */
function emergencyStopSchedule() {
  return disableReelPublishTrigger();
}

/**
 * Đặt lại lịch 3 trigger publisher từ UI
 */
function resetScheduleNow() {
  createOrResetReelPublishTrigger();
  return { success: true, message: 'Đã kích hoạt lại 3 trigger đăng tự động.' };
}

/**
 * Gỡ Recovery Lock an toàn từ UI
 */
function clearLockSafe(reason) {
  return clearDirectPublisherRecoveryLock(reason);
}


/* ==========================================================================
 * MODULE: Tests.gs
 * ========================================================================== */

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



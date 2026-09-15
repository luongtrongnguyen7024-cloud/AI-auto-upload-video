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

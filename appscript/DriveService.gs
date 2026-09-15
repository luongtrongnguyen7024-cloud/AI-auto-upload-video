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

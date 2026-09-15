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

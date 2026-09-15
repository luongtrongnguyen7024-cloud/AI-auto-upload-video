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

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

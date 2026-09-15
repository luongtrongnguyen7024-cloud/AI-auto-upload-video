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

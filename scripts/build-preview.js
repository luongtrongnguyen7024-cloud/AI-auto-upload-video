const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../appscript');
let html = fs.readFileSync(path.join(dir, 'Dashboard.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'Dashboard.css.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'Dashboard.js.html'), 'utf8');

// Thay thế tag include CSS
html = html.split("<?!= include('Dashboard.css'); ?>").join(css);

// Thêm mock bridge cho google.script.run khi mở trực tiếp trên máy
const mockBridge = `
<script>
  // MOCK DATA CHO TRÌNH DUYỆT LOCAL XEM TRƯỚC
  const mockQueue = [
    { rowNumber: 2, contentId: 'PTAT-001', pillar: 'Định vị Page', idea: 'Bài chào mừng Page', hook: 'Một góc nhìn đơn giản...', caption: 'Chào mừng bạn đến với Phong Thủy An Tâm...', videoStatus: 'CHƯA CÓ', autoStatus: 'CHƯA', approvalStatus: 'CHƯA', scheduledDate: '2026-09-13', slot: 'SÁNG', driveUrl: '', postingStatus: 'ĐÃ ĐĂNG' },
    { rowNumber: 3, contentId: 'PTAT-002', pillar: 'Không gian sống', idea: 'Dọn cửa chính đón lộc', hook: 'Cửa chính bừa bộn...', caption: 'Dọn sạch cửa chính giúp đón luồng sinh khí mới...', videoStatus: 'VIDEO_READY', autoStatus: 'ĐÃ ĐĂNG', approvalStatus: 'ĐÃ DUYỆT', scheduledDate: '2026-09-14', slot: 'SÁNG', driveUrl: 'https://drive.google.com', postingStatus: 'ĐÃ ĐĂNG' },
    { rowNumber: 4, contentId: 'PTAT-003', pillar: 'Thói quen sống', idea: 'Góc làm việc gọn gàng', hook: 'Bàn làm việc bừa...', caption: 'Một góc làm việc thoáng đãng giúp tâm trí minh mẫn...', videoStatus: 'CHƯA CÓ', autoStatus: 'CHƯA', approvalStatus: 'CHƯA', scheduledDate: '2026-09-14', slot: 'TRƯA', driveUrl: '', postingStatus: 'CHƯA ĐĂNG' },
    { rowNumber: 5, contentId: 'PTAT-004', pillar: 'Phong thủy ứng dụng', idea: 'Cây xanh thanh lọc năng lượng', hook: '3 loại cây dễ trồng...', caption: 'Chọn cây xanh phong thủy phù hợp không gian sống...', videoStatus: 'VIDEO_READY', autoStatus: 'ĐÃ ĐĂNG', approvalStatus: 'ĐÃ DUYỆT', scheduledDate: '2026-09-15', slot: 'SÁNG', driveUrl: 'https://drive.google.com', postingStatus: 'ĐÃ ĐĂNG' },
    { rowNumber: 6, contentId: 'PTAT-005', pillar: 'Tâm linh tham khảo', idea: 'Bình an trong tâm', hook: 'Mỗi sáng thức dậy...', caption: 'Nuôi dưỡng sự bình tĩnh qua từng hơi thở...', videoStatus: 'VIDEO_READY', autoStatus: 'ĐÃ ĐĂNG', approvalStatus: 'ĐÃ DUYỆT', scheduledDate: '2026-09-15', slot: 'TRƯA', driveUrl: 'https://drive.google.com', postingStatus: 'ĐÃ ĐĂNG' },
    { rowNumber: 7, contentId: 'PTAT-006', pillar: 'Không gian sống', idea: 'Ánh sáng phòng ngủ', hook: 'Đừng để đèn ngủ quá chói...', caption: 'Ánh sáng ấm áp giúp giấc ngủ sâu và tái tạo năng lượng...', videoStatus: 'VIDEO_READY', autoStatus: 'CHƯA', approvalStatus: 'CHỜ DUYỆT', scheduledDate: '2026-09-15', slot: 'TỐI', driveUrl: 'https://drive.google.com', postingStatus: 'CHƯA ĐĂNG' },
    { rowNumber: 8, contentId: 'PTAT-007', pillar: 'Phong thủy ứng dụng', idea: 'Vị trí gương soi', hook: 'Gương đối diện giường ngủ...', caption: 'Những lưu ý khi bố trí gương trong nhà để tránh bất an...', videoStatus: 'CHƯA CÓ', autoStatus: 'CHƯA', approvalStatus: 'CHƯA', scheduledDate: '2026-09-16', slot: 'SÁNG', driveUrl: '', postingStatus: 'CHƯA ĐĂNG' }
  ];

  window.google = {
    script: {
      run: {
        withSuccessHandler: function(successFn) {
          return {
            withFailureHandler: function(failFn) {
              return {
                getDashboardSnapshot: () => setTimeout(() => successFn({
                  today: '2026-09-15',
                  currentSlot: 'TỐI',
                  dailyCount: 2,
                  maxDaily: 3,
                  hasRecoveryLock: false,
                  recoveryLockDetail: null,
                  triggers: { driveSyncEnabled: true, driveSyncCount: 1, publishScheduleEnabled: true, publishScheduleCount: 3 },
                  stats: { total: 21, pendingVideo: 15, pendingApproval: 1, scheduledToday: 1, publishedCount: 3, errorCount: 0 },
                  nextTasks: [{ type: 'NEED_APPROVAL', contentId: 'PTAT-006', text: 'PTAT-006 đã có video, đang chờ bạn duyệt' }]
                }), 80),
                listReels: (filter, query) => setTimeout(() => {
                  let res = [...mockQueue];
                  if (filter === 'NEED_APPROVAL') res = res.filter(r => r.approvalStatus === 'CHỜ DUYỆT');
                  if (filter === 'APPROVED') res = res.filter(r => r.approvalStatus === 'ĐÃ DUYỆT');
                  if (filter === 'PUBLISHED') res = res.filter(r => r.postingStatus === 'ĐÃ ĐĂNG');
                  if (filter === 'NEED_VIDEO') res = res.filter(r => r.videoStatus !== 'VIDEO_READY');
                  if (query) {
                    res = res.filter(r => r.contentId.toLowerCase().includes(query.toLowerCase()) || r.idea.toLowerCase().includes(query.toLowerCase()));
                  }
                  successFn(res);
                }, 80),
                getReelDetail: (id) => setTimeout(() => successFn(mockQueue.find(r => r.contentId === id) || mockQueue[0]), 80),
                approveReel: (id) => setTimeout(() => {
                  const item = mockQueue.find(r => r.contentId === id);
                  if (item) { item.approvalStatus = 'ĐÃ DUYỆT'; item.autoStatus = 'SẴN SÀNG ĐĂNG'; }
                  successFn({ success: true, message: 'Đã duyệt ' + id + ' thành công!' });
                }, 200),
                rejectReel: (id, reason) => setTimeout(() => {
                  const item = mockQueue.find(r => r.contentId === id);
                  if (item) { item.approvalStatus = 'TỪ CHỐI'; }
                  successFn({ success: true, contentId: id });
                }, 200),
                saveReelDraft: (data) => setTimeout(() => {
                  const item = mockQueue.find(r => r.contentId === data.contentId);
                  if (item) {
                    if (data.caption) item.caption = data.caption;
                    if (data.scheduledDate) item.scheduledDate = data.scheduledDate;
                    if (data.slot) item.slot = data.slot;
                  }
                  successFn({ success: true });
                }, 150),
                syncDriveNow: () => setTimeout(() => successFn({ updated: 1, message: 'Đã quét xong. Nhận diện 1 video mới.' }), 400),
                emergencyStopSchedule: () => setTimeout(() => successFn({ success: true, removedCount: 3 }), 200),
                resetScheduleNow: () => setTimeout(() => successFn({ success: true, message: 'Đã kích hoạt lại 3 trigger.' }), 200),
                clearLockSafe: (reason) => setTimeout(() => successFn({ success: true, message: 'Đã gỡ khóa thành công.' }), 150),
                getSystemHealth: () => setTimeout(() => successFn({
                  metaTokenConfigured: true,
                  dailyReelsPublished: 2,
                  maxDailyReels: 3,
                  recoveryLockActive: false,
                  triggers: { driveSyncEnabled: true, publishScheduleEnabled: true, publishScheduleCount: 3 }
                }), 80),
                getOperationsLog: (limit) => setTimeout(() => successFn([
                  { timestamp: '2026-09-15 15:08:12', action: 'PUBLISH', contentId: 'PTAT-005', result: 'OK', message: 'Published PTAT-005; daily total: 1.', actor: 'System' },
                  { timestamp: '2026-09-15 15:00:00', action: 'SYNC_DRIVE', contentId: 'PTAT-005', result: 'OK', message: 'Nhận diện PTAT-005.mp4 -> CHỜ DUYỆT', actor: 'System' },
                  { timestamp: '2026-09-15 10:28:45', action: 'PUBLISH', contentId: 'PTAT-004', result: 'OK', message: 'Published PTAT-004; daily total: 1.', actor: 'Operator' }
                ]), 80),
                uploadReelVideoFromForm: (form) => setTimeout(() => {
                  mockQueue.push({
                    rowNumber: mockQueue.length + 2,
                    contentId: form.contentId,
                    pillar: 'Phong thủy',
                    idea: 'Video vừa tải lên',
                    hook: 'Hook mới',
                    caption: 'Caption tự động',
                    videoStatus: 'VIDEO_READY',
                    autoStatus: 'CHƯA',
                    approvalStatus: 'CHỜ DUYỆT',
                    scheduledDate: '2026-09-15',
                    slot: 'TỐI',
                    driveUrl: 'https://drive.google.com',
                    postingStatus: 'CHƯA ĐĂNG'
                  });
                  successFn({ success: true, contentId: form.contentId, driveUrl: 'https://drive.google.com', fileName: form.contentId + '.mp4' });
                }, 600)
              };
            }
          };
        }
      }
    }
  };
</script>
`;

html = html.split("<?!= include('Dashboard.js'); ?>").join(mockBridge + js);
fs.writeFileSync(path.join(dir, 'preview.html'), html, 'utf8');
console.log('✅ Generated preview.html successfully!');

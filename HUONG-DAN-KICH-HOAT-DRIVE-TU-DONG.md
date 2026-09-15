# PTAT — Drive, Sheet và đăng Reel trực tiếp

Tệp mã: `DriveQueueAutoDetector.gs`.

## Quy tắc hoạt động

1. Trong `Content Queue` phải có sẵn một hàng với `Content ID`, caption và nội dung, ví dụ `PTAT-004`.
2. Upload video đúng thư mục đầu vào với tên chính xác `PTAT-004.mp4`.
3. Trong tối đa 15 phút, Apps Script sẽ tự:
   - ghi `VIDEO_READY` vào **Trạng thái video**;
   - ghi link file vào **File video (Drive)**;
   - ghi `SẴN SÀNG ĐĂNG` vào **Trạng thái đăng tự động**;
   - chỉ khi cột **Trạng thái đăng** đang trống, ghi `CHƯA ĐĂNG`.
4. Bộ đăng trực tiếp có thể chạy mỗi 8 giờ, chỉ đăng một hàng đủ điều kiện mỗi lượt, tối đa ba Reel/ngày.

Caption được lấy từ cột **Caption Facebook**. Hàng `BỎ QUA`, `ĐÃ ĐĂNG` hoặc `LỖI` không được tự đăng lại.

## Quy tắc an toàn của bộ đăng trực tiếp

- Video đi theo đường **Drive → Apps Script → Meta**, không qua Make và không dùng quota data transfer của Make.
- Token Page chỉ được lưu trong **Script Properties**; không dán vào mã, Sheet, log hoặc screenshot.
- Mỗi lần chạy chỉ xét một dòng đủ điều kiện: `VIDEO_READY` + `SẴN SÀNG ĐĂNG` + `CHƯA ĐĂNG` + có caption + có link Drive.
- Có khóa chống đăng trùng. Nếu Meta đã nhận video nhưng Sheet chưa kịp đổi trạng thái, hệ thống dừng để con người kiểm tra Page thay vì tự thử lại.
- Video phải không quá 50 MB vì đó là giới hạn URL Fetch của Apps Script.

## Thao tác bắt buộc một lần

1. Mở Google Sheet **Phong Thủy An Tâm — Kế hoạch & Nội dung 30 ngày**.
2. Chọn **Tiện ích mở rộng → Apps Script**.
3. Xóa mã mẫu trong `Code.gs`; dán toàn bộ nội dung của `DriveQueueAutoDetector.gs`.
4. Bấm **Save**.
5. Chọn hàm `createOrResetQuarterHourTrigger` ở thanh công cụ rồi bấm **Run**.
6. Google hỏi quyền: chọn đúng tài khoản Drive/Sheet, bấm **Allow**. Quyền này cần để đọc thư mục Drive và cập nhật chính Sheet của bạn.
7. Trong Apps Script, mở **Triggers** (biểu tượng đồng hồ) và xác nhận có một trigger:
   - Function: `syncDriveVideosToQueue`
   - Event source: Time-driven
   - Frequency: Every 15 minutes

## Cấu hình token an toàn (bắt buộc trước khi bật đăng trực tiếp)

1. Trong Apps Script, chọn **Project Settings** (biểu tượng bánh răng).
2. Cuộn đến **Script properties** → **Add script property**.
3. Property: `PTAT_META_PAGE_ACCESS_TOKEN`.
4. Value: dán Page access token mới nhất, **không** thêm `OAuth ` hoặc `Bearer `.
5. Bấm **Save script properties**. Không chụp màn hình phần token và không gửi token qua chat.

## Kiểm tra không đăng bài

1. Chọn hàm `validateDirectReelPublisherConfiguration` rồi bấm **Run**.
2. Cho phép quyền cần thiết nếu Google yêu cầu. Hàm này chỉ đọc Sheet/cấu hình, **không gọi Meta và không đăng Reel**.
3. Mở **Execution log**. Kết quả an toàn cần thấy:
   - `tokenStored: true`;
   - `publisherTriggerEnabled: false`;
   - `eligibleContentId` có thể là `null` nếu không có video đang chờ đăng.

## Bật lịch đăng trực tiếp (chỉ khi người vận hành cho phép)

1. Xác nhận không có dòng cũ không muốn đăng với trạng thái `VIDEO_READY`, `SẴN SÀNG ĐĂNG`, `CHƯA ĐĂNG`.
2. Chọn hàm `createOrResetReelPublishTrigger` rồi bấm **Run** đúng một lần.
3. Trong **Triggers**, kiểm tra thêm trigger:
   - Function: `publishReadyReelToFacebook`
   - Event source: Time-driven
   - Frequency: Every 8 hours
4. Nếu muốn dừng đăng ngay: chạy `disableReelPublishTrigger`. Trigger nhận video Drive vẫn giữ nguyên.

## Kiểm thử nhận video không đăng bài

Sau khi cài trigger, upload `PTAT-004.mp4`. Đợi tối đa 15 phút rồi kiểm tra dòng PTAT-004 trong `Content Queue`: cột **Trạng thái video** phải là `VIDEO_READY` và cột **File video (Drive)** có link.

Không cần bật scenario Make cho luồng đăng trực tiếp. Giữ Make inactive để không có hai hệ thống cùng đăng một video.

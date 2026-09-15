# PTAT — trạng thái bàn giao

Cập nhật: 15/09/2026 (Asia/Saigon)

## Mục tiêu

Người vận hành chỉ cần upload video có tên `PTAT-<số>.mp4` vào thư mục Drive đầu vào. Apps Script tự ghép video với dòng cùng `Content ID` ở Google Sheet. Make là lớp đăng Facebook Reels theo lịch và phải được kiểm tra trước khi bật lại.

## Tài nguyên chính

| Thành phần | Giá trị |
| --- | --- |
| Google Sheet | [Phong Thủy An Tâm — Kế hoạch & Nội dung 30 ngày](https://docs.google.com/spreadsheets/d/1ut8gLmqhQC_5mWm-CxqgF-L-4ugFhjtoxvDkyIdK5s0/edit) |
| Spreadsheet ID | `1ut8gLmqhQC_5mWm-CxqgF-L-4ugFhjtoxvDkyIdK5s0` |
| Tab hàng đợi | `Content Queue` |
| Drive intake folder ID | `1iMihy_Ge2gQV3nmXj0i7QuZ8RRtJPm6Q` |
| Make scenario | `6266298` — `PTAT — Hàng đợi đăng Reel (tối đa 3/ngày)` |
| Facebook Page ID | `1321343767732072` |

Không lưu access token hoặc mật khẩu trong project này.

## Luồng đã xác minh

1. `PTAT-002` đã được test đăng Reel thành công trước đó: Sheet → Drive download → Meta/Facebook Reels. Caption xuất hiện đúng trên Page.
2. Apps Script chạy được bằng tài khoản Google `luongtrongnguyen4367@gmail.com`, là tài khoản có quyền vào Drive intake folder. Khi chạy thủ công, log từng báo `Drive synchronization complete. Updated 2 queue row(s).`
3. `PTAT-004.mp4` đã được nhận diện. Dòng `PTAT-004` hiện có:
   - `Trạng thái video = VIDEO_READY`
   - `Trạng thái đăng tự động = SẴN SÀNG ĐĂNG`
   - link Drive trong `File video (Drive)`.
4. Rule Google Table đã được sửa trực tiếp:
   - cột **H — Trạng thái video** có `VIDEO_READY`;
   - cột **I — Trạng thái đăng tự động** có `CHƯA` và `SẴN SÀNG ĐĂNG`.

## Apps Script

Mã nguồn chuẩn trong project: `DriveQueueAutoDetector.gs`.

- Hàm chạy theo lịch: `syncDriveVideosToQueue`.
- Hàm tạo/reset trigger: `createOrResetQuarterHourTrigger`.
- Trigger dự kiến: time-driven, mỗi 15 phút.
- Chỉ nhận file đúng mẫu `/^(PTAT-\d+)\.mp4$/i`.
- Ghi `VIDEO_READY`, link Drive, và `SẴN SÀNG ĐĂNG` cho dòng trùng `Content ID`.
- Bỏ qua các hàng đã `ĐÃ ĐĂNG`/`BỎ QUA` để không đưa lại vào hàng chờ.
- Không đăng Facebook, không sửa kịch bản hoặc caption.

Lưu ý: `Content Queue` là **Google Table** (`ContentQueueTable`), không phải range thường. Không dùng `setDataValidation()` trong Apps Script để sửa dropdown cả cột: Google chặn thao tác này trên typed table columns. Nếu cần sửa danh sách dropdown, sửa native Table bằng Google Sheets UI/API.

## Quy tắc cột quan trọng

| Cột | Tên | Giá trị cần dùng |
| --- | --- | --- |
| H | Trạng thái video | `VIDEO_READY` sau khi Apps Script thấy video |
| I | Trạng thái đăng tự động | `SẴN SÀNG ĐĂNG` khi video sẵn sàng cho Make |
| K | File video (Drive) | link được Apps Script ghi |
| Q | Trạng thái đăng | `CHƯA ĐĂNG`, `ĐÃ ĐĂNG`, `LỖI` |

## Make: trạng thái và việc cần làm

- Scenario hiện để **inactive**. Không tự bật khi chưa kiểm tra lọc và mapping.
- Lịch mong muốn: mỗi 8 giờ, tối đa 3 Reel/ngày.
- Trước khi kích hoạt, phải kiểm tra module tìm hàng của Google Sheets chỉ lấy hàng có tối thiểu:
  - `Trạng thái video = VIDEO_READY`
  - `Trạng thái đăng tự động = SẴN SÀNG ĐĂNG`
  - `Trạng thái đăng = CHƯA ĐĂNG`
  - có `File video (Drive)` và caption.
- Không lộ/ghi token Meta vào tài liệu, log hoặc screenshot.
- Sau khi Make đăng thành công, xác minh module cập nhật dòng ghi `ĐÃ ĐĂNG` và `Link bài/Reel`; đây chưa phải kết quả đã xác minh sau các thay đổi tự động mới.

### Cập nhật kiểm chứng ngày 15/09/2026

- Dòng `PTAT-004` (hàng 5) đã được kiểm tra trực tiếp trong `Content Queue`: `VIDEO_READY`, `SẴN SÀNG ĐĂNG` và link Drive đều có.
- `Caption Facebook` của `PTAT-004` đã được điền; `Trạng thái đăng` đã đổi từ `LỖI` sang `CHƯA ĐĂNG` theo yêu cầu đăng lại của người vận hành.
- Make đã được người vận hành cấu hình lại theo UI: filter chặn caption trống; mô-đun 5/7 dùng keychain query mới; mô-đun 6 dùng keychain header mới; mô-đun 6 có `offset=0`, `file_size` từ Drive, body `application/octet-stream` và dữ liệu file.
- Chưa xác minh bằng một lần chạy sau cấu hình này. Không coi luồng mới là hoàn tất cho tới khi người vận hành cho phép thử đăng thật và kiểm tra kết quả trên Page + Sheet.

### Lần chạy PTAT-004 ngày 15/09/2026

- Theo yêu cầu cho phép đăng thật, scenario đã được bật và chạy thủ công đúng một lần; sau đó đã tắt lại để tránh đăng lặp.
- Các mô-đun 1–7 đều hoàn thành không lỗi, gồm bước finish/publish của Meta. Người vận hành đã xác nhận Reel xuất hiện trên Page kèm caption.
- Mô-đun 8 (`Google Sheets — Update a Row`) lỗi: thiếu `valueInputOption`. Đã sửa mapper thêm `valueInputOption = RAW` sau lần chạy.
- Vì Sheet chưa được mô-đun 8 đánh dấu tự động trong lần chạy đó, sau khi người vận hành xác nhận đã đăng thành công, `PTAT-004` đã được đánh dấu thủ công `Trạng thái đăng = ĐÃ ĐĂNG`. Hàng này không còn đủ điều kiện để đăng lặp.
- Bản sửa mô-đun 8 chưa được xác minh bằng một lần đăng mới; scenario hiện vẫn inactive cho tới khi người vận hành chọn bật lịch.

## Chuyển hướng đã chuẩn bị: Apps Script → Meta trực tiếp

- Theo yêu cầu ngày 15/09/2026, đã chuẩn bị mã local trong `DriveQueueAutoDetector.gs` để thay Make ở đoạn tải và gửi video: **Drive → Apps Script → Meta/Facebook**.
- Mã giữ nguyên detector Drive → Sheet, đồng thời thêm publisher trực tiếp: tối đa một dòng mỗi lần chạy, tối đa ba Reel/ngày, chỉ xử lý `VIDEO_READY` + `SẴN SÀNG ĐĂNG` + `CHƯA ĐĂNG` + caption/link Drive.
- Token dùng Script Property `PTAT_META_PAGE_ACCESS_TOKEN`; tuyệt đối không lưu token trong mã nguồn, Sheet, tài liệu hoặc log.
- Publisher trực tiếp được thiết kế **disabled by default**: chưa dán mã vào Apps Script thực tế, chưa tạo trigger đăng, chưa gọi Meta và chưa đăng Reel trong bước chuẩn bị này.
- Có khóa recovery chống đăng lặp. Nếu có kết quả không chắc chắn, mã đánh dấu `LỖI` hoặc dừng để người vận hành kiểm tra Page trước khi xử lý lại.
- Giới hạn kỹ thuật đã kiểm tra từ tài liệu Google: URL Fetch POST/response tối đa 50 MB mỗi lần. Video hiện tại 28–39 MB nằm dưới ngưỡng nhưng video lớn hơn 50 MB phải nén hoặc dùng kiến trúc khác.

### Cập nhật kiểm chứng thực tế ngày 15/09/2026

- Mã publisher trực tiếp đã được dán và lưu vào đúng Apps Script project **PTAT Drive Queue Detector** (project ID `1fCFAiosZJiHEM_JoNB_eJaeDTKFYirQwymJp97P6aAQT8tDRnCaOezF3`) dưới tài khoản Google chính kết thúc `4444`.
- Script Property `PTAT_META_PAGE_ACCESS_TOKEN` đã được lưu; hàm kiểm tra an toàn trả về `tokenStored: true`, `eligibleContentId: null`, `publisherTriggerEnabled: false`. Token không được lộ hoặc sao chép lại.
- Tài khoản Apps Script `...4444` đã được cấp quyền xem thư mục Drive đầu vào. Trigger `syncDriveVideosToQueue` đã được tạo ở đúng project, time-driven mỗi 15 phút. Chạy tay đã thành công với log `Drive synchronization complete. Updated 0 queue row(s).`
- `Updated 0` là đúng tại thời điểm kiểm tra: các video có sẵn thuộc dòng đã đăng nên detector cố ý không đưa lại vào hàng chờ.
- Tab `Content Queue`: đã điền Caption Facebook cho toàn bộ 21 Content ID hiện có. Chỉ ghi 18 ô trống: `F4` (PTAT-003) và `F6:F22` (PTAT-005 đến PTAT-021); 3 caption có sẵn được giữ nguyên.
- **Chưa** tạo trigger `publishReadyReelToFacebook`, chưa chạy hàm publisher, chưa gọi Meta từ Apps Script và chưa có Reel test trực tiếp bằng Apps Script.

### Cập nhật chống đăng trùng ngày 15/09/2026

- Đã kiểm tra Make execution history: tại 10:28 có hai lần chạy (`Schedule` và `API`) cách nhau 7 giây. Cả hai hoàn thành Meta modules 5–7, gồm publish, rồi lỗi ở module 8 `Google Sheets — Update a Row` với `valueInputOption is required but not specified`. Đây là nguyên nhân đã xác nhận của hai Reel trùng; Make hiện giữ inactive và không được replay.
- Publisher trực tiếp trong Apps Script thật đã được sửa để giữ `PTAT_REEL_IN_FLIGHT` khi bất kỳ lỗi nào xảy ra sau khi publisher bắt đầu. Không tự chạy lại khi Meta/Sheet có kết quả không chắc chắn; chỉ xóa khóa sau khi đăng thành công, hoặc khi người vận hành kiểm tra Page rồi chạy hàm recovery thủ công.
- Đã chạy `validateDirectReelPublisherConfiguration` sau khi lưu mã: `tokenStored: true`, `eligibleContentId: "PTAT-005"`, `publisherTriggerEnabled: false`. Hàm này không gọi Meta và không lộ token.
- Chưa chạy `publishReadyReelToFacebook`, chưa có trigger publisher, và chưa có Reel test bằng Apps Script trực tiếp.

### Chặn test trực tiếp ngày 15/09/2026

- Lần gọi publisher đầu tiên bị Google chặn do thiếu quyền `UrlFetchApp`; người vận hành đã cấp quyền gọi dịch vụ bên ngoài cho đúng Apps Script project và tài khoản Google.
- Publisher sau đó gọi Meta ở bước `start`, nhưng Meta trả `OAuthException`, `code=190`, `subcode=463`: access token trong Script Properties đã hết hạn. Meta từ chối trước upload và publish; không có Reel `PTAT-005` mới.
- Hàng `PTAT-005` được đánh dấu `LỖI` và recovery lock được giữ. Không chạy lại, không xóa lock hoặc đổi trạng thái để thử tiếp cho tới khi người vận hành tự thay Script Property `PTAT_META_PAGE_ACCESS_TOKEN` bằng token Page còn hiệu lực. Không ghi hoặc sao chép token vào mã, log, Sheet, tài liệu hay chat.

## Bước an toàn tiếp theo

### Sửa pending sau lỗi upload nhị phân ngày 15/09/2026

- Sau khi Meta start session thành công với token Page mới, upload bytes trả HTTP 400. Nguyên nhân mã đã xác định: `offset` và `file_size` được đặt trong query string thay vì HTTP headers mà Reels upload endpoint yêu cầu.
- Đã sửa **local** `DriveQueueAutoDetector.gs`: gửi `Authorization`, `offset: '0'`, và `file_size` trong headers; body vẫn là Blob với `application/octet-stream`. Kiểm tra local bằng `node --check` đã thành công.
- Chưa dán bản sửa này vào Apps Script thật, chưa chạy test lại và chưa có Reel PTAT-005 được xác minh. Recovery lock phải được xóa thủ công chỉ sau khi kiểm tra Page không có Reel PTAT-005.

### Test trực tiếp PTAT-005 ngày 15/09/2026

- Sau khi dán các hàm helper còn thiếu (`indexHeaders_`, `normalize_`) và chuyển `offset`/`file_size` sang upload headers, `validateDirectReelPublisherConfiguration` trả `tokenStored: true`, `eligibleContentId: "PTAT-005"`, `publisherTriggerEnabled: false`.
- `publishReadyReelToFacebook` đã chạy đúng một lần và Apps Script log `Published PTAT-005; daily total: 1.` lúc 15:08. Không tạo trigger publisher.
- Cần người vận hành xác minh Reel và caption trên Facebook Page, đồng thời xác minh ô Q của PTAT-005 trong Sheet là `ĐÃ ĐĂNG`, trước khi kết luận test thực tế thành công hoặc tạo bất kỳ lịch tự động nào.

### Trigger publisher ngày 15/09/2026

- Người vận hành đã chạy `createOrResetReelPublishTrigger`; màn hình Apps Script xác nhận hai trigger time-driven: `syncDriveVideosToQueue` và `publishReadyReelToFacebook`.
- Cấu hình hiện tại là publisher mỗi 8 giờ, giới hạn ba Reel/ngày và tối đa một Reel mỗi lần chạy. Không phụ thuộc Make.
- Cảnh báo thiết kế đã xác minh từ mã: bộ chọn hiện chỉ xét `VIDEO_READY` + `SẴN SÀNG ĐĂNG` + `CHƯA ĐĂNG` + caption + link Drive; **không xét cột `Ngày đăng`**. Vì vậy lịch này xuất bản dòng đủ điều kiện đầu tiên, không bảo đảm ngày/mốc giờ cụ thể trong Sheet. Cần quyết định và sửa trước khi coi cột Ngày đăng là lịch bắt buộc.

### Lịch cố định pending ngày 15/09/2026

- Người vận hành đã chọn ba mốc mỗi ngày: 08:00, 12:00, 20:00 (Asia/Ho_Chi_Minh).
- Đã sửa **local** `DriveQueueAutoDetector.gs` và kiểm tra cú pháp: reset publisher sẽ thay trigger 8 giờ bằng ba trigger daily gần phút 00; ứng viên bắt buộc có `Ngày đăng` bằng hôm nay, hỗ trợ hiển thị `dd/MM/yyyy` hoặc `yyyy-MM-dd`.
- Chưa dán/sửa trong Apps Script thật, chưa chạy reset trigger mới. Trigger publisher hiện có vẫn là bản every-8-hours cho tới khi mã local được áp dụng và `createOrResetReelPublishTrigger` được chạy thủ công.

### Lịch cố định đã cấu hình ngày 15/09/2026

- Người vận hành xác nhận đã dán toàn bộ mã, chạy `disableReelPublishTrigger`, validation, và `createOrResetReelPublishTrigger`.
- Ảnh màn hình Trigger xác minh hiện có đúng bốn time-driven trigger: một `syncDriveVideosToQueue` và ba `publishReadyReelToFacebook`.
- Chưa có publisher trigger nào chạy theo lịch mới tại thời điểm chụp, nên việc Apps Script thực thi gần 08:00/12:00/20:00 và việc chặn theo `Ngày đăng` vẫn chờ quan sát lần chạy đầu tiên. Không tự chạy publisher thủ công để test lại.

1. Upload một file mới, ví dụ `PTAT-005.mp4` (tối đa 50 MB), vào thư mục Drive đầu vào. Dòng PTAT-005 đã có script và caption.
2. Đợi tối đa 15 phút hoặc chạy tay `syncDriveVideosToQueue`; xác nhận H = `VIDEO_READY`, I = `SẴN SÀNG ĐĂNG`, K có link Drive, Q = `CHƯA ĐĂNG`.
3. Chỉ khi người vận hành nói rõ **"Cho phép test đăng PTAT-005"**, chạy publisher trực tiếp đúng một lần có kiểm soát và kiểm tra cả Page lẫn Sheet. Không tạo trigger đăng/lịch 3 video mỗi ngày trước khi test này thành công.

## Trạng thái tổng quát

- Drive → Sheet: đã chạy và có bằng chứng cho PTAT-004.
- Sheet dropdown: đã sửa trực tiếp cho `VIDEO_READY` và `SẴN SÀNG ĐĂNG`.
- Make → Facebook với thiết kế cũ: đã test thành công cho PTAT-002.
- Make → Facebook sau luồng tự động mới: đã test đăng thật thành công với `PTAT-004`, có caption. Cần bật scenario để lịch tự động hoạt động; riêng bản sửa cập nhật trạng thái Sheet sau đăng chưa được test lại trên một bài mới.

# PTAT Studio — Tự Động Hóa Quản Lý & Đăng Facebook Reels

Hệ thống quản lý tập trung và tự động hóa xuất bản video **Facebook Reels** có kiểm duyệt người (Human-in-the-loop Approval Gate) cho dự án **Phong Thủy An Tâm (PTAT)**.

---

## 📌 Tổng quan kiến trúc hệ thống

```text
               ┌──────────────────────────────────────────────────┐
               │           Người vận hành (Operator)              │
               └──────────────┬───────────────────┬───────────────┘
                              │                   │
                     1. Upload MP4         2. Duyệt bài & Sửa kịch bản
                              │                   │
                              ▼                   ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│      Google Drive Intake        │   │    PTAT Studio Dashboard (Web)   │
│  (Thư mục lưu file PTAT-xxx.mp4)│   │  (Apps Script HTML Service UI)   │
└────────────────┬────────────────┘   └─────────────────┬────────────────┘
                 │                                      │
                 │ 3. Sync quét (15 phút/lần)          │ 4. Lưu Duyệt đăng & Slot
                 └──────────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────┐
                     │  Google Sheets (Source of T) │
                     │      Tab: Content Queue      │
                     └──────────────┬───────────────┘
                                    │ 5. Đủ 7 điều kiện an toàn & slot (08h/12h/20h)
                                    ▼
                     ┌──────────────────────────────┐
                     │    Apps Script Publisher     │
                     │ (Graph API v26.0 POST Binary)│
                     └──────────────┬───────────────┘
                                    │ 6. Đăng Reels trực tiếp
                                    ▼
                     ┌──────────────────────────────┐
                     │     Facebook Page Reels      │
                     │  (Page ID: 1321343767732072) │
                     └──────────────────────────────┘
```

---

## 🛠️ Cấu trúc thư mục mã nguồn

```text
PJ_AI_up_video/
├── appscript/                          # Toàn bộ mã nguồn Google Apps Script & Dashboard UI
│   ├── Config.gs                       # Cấu hình IDs, Timezone, Slots, limits
│   ├── AuditService.gs                 # Ghi nhật ký kiểm toán (Operations Log)
│   ├── QueueRepository.gs              # Đọc/ghi dữ liệu Google Sheets & quản lý cột
│   ├── DriveService.gs                 # Quét thư mục Drive intake & Upload Blob
│   ├── ScheduleService.gs              # Ánh xạ slot (Sáng/Trưa/Tối) & quản lý Triggers
│   ├── ApprovalService.gs              # Cổng duyệt người (approve/reject/draft)
│   ├── ReelPublisher.gs                # Đăng Reels trực tiếp lên Meta Graph API v26.0
│   ├── DashboardApi.gs                 # API public (doGet & google.script.run bridge)
│   ├── Tests.gs                        # Các hàm kiểm thử an toàn (không gọi Meta)
│   ├── PTAT-Studio-Bundle.gs           # GỘP TOÀN BỘ 9 MODULE .GS (Dán 1 click)
│   ├── Dashboard.html                  # Khung giao diện HTML Studio
│   ├── Dashboard.css.html              # CSS Dark Mode & Emerald Accent
│   ├── Dashboard.js.html               # Javascript Client điều khiển UI
│   └── preview.html                    # Mở trực tiếp trên máy để xem trước giao diện
├── scripts/                            # Các công cụ hỗ trợ Node.js
│   └── build-preview.js                # Generator dựng preview.html
├── PTAT-STUDIO-DASHBOARD-PLAN.md       # Thiết kế kiến trúc chi tiết Studio Dashboard
├── PTAT-HANDOFF-PLAN.md                # Kế hoạch bàn giao kỹ thuật & quy trình vận hành
├── PROJECT-STATE.md                    # Nhật ký trạng thái, các sự cố và cách xử lý
└── README.md                           # Tài liệu hướng dẫn dự án
```

---

## 🚀 Hướng dẫn khởi chạy & Xem thử

### Cách 1: Xem trước giao diện Local (Nhanh nhất - 5 giây)
Nhấp đúp chuột vào file `appscript/preview.html` hoặc dùng extension **Live Server** trong VS Code để mở trên trình duyệt. File này đã được nạp sẵn mock-data đầy đủ để thử nghiệm tất cả các tính năng.

### Cách 2: Triển khai thực tế trên Google Apps Script

1. Mở dự án [Google Apps Script PTAT Drive Queue Detector](https://script.google.com/home/projects/1fCFAiosZJiHEM_JoNB_eJaeDTKFYirQwymJp97P6aAQT8tDRnCaOezF3/edit).
2. Dán nội dung từ file `appscript/PTAT-Studio-Bundle.gs` vào file code `.gs`.
3. Tạo 3 file HTML:
   - `Dashboard.html` $\leftarrow$ dán nội dung [appscript/Dashboard.html](./appscript/Dashboard.html)
   - `Dashboard.css` $\leftarrow$ dán nội dung [appscript/Dashboard.css.html](./appscript/Dashboard.css.html)
   - `Dashboard.js` $\leftarrow$ dán nội dung [appscript/Dashboard.js.html](./appscript/Dashboard.js.html)
4. Bấm **Triển khai (Deploy)** $\rightarrow$ **Triển khai mới (New deployment)**:
   - Loại: **Ứng dụng web (Web app)**
   - Thực thi dưới dạng: **Tôi (Me)**
   - Ai có quyền truy cập: **Chỉ mình tôi (Only myself)**
5. Mở link Web App để bắt đầu điều hành!

---

## 🛡️ Hợp đồng dữ liệu & Quy tắc an toàn

1. **Điều kiện đăng 1 Reel:**
   - `Trạng thái video` = `VIDEO_READY` (Đã tải video lên Drive).
   - `Duyệt đăng` = `ĐÃ DUYỆT` (Đã bấm duyệt trên Dashboard).
   - `Trạng thái đăng tự động` = `SẴN SÀNG ĐĂNG`.
   - `Trạng thái đăng` = `CHƯA ĐĂNG`.
   - `Ngày đăng` = Hôm nay.
   - `Slot đăng` = Slot hiện tại (`SÁNG` 08h, `TRƯA` 12h, `TỐI` 20h).
   - Có caption và link Drive hợp lệ, dung lượng video $\le 50\text{ MB}$.

2. **Quy tắc an toàn chống đăng trùng:**
   - **Khóa Phục Hồi (Recovery Lock `PTAT_REEL_IN_FLIGHT`):** Khi bắt đầu gọi Meta API, hệ thống tự đặt khóa. Nếu quá trình đăng lỗi hoặc gián đoạn, hệ thống tự động **dừng lại** và yêu cầu con người kiểm tra Fanpage trước khi gỡ khóa.
   - **Giới hạn ngày:** Tối đa 3 Reels/ngày (`PTAT_REEL_DAILY_COUNT`).
   - **Bảo mật Token:** Access Token Meta lưu an toàn trong `Script Properties` (`PTAT_META_PAGE_ACCESS_TOKEN`), không bao giờ lộ ra client hay in vào log.

---

## 👨‍💻 Tác giả & Quyền sở hữu
Dự án thuộc kênh **Phong Thủy An Tâm (PTAT)**. Tất cả cấu hình và token thuộc sở hữu của người vận hành dự án.

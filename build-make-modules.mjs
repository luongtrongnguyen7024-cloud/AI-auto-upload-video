import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/make-modules-20260913";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Module Make");
sheet.showGridLines = false;
sheet.tabColor = "#0F766E";

sheet.getRange("A2:J2").merge();
sheet.getRange("A2").values = [["Bảng module Make — Pipeline nội dung AI"]];
sheet.getRange("A3:J3").merge();
sheet.getRange("A3").values = [["Bản khung để thiết kế scenario. Không tự kết nối tài khoản, gọi API trả phí hoặc đăng nội dung."]];

sheet.getRange("A5:B5").values = [["Tổng module", "Chờ cấu hình"]];
sheet.getRange("A6:B6").formulas = [["=COUNTA(A10:A25)", "=COUNTIF(H10:H25,\"Chờ cấu hình\")"]];
sheet.getRange("D5:J5").merge();
sheet.getRange("D5").values = [["Luồng đề xuất: nhận brief → tạo nội dung → lưu asset → kiểm duyệt → xuất bản → ghi dữ liệu"]];

const headers = [[
  "STT", "Giai đoạn", "Ứng dụng", "Module Make", "Mục đích", "Input chính", "Output chính", "Trạng thái", "Kiểm duyệt thủ công", "Ghi chú cấu hình"
]];
sheet.getRange("A9:J9").values = headers;

const rows = [
  [1, "Nhận yêu cầu", "Webhooks", "Custom webhook", "Nhận brief hoặc yêu cầu tạo nội dung", "brief, kênh, chủ đề, định dạng", "Bundle brief chuẩn hóa", "Chờ cấu hình", "Không", "Bật API key cho webhook nếu nhận từ hệ thống ngoài"],
  [2, "Chuẩn hóa", "Tools", "Set multiple variables", "Gán ID job, ngày tạo và giá trị mặc định", "Bundle brief", "job_id, fields chuẩn", "Chờ cấu hình", "Không", "Dùng job_id xuyên suốt scenario"],
  [3, "Lọc dữ liệu", "Flow control", "Router", "Tách nhánh theo loại nội dung hoặc kênh", "channel, content_type", "Nhánh xử lý phù hợp", "Chờ cấu hình", "Không", "Đặt filter rõ ràng cho từng nhánh"],
  [4, "Tạo kịch bản", "OpenAI", "Generate a response", "Viết hook, dàn ý, voice-over và caption", "brief đã chuẩn hóa", "script, caption, CTA", "Chờ cấu hình", "Có", "Cần connection và prompt version cố định"],
  [5, "Kiểm tra nội dung", "OpenAI", "Generate a response", "Rà quy tắc kênh, claim nhạy cảm và CTA", "script", "review_notes, risk_flag", "Chờ cấu hình", "Có", "Không cho phép tự động duyệt hoặc xuất bản"],
  [6, "Điều phối", "Flow control", "Router", "Chuyển job sang sửa hoặc chờ duyệt", "risk_flag, review_notes", "Nhánh sửa hoặc hàng đợi duyệt", "Chờ cấu hình", "Có", "Filter: cần sửa, cần duyệt, đạt"],
  [7, "Lưu kịch bản", "Google Drive", "Upload a file", "Lưu file kịch bản và metadata", "script text, job_id", "Drive file ID, URL", "Chờ cấu hình", "Không", "Chọn thư mục riêng theo kênh và tháng"],
  [8, "Tạo asset", "HTTP", "Make a request", "Gọi dịch vụ tạo ảnh/video khi đã được phê duyệt", "prompt đã duyệt", "asset URL hoặc job ID", "Chờ cấu hình", "Có", "Chỉ cấu hình sau khi xác nhận chi phí API và quyền dùng dịch vụ"],
  [9, "Chờ render", "Tools", "Sleep", "Đợi ngắn trước khi kiểm tra job render", "job ID", "Delay hoàn tất", "Chờ cấu hình", "Không", "Chỉ dùng khi nhà cung cấp không có webhook"],
  [10, "Nhận asset", "HTTP", "Get a file", "Tải file media hoàn chỉnh", "asset URL", "Binary file", "Chờ cấu hình", "Có", "Kiểm tra MIME, kích thước và thời lượng"],
  [11, "Lưu asset", "Google Drive", "Upload a file", "Lưu file media để review và tái sử dụng", "binary file, filename", "Drive file ID, URL", "Chờ cấu hình", "Không", "Giữ tên file: channel_date_jobid_version"],
  [12, "Hàng đợi duyệt", "Google Sheets", "Add a row", "Tạo hàng review với link script và asset", "job metadata, Drive URLs", "review row", "Chờ cấu hình", "Có", "Cần cột quyết định: Approved / Revise / Rejected"],
  [13, "Đọc quyết định", "Google Sheets", "Watch new rows", "Nhận phản hồi duyệt từ bảng review", "review row", "decision, feedback", "Chờ cấu hình", "Có", "Chỉ trigger khi trạng thái quyết định thay đổi"],
  [14, "Thông báo", "Telegram Bot", "Send a text message", "Báo cho người duyệt khi job sẵn sàng hoặc lỗi", "job status, review URL", "message ID", "Chờ cấu hình", "Không", "Tùy chọn. Không gửi cho đến khi bạn kết nối bot"],
  [15, "Xuất bản", "YouTube", "Upload a video", "Đăng video sau khi có phê duyệt rõ ràng", "approved asset, title, description", "video ID, URL", "Chờ cấu hình", "Có", "Tắt hoặc bỏ module này nếu chưa muốn auto-publish"],
  [16, "Ghi log", "Google Sheets", "Update a row", "Cập nhật URL xuất bản, trạng thái và lỗi", "job_id, publish result", "log hoàn chỉnh", "Chờ cấu hình", "Không", "Dùng job_id làm khóa, tránh cập nhật nhầm hàng"],
];
sheet.getRange("A10:J25").values = rows;

const table = sheet.tables.add("A9:J25", true, "MakeModulesTable");
table.style = "TableStyleMedium2";
table.showBandedColumns = false;
table.showFilterButton = true;

sheet.getRange("A2:J2").format = {
  font: { name: "Arial", size: 15, bold: true, color: "#13322B" },
  verticalAlignment: "center",
};
sheet.getRange("A3:J3").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#52616B" },
  verticalAlignment: "center",
};
sheet.getRange("A5:B5").format = { fill: "#D1FAE5", font: { name: "Arial", size: 10, bold: true, color: "#065F46" }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A6:B6").format = { fill: "#ECFDF5", font: { name: "Arial", size: 14, bold: true, color: "#065F46" }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("D5:J5").format = { fill: "#F1F5F9", font: { name: "Arial", size: 10, color: "#334155" }, verticalAlignment: "center" };
sheet.getRange("A9:J25").format.font = { name: "Arial", size: 10, color: "#1F2937" };
sheet.getRange("A9:J9").format = { fill: "#0F766E", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
sheet.getRange("A10:A25").format.horizontalAlignment = "center";
sheet.getRange("H10:I25").format.horizontalAlignment = "center";
sheet.getRange("A9:J25").format.verticalAlignment = "center";
sheet.getRange("E10:J25").format.wrapText = true;
sheet.getRange("A9:J25").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };
sheet.getRange("H10:H25").conditionalFormats.add("containsText", { text: "Chờ cấu hình", format: { fill: "#FEF3C7", font: { color: "#92400E", bold: true } } });
sheet.getRange("I10:I25").conditionalFormats.add("containsText", { text: "Có", format: { fill: "#FEE2E2", font: { color: "#991B1B", bold: true } } });

const widths = [7, 18, 17, 25, 35, 31, 28, 17, 22, 42];
for (let i = 0; i < widths.length; i++) sheet.getRangeByIndexes(0, i, 26, 1).format.columnWidth = widths[i];
sheet.getRange("2:2").format.rowHeight = 28;
sheet.getRange("3:3").format.rowHeight = 22;
sheet.getRange("5:6").format.rowHeight = 24;
sheet.getRange("9:9").format.rowHeight = 32;
sheet.getRange("10:25").format.rowHeight = 44;
sheet.freezePanes.freezeRows(9);

workbook.recalculate();
const check = await workbook.inspect({ kind: "table", range: "Module Make!A5:J25", include: "values,formulas", tableMaxRows: 25, tableMaxCols: 10 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "Module Make", range: "A1:J25", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/bang-module-make.xlsx`);

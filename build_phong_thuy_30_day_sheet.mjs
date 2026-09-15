import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/Acer/OneDrive/Tài liệu/ChatGPT/AI agent/outputs/phong-thuy-an-tam-30-ngay";
const outputPath = `${outputDir}/phong-thuy-an-tam-30-ngay.xlsx`;
const font = "Arial";
const green = "#1E5C42";
const lightGreen = "#E9F4EC";
const paleGold = "#FFF6DD";
const charcoal = "#1F2937";
const line = "#D9E2DD";

const wb = Workbook.create();
const dashboard = wb.worksheets.add("Dashboard 30 ngày");
const queue = wb.worksheets.add("Content Queue");
const lists = wb.worksheets.add("Danh mục");

for (const sheet of [dashboard, queue, lists]) {
  sheet.showGridLines = false;
}

// DANH MỤC — only the controlled vocabulary used by the workflow.
lists.getRange("A1:B1").values = [["Nhóm", "Giá trị"]];
const catalogRows = [
  ["Kênh", "PHONG_THUY"],
  ["Định dạng", "REEL"], ["Định dạng", "BÀI VIẾT"],
  ["Trụ nội dung", "Không gian sống an yên"], ["Trụ nội dung", "Thói quen sống cân bằng"], ["Trụ nội dung", "Phong thủy ứng dụng"], ["Trụ nội dung", "Góc nhìn tâm linh tham khảo"],
  ["Duyệt ý tưởng", "MỚI"], ["Duyệt ý tưởng", "DUYỆT TẠO"], ["Duyệt ý tưởng", "LOẠI"],
  ["Trạng thái video", "CHƯA TẠO"], ["Trạng thái video", "ĐANG TẠO"], ["Trạng thái video", "CẦN DUYỆT"], ["Trạng thái video", "ĐẠT"], ["Trạng thái video", "KHÔNG ĐẠT"],
  ["Duyệt đăng", "CHƯA"], ["Duyệt đăng", "SẴN SÀNG ĐĂNG"],
  ["Trạng thái đăng", "CHƯA ĐĂNG"], ["Trạng thái đăng", "ĐÃ ĐĂNG"], ["Trạng thái đăng", "LỖI"],
];
lists.getRange(`A2:B${catalogRows.length + 1}`).values = catalogRows;
lists.getRange("D1:D6").values = [
  ["Nguyên tắc 30 ngày đầu"],
  ["Tạo giá trị trước; chưa gắn link sản phẩm hay bình luận bán hàng."],
  ["Mỗi ý tưởng, video và bài đăng đều phải có duyệt của bạn."],
  ["Chỉ chia sẻ tham khảo; không hứa hẹn đổi vận, chữa bệnh hay giàu nhanh."],
  ["Ưu tiên 1 insight rõ ràng, ví dụ đời sống và lời kết bình tĩnh."],
  ["Ngày 30 chọn lại 3 định dạng tốt nhất theo phản hồi thực tế."],
];

// CONTENT QUEUE — the one operational source of truth for an eventual Make scenario.
const headers = [
  "Content ID", "Kênh", "Định dạng", "Trụ nội dung", "Ý tưởng", "Hook mở đầu",
  "Kịch bản", "Caption Facebook", "Duyệt ý tưởng", "Trạng thái video", "Duyệt đăng",
  "Ngày đăng", "File video (Drive)", "Link bài/Reel", "Lượt xem 72h", "Chia sẻ",
  "Bình luận", "Follower mới", "Trạng thái đăng", "Ghi chú học được"
];
queue.getRange("A1:T1").values = [headers];
queue.getRange("A2:T2").values = [[
  "PTAT-001", "PHONG_THUY", "BÀI VIẾT", "Định vị Page", "Bài chào mừng Page",
  "Một góc nhìn đơn giản để sống an yên hơn mỗi ngày.",
  "", "Chào mừng bạn đến với Phong Thủy An Tâm. Đây là nơi chia sẻ những góc nhìn đơn giản, thực tế về không gian sống, phong thủy ứng dụng và các thói quen giúp cuộc sống cân bằng, an yên hơn mỗi ngày. Nội dung trên Trang mang tính tham khảo.",
  "DUYỆT TẠO", "CHƯA TẠO", "CHƯA", new Date(2026, 8, 13), "", "", 0, 0, 0, 0, "ĐÃ ĐĂNG", "Bài mở đầu của Page"
]];

// Validations cover 100 working rows and remain editable; no post will be published by the sheet itself.
queue.getRange("B2:B101").dataValidation = { rule: { type: "list", values: ["PHONG_THUY"] } };
queue.getRange("C2:C101").dataValidation = { rule: { type: "list", values: ["REEL", "BÀI VIẾT"] } };
queue.getRange("D2:D101").dataValidation = { rule: { type: "list", values: ["Không gian sống an yên", "Thói quen sống cân bằng", "Phong thủy ứng dụng", "Góc nhìn tâm linh tham khảo", "Định vị Page"] } };
queue.getRange("I2:I101").dataValidation = { rule: { type: "list", values: ["MỚI", "DUYỆT TẠO", "LOẠI"] } };
queue.getRange("J2:J101").dataValidation = { rule: { type: "list", values: ["CHƯA TẠO", "ĐANG TẠO", "CẦN DUYỆT", "ĐẠT", "KHÔNG ĐẠT"] } };
queue.getRange("K2:K101").dataValidation = { rule: { type: "list", values: ["CHƯA", "SẴN SÀNG ĐĂNG"] } };
queue.getRange("S2:S101").dataValidation = { rule: { type: "list", values: ["CHƯA ĐĂNG", "ĐÃ ĐĂNG", "LỖI"] } };

// DASHBOARD — goal, measured progress, then an actionable Day 1–30 cadence.
dashboard.getRange("A2").values = [["Phong Thủy An Tâm — 30 ngày đầu"]];
dashboard.getRange("A3").values = [["Mục tiêu: xây niềm tin bằng nội dung hữu ích; chưa bán hàng, chưa tự động đăng."]];
dashboard.getRange("A5:C5").values = [["Chỉ số", "Mục tiêu", "Hiện tại"]];
dashboard.getRange("A6:C11").values = [
  ["Reels đã đăng", 20, null],
  ["Bài viết đã đăng", 8, null],
  ["Ý tưởng đã duyệt tạo", 28, null],
  ["Video đạt sau kiểm duyệt", 20, null],
  ["Tỷ lệ có ghi chú học được", "100%", null],
  ["Quyết định format cho tháng 2", "Ngày 30", "Chưa đánh giá"],
];
dashboard.getRange("C6").formulas = [["=COUNTIFS('Content Queue'!$S$2:$S$101,\"ĐÃ ĐĂNG\",'Content Queue'!$C$2:$C$101,\"REEL\")"]];
dashboard.getRange("C7").formulas = [["=COUNTIFS('Content Queue'!$S$2:$S$101,\"ĐÃ ĐĂNG\",'Content Queue'!$C$2:$C$101,\"BÀI VIẾT\")"]];
dashboard.getRange("C8").formulas = [["=COUNTIF('Content Queue'!$I$2:$I$101,\"DUYỆT TẠO\")"]];
dashboard.getRange("C9").formulas = [["=COUNTIF('Content Queue'!$J$2:$J$101,\"ĐẠT\")"]];
dashboard.getRange("C10").formulas = [["=IF(COUNTA('Content Queue'!$A$2:$A$101)=0,0,COUNTIF('Content Queue'!$T$2:$T$101,\"<>\")/COUNTA('Content Queue'!$A$2:$A$101))"]];

dashboard.getRange("A13:F13").values = [["Ngày", "Tuần", "Trọng tâm", "Đầu ra cần có", "Số lượng", "Kiểm tra / quyết định"]];
const plan = [
  [1, "Tuần 1", "Xác định 4 trụ nội dung", "20 ý tưởng thô trong Content Queue", 20, "Không chấm chất lượng khi chưa có đủ lựa chọn"],
  [2, "Tuần 1", "Chọn góc có ích", "Duyệt 7 ý tưởng đầu tiên", 7, "LOẠI ý tưởng mơ hồ hoặc hứa hẹn quá mức"],
  [3, "Tuần 1", "Viết kịch bản", "3 kịch bản Reels + caption", 3, "Mỗi Reel chỉ 1 insight"],
  [4, "Tuần 1", "Sản xuất và duyệt", "2 video tạo xong, tự xem và ghi chú", 2, "Chỉ đánh dấu ĐẠT khi bạn hài lòng"],
  [5, "Tuần 1", "Đăng giá trị", "2 Reels + 1 bài viết", 3, "Nhập link bài/Reel sau khi đăng"],
  [6, "Tuần 1", "Tạo tồn kho", "3 ý tưởng mới + 2 caption", 5, "Ghi câu hỏi/ý kiến người xem"],
  [7, "Tuần 1", "Rà soát", "Ghi số liệu 72h cho nội dung có đủ dữ liệu", 1, "Chọn 1 hook cần thử lại"],
  [8, "Tuần 2", "Lặp format có phản hồi", "5 ý tưởng theo hook tốt nhất", 5, "Không đổi toàn bộ chủ đề cùng lúc"],
  [9, "Tuần 2", "Viết kịch bản", "3 kịch bản Reels + caption", 3, "Câu đầu rõ lợi ích"],
  [10, "Tuần 2", "Sản xuất và duyệt", "2 video hoàn chỉnh", 2, "Duyệt bằng mắt trước khi tải"],
  [11, "Tuần 2", "Đăng", "2 Reels + 1 bài viết", 3, "Không chèn link sản phẩm"],
  [12, "Tuần 2", "Sản xuất và duyệt", "3 video hoàn chỉnh", 3, "Đảm bảo chữ/giọng không gây hiểu nhầm"],
  [13, "Tuần 2", "Đăng", "3 Reels + 1 bài viết", 4, "Điền caption đúng content ID"],
  [14, "Tuần 2", "Rà soát", "Cập nhật số liệu và 3 bài học", 3, "Ưu tiên chia sẻ/bình luận hơn lượt xem đơn lẻ"],
  [15, "Tuần 3", "Tạo ý tưởng theo phản hồi", "7 ý tưởng mới", 7, "Bám câu hỏi thật của người xem"],
  [16, "Tuần 3", "Viết kịch bản", "3 kịch bản Reels + caption", 3, "Không lặp nguyên văn script cũ"],
  [17, "Tuần 3", "Sản xuất và duyệt", "2 video hoàn chỉnh", 2, "Giữ nhịp nói và phụ đề dễ xem"],
  [18, "Tuần 3", "Đăng", "2 Reels + 1 bài viết", 3, "Kiểm tra đúng Page trước khi đăng"],
  [19, "Tuần 3", "Sản xuất và duyệt", "3 video hoàn chỉnh", 3, "Lưu file vào Drive có tên content ID"],
  [20, "Tuần 3", "Đăng", "3 Reels + 1 bài viết", 4, "Ghi link bài/Reel"],
  [21, "Tuần 3", "Rà soát", "Bảng học được của tuần", 1, "Chọn 2 format tiếp tục"],
  [22, "Tuần 4", "Làm sâu chủ đề tốt", "5 ý tưởng mới", 5, "Tập trung 2 format đã chứng minh"],
  [23, "Tuần 4", "Viết kịch bản", "3 kịch bản Reels + caption", 3, "Bỏ góc rườm rà, mơ hồ"],
  [24, "Tuần 4", "Sản xuất và duyệt", "2 video hoàn chỉnh", 2, "Tự kiểm tra video trước khi tải về"],
  [25, "Tuần 4", "Đăng", "2 Reels + 1 bài viết", 3, "Đối chiếu caption với đúng dòng"],
  [26, "Tuần 4", "Sản xuất và duyệt", "3 video hoàn chỉnh", 3, "Chỉ hàng ĐẠT mới được sẵn sàng đăng"],
  [27, "Tuần 4", "Đăng", "3 Reels + 1 bài viết", 4, "Cập nhật số liệu sau 72h"],
  [28, "Tuần 4", "Thu thập phản hồi", "Ghi 5 nhận xét/ câu hỏi đáng chú ý", 5, "Không dùng spam để kéo tương tác"],
  [29, "Tổng kết", "Đọc dữ liệu", "Xếp hạng 3 format và 3 hook", 6, "Dựa vào chia sẻ, bình luận và ghi chú"],
  [30, "Tổng kết", "Ra quyết định tháng 2", "Giữ 3 format; loại hoặc sửa format yếu", 1, "Chưa thêm link sản phẩm nếu chưa có giá trị rõ ràng"],
];
dashboard.getRange(`A14:F${13 + plan.length}`).values = plan;

// Styling: compact, readable, and intentionally restrained.
for (const sheet of [dashboard, queue, lists]) {
  sheet.getUsedRange().format.font = { name: font, size: 10, color: charcoal };
  sheet.getUsedRange().format.verticalAlignment = "center";
}
dashboard.getRange("A2:F2").format = { font: { name: font, size: 15, bold: true, color: green } };
dashboard.getRange("A3:F3").format = { font: { name: font, size: 10, italic: true, color: "#52605B" } };
for (const headerRange of ["A5:C5", "A13:F13", "A1:B1", "A1:T1"]) {
  const sheet = headerRange === "A1:T1" ? queue : headerRange === "A1:B1" ? lists : dashboard;
  sheet.getRange(headerRange).format = { fill: green, font: { name: font, size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center" };
  sheet.getRange(headerRange).format.borders = { preset: "outside", style: "thin", color: line };
}
dashboard.getRange("A6:C11").format.borders = { preset: "outside", style: "thin", color: line };
dashboard.getRange("A14:F43").format.borders = { preset: "outside", style: "thin", color: line };
dashboard.getRange("A6:B11").format.fill = lightGreen;
dashboard.getRange("C6:C11").format.fill = paleGold;
dashboard.getRange("C10").format.numberFormat = "0%";
dashboard.getRange("A14:F43").format.wrapText = true;
dashboard.getRange("A14:F43").format.rowHeight = 33;
dashboard.getRange("A5:C11").format.rowHeight = 22;

queue.getRange("A1:T101").format.borders = { preset: "outside", style: "thin", color: line };
queue.getRange("A2:T101").format.verticalAlignment = "top";
queue.getRange("A2:T101").format.wrapText = true;
queue.getRange("L2:L101").format.numberFormat = "yyyy-mm-dd";
queue.getRange("O2:R101").format.numberFormat = "#,##0";
queue.getRange("A2:T101").format.rowHeight = 40;
queue.getRange("A2:T101").conditionalFormats.add("containsText", { text: "LỖI", format: { fill: "#FDECEC", font: { color: "#B42318", bold: true } } });

lists.getRange(`A1:B${catalogRows.length + 1}`).format.borders = { preset: "outside", style: "thin", color: line };
lists.getRange("D1:D6").format.wrapText = true;
lists.getRange("D1").format = { fill: lightGreen, font: { name: font, size: 10, bold: true, color: green } };
lists.getRange("D2:D6").format.fill = "#FAFCFA";

dashboard.getRange("A:A").format.columnWidth = 15;
dashboard.getRange("B:B").format.columnWidth = 13;
dashboard.getRange("C:C").format.columnWidth = 16;
dashboard.getRange("D:D").format.columnWidth = 28;
dashboard.getRange("E:E").format.columnWidth = 16;
dashboard.getRange("F:F").format.columnWidth = 40;
queue.getRange("A:A").format.columnWidth = 14;
queue.getRange("B:D").format.columnWidth = 18;
queue.getRange("E:E").format.columnWidth = 31;
queue.getRange("F:F").format.columnWidth = 28;
queue.getRange("G:H").format.columnWidth = 46;
queue.getRange("I:K").format.columnWidth = 18;
queue.getRange("L:L").format.columnWidth = 13;
queue.getRange("M:N").format.columnWidth = 28;
queue.getRange("O:R").format.columnWidth = 13;
queue.getRange("S:S").format.columnWidth = 16;
queue.getRange("T:T").format.columnWidth = 36;
lists.getRange("A:A").format.columnWidth = 20;
lists.getRange("B:B").format.columnWidth = 34;
lists.getRange("D:D").format.columnWidth = 76;

queue.freezePanes.freezeRows(1);
queue.freezePanes.freezeColumns(2);
lists.freezePanes.freezeRows(1);

wb.recalculate();

const checks = [
  await wb.inspect({ kind: "table", range: "Dashboard 30 ngày!A2:F20", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 6 }),
  await wb.inspect({ kind: "table", range: "Content Queue!A1:T3", include: "values,formulas", tableMaxRows: 3, tableMaxCols: 20 }),
  await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" }),
];
console.log(checks.map((x) => x.ndjson).join("\n"));

await fs.mkdir(outputDir, { recursive: true });
for (const [sheetName, fileName] of [["Dashboard 30 ngày", "dashboard.png"], ["Content Queue", "content-queue.png"], ["Danh mục", "danh-muc.png"]]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);

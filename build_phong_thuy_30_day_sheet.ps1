$ErrorActionPreference = 'Stop'
$outDir = 'C:\Users\Acer\OneDrive\Tài liệu\ChatGPT\AI agent\outputs\phong-thuy-an-tam-30-ngay'
$outFile = Join-Path $outDir 'phong-thuy-an-tam-30-ngay.xlsx'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Add()
  while ($wb.Worksheets.Count -lt 3) { $null = $wb.Worksheets.Add() }
  $dash = $wb.Worksheets.Item(1); $dash.Name = 'Dashboard 30 ngày'
  $queue = $wb.Worksheets.Item(2); $queue.Name = 'Content Queue'
  $lists = $wb.Worksheets.Item(3); $lists.Name = 'Danh mục'
  for ($i = $wb.Worksheets.Count; $i -gt 3; $i--) { $wb.Worksheets.Item($i).Delete() }

  $green = 4284346; $lightGreen = 15594217; $gold = 14545535; $dark = 2039583; $white = 16777215
  function Header($range) { $range.Interior.Color = $green; $range.Font.Color = $white; $range.Font.Bold = $true; $range.HorizontalAlignment = -4108; $range.VerticalAlignment = -4108 }
  function Set-Cell($sheet, $row, $col, $value) { $sheet.Cells.Item($row,$col).Value2 = [string]$value }

  # Main workflow queue: one row = one item, one authoritative status trail.
  $headers = @('Content ID','Kênh','Định dạng','Trụ nội dung','Ý tưởng','Hook mở đầu','Kịch bản','Caption Facebook','Duyệt ý tưởng','Trạng thái video','Duyệt đăng','Ngày đăng','File video (Drive)','Link bài/Reel','Lượt xem 72h','Chia sẻ','Bình luận','Follower mới','Trạng thái đăng','Ghi chú học được')
  for ($c=1; $c -le $headers.Count; $c++) { Set-Cell $queue 1 $c $headers[$c-1] }
  Header $queue.Range('A1:T1')
  $seed = @('PTAT-001','PHONG_THUY','BÀI VIẾT','Định vị Page','Bài chào mừng Page','Một góc nhìn đơn giản để sống an yên hơn mỗi ngày.','', 'Chào mừng bạn đến với Phong Thủy An Tâm. Đây là nơi chia sẻ những góc nhìn đơn giản, thực tế về không gian sống, phong thủy ứng dụng và các thói quen giúp cuộc sống cân bằng, an yên hơn mỗi ngày. Nội dung trên Trang mang tính tham khảo.','DUYỆT TẠO','CHƯA TẠO','CHƯA','2026-09-13','','',0,0,0,0,'ĐÃ ĐĂNG','Bài mở đầu của Page')
  for ($c=1; $c -le $seed.Count; $c++) { Set-Cell $queue 2 $c $seed[$c-1] }
  $queue.Range('L2:L101').NumberFormat = 'yyyy-mm-dd'
  $queue.Range('O2:R101').NumberFormat = '#,##0'
  $queue.Range('A1:T101').Font.Name = 'Arial'; $queue.Range('A1:T101').Font.Size = 10
  $queue.Range('A1:T101').VerticalAlignment = -4160; $queue.Range('A2:T101').WrapText = $true
  $queue.Rows.Item(1).RowHeight = 28; $queue.Range('A2:T101').RowHeight = 42
  $queue.Range('A1:T101').Borders.LineStyle = 1; $queue.Range('A1:T101').Borders.Color = 14013909
  $widths = @(14,16,14,24,32,30,45,48,17,18,18,13,28,28,14,12,12,14,16,36)
  for ($c=1; $c -le 20; $c++) { $queue.Columns.Item($c).ColumnWidth = $widths[$c-1] }
  $queue.Application.ActiveWindow.SplitRow = 1; $queue.Application.ActiveWindow.FreezePanes = $true

  # Dropdowns constrain stages but do not cause automation or publishing.
  $validations = @(
    @{ Range='B2:B101'; Values='PHONG_THUY' },
    @{ Range='C2:C101'; Values='REEL,BÀI VIẾT' },
    @{ Range='D2:D101'; Values='Không gian sống an yên,Thói quen sống cân bằng,Phong thủy ứng dụng,Góc nhìn tâm linh tham khảo,Định vị Page' },
    @{ Range='I2:I101'; Values='MỚI,DUYỆT TẠO,LOẠI' },
    @{ Range='J2:J101'; Values='CHƯA TẠO,ĐANG TẠO,CẦN DUYỆT,ĐẠT,KHÔNG ĐẠT' },
    @{ Range='K2:K101'; Values='CHƯA,SẴN SÀNG ĐĂNG' },
    @{ Range='S2:S101'; Values='CHƯA ĐĂNG,ĐÃ ĐĂNG,LỖI' }
  )
  foreach ($v in $validations) { $r=$queue.Range($v.Range); $r.Validation.Delete(); $r.Validation.Add(3,1,1,$v.Values); $r.Validation.InCellDropdown=$true }

  # Dashboard: goals are targets, formulas reflect the queue rather than typed progress.
  Set-Cell $dash 2 1 'Phong Thủy An Tâm — 30 ngày đầu'
  Set-Cell $dash 3 1 'Mục tiêu: xây niềm tin bằng nội dung hữu ích; chưa bán hàng, chưa tự động đăng.'
  $dash.Range('A2:F2').Font.Name='Arial'; $dash.Range('A2:F2').Font.Size=15; $dash.Range('A2:F2').Font.Bold=$true; $dash.Range('A2:F2').Font.Color=$green
  $dash.Range('A3:F3').Font.Italic=$true; $dash.Range('A3:F3').Font.Color=5592405
  @('Chỉ số','Mục tiêu','Hiện tại') | ForEach-Object -Begin {$c=1} -Process { Set-Cell $dash 5 $c $_; $c++ }
  Header $dash.Range('A5:C5')
  $metrics=@(
    @('Reels đã đăng',20,'=COUNTIFS(''Content Queue''!$S$2:$S$101,"ĐÃ ĐĂNG",''Content Queue''!$C$2:$C$101,"REEL")'),
    @('Bài viết đã đăng',8,'=COUNTIFS(''Content Queue''!$S$2:$S$101,"ĐÃ ĐĂNG",''Content Queue''!$C$2:$C$101,"BÀI VIẾT")'),
    @('Ý tưởng đã duyệt tạo',28,'=COUNTIF(''Content Queue''!$I$2:$I$101,"DUYỆT TẠO")'),
    @('Video đạt sau kiểm duyệt',20,'=COUNTIF(''Content Queue''!$J$2:$J$101,"ĐẠT")'),
    @('Tỷ lệ có ghi chú học được','100%','=IF(COUNTA(''Content Queue''!$A$2:$A$101)=0,0,COUNTIF(''Content Queue''!$T$2:$T$101,"<>")/COUNTA(''Content Queue''!$A$2:$A$101))'),
    @('Quyết định format tháng 2','Ngày 30','Chưa đánh giá')
  )
  for ($r=0; $r -lt $metrics.Count; $r++) { Set-Cell $dash (6+$r) 1 $metrics[$r][0]; Set-Cell $dash (6+$r) 2 $metrics[$r][1]; $dash.Cells.Item((6+$r),3).Formula=$metrics[$r][2] }
  $dash.Range('A6:B11').Interior.Color=$lightGreen; $dash.Range('C6:C11').Interior.Color=$gold; $dash.Range('C10').NumberFormat='0%'; $dash.Range('A5:C11').Borders.LineStyle=1; $dash.Range('A5:C11').Borders.Color=14013909

  @('Ngày','Tuần','Trọng tâm','Đầu ra cần có','Số lượng','Kiểm tra / quyết định') | ForEach-Object -Begin {$c=1} -Process { Set-Cell $dash 13 $c $_; $c++ }
  Header $dash.Range('A13:F13')
  $weekFocus=@('Xây nền & thử 4 trụ','Lặp hook có phản hồi','Làm sâu câu hỏi người xem','Củng cố format tốt nhất')
  for ($day=1; $day -le 30; $day++) {
    $week=[math]::Min(4,[math]::Ceiling($day/7)); $phase=$weekFocus[$week-1]
    $focus=''
    $output=''
    $qty=0
    switch (($day-1) % 7) {
      0 { $focus='Tạo và lọc ý tưởng'; $output='Ý tưởng mới trong Content Queue'; $qty=5 }
      1 { $focus='Duyệt ý tưởng'; $output='Ý tưởng đủ rõ để làm kịch bản'; $qty=4 }
      2 { $focus='Viết kịch bản + caption'; $output='Kịch bản Reel ngắn, 1 insight/video'; $qty=3 }
      3 { $focus='Tạo video và tự duyệt'; $output='Video đã xem lại trước khi tải'; $qty=2 }
      4 { $focus='Đăng nội dung'; $output='2 Reels hoặc 1 Reel + 1 bài viết'; $qty=2 }
      5 { $focus='Tạo tồn kho'; $output='Video/caption sẵn cho ngày tiếp theo'; $qty=2 }
      6 { $focus='Đọc phản hồi'; $output='Cập nhật số liệu 72h và ghi chú học được'; $qty=1 }
    }
    if ($day -eq 1) { $focus='Xác định 4 trụ nội dung'; $output='20 ý tưởng thô'; $qty=20 }
    if ($day -eq 29) { $focus='Đọc dữ liệu'; $output='Xếp hạng 3 format và 3 hook'; $qty=6 }
    if ($day -eq 30) { $focus='Ra quyết định tháng 2'; $output='Giữ 3 format; loại/sửa format yếu'; $qty=1 }
    $check=if($day -eq 30){'Chưa thêm link sản phẩm nếu chưa có giá trị rõ ràng'}elseif($focus -like '*duyệt*'){'Chỉ bạn quyết định ĐẠT / KHÔNG ĐẠT'}elseif($focus -eq 'Đăng nội dung'){'Kiểm tra đúng Page và caption đúng Content ID'}else{'Không dùng hứa hẹn đổi vận, chữa bệnh hay giàu nhanh'}
    $row=13+$day; Set-Cell $dash $row 1 $day; Set-Cell $dash $row 2 "Tuần $week"; Set-Cell $dash $row 3 "$phase — $focus"; Set-Cell $dash $row 4 $output; Set-Cell $dash $row 5 $qty; Set-Cell $dash $row 6 $check
  }
  $dash.Range('A14:F43').WrapText=$true; $dash.Range('A14:F43').RowHeight=34; $dash.Range('A13:F43').Borders.LineStyle=1; $dash.Range('A13:F43').Borders.Color=14013909
  $dash.Range('A1:F43').Font.Name='Arial'; $dash.Range('A1:F43').Font.Size=10
  $dash.Columns.Item(1).ColumnWidth=15; $dash.Columns.Item(2).ColumnWidth=13; $dash.Columns.Item(3).ColumnWidth=34; $dash.Columns.Item(4).ColumnWidth=33; $dash.Columns.Item(5).ColumnWidth=13; $dash.Columns.Item(6).ColumnWidth=43

  # Controlled vocabulary and guardrails for future Make routing.
  Set-Cell $lists 1 1 'Nhóm'; Set-Cell $lists 1 2 'Giá trị'; Header $lists.Range('A1:B1')
  $cat=@(
    @('Kênh','PHONG_THUY'),@('Định dạng','REEL'),@('Định dạng','BÀI VIẾT'),@('Trụ nội dung','Không gian sống an yên'),@('Trụ nội dung','Thói quen sống cân bằng'),@('Trụ nội dung','Phong thủy ứng dụng'),@('Trụ nội dung','Góc nhìn tâm linh tham khảo'),@('Duyệt ý tưởng','MỚI'),@('Duyệt ý tưởng','DUYỆT TẠO'),@('Duyệt ý tưởng','LOẠI'),@('Trạng thái video','CHƯA TẠO'),@('Trạng thái video','ĐANG TẠO'),@('Trạng thái video','CẦN DUYỆT'),@('Trạng thái video','ĐẠT'),@('Trạng thái video','KHÔNG ĐẠT'),@('Duyệt đăng','CHƯA'),@('Duyệt đăng','SẴN SÀNG ĐĂNG'),@('Trạng thái đăng','CHƯA ĐĂNG'),@('Trạng thái đăng','ĐÃ ĐĂNG'),@('Trạng thái đăng','LỖI')
  )
  for($r=0;$r -lt $cat.Count;$r++){ Set-Cell $lists (2+$r) 1 $cat[$r][0]; Set-Cell $lists (2+$r) 2 $cat[$r][1] }
  Set-Cell $lists 1 4 'Nguyên tắc 30 ngày đầu'; $lists.Range('D1').Interior.Color=$lightGreen; $lists.Range('D1').Font.Bold=$true; $lists.Range('D1').Font.Color=$green
  $rules=@('Tạo giá trị trước; chưa gắn link sản phẩm hay bình luận bán hàng.','Mỗi ý tưởng, video và bài đăng đều phải có duyệt của bạn.','Chỉ chia sẻ tham khảo; không hứa hẹn đổi vận, chữa bệnh hay giàu nhanh.','Ưu tiên 1 insight rõ ràng, ví dụ đời sống và lời kết bình tĩnh.','Ngày 30 chọn lại 3 định dạng tốt nhất theo phản hồi thực tế.')
  for($r=0;$r -lt $rules.Count;$r++){ Set-Cell $lists (2+$r) 4 $rules[$r] }
  $lists.Range('A1:B21').Borders.LineStyle=1; $lists.Range('A1:B21').Borders.Color=14013909; $lists.Range('A1:D6').Font.Name='Arial'; $lists.Range('A1:D6').Font.Size=10; $lists.Range('D1:D6').WrapText=$true
  $lists.Columns.Item(1).ColumnWidth=22; $lists.Columns.Item(2).ColumnWidth=34; $lists.Columns.Item(4).ColumnWidth=78

  $wb.SaveAs($outFile,51)
  $wb.Close($true)
  Write-Output "OUTPUT=$outFile"
} finally {
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}

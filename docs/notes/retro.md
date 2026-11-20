# Retro

## Đánh giá từng phase
### Phase 1
- Đạt: toàn bộ Test Contract v1.0 (23 test qua CLI). Bot thắng 5/5 seed. Tính tất định từng byte. Headless chạy cả đêm 18000 tick trong khoảng 0.2 s. Bản 3D có HUD, camera, đảo sáng dần khi thắp đèn.
- Chưa đạt hoặc chưa kiểm chứng tự động: chơi lại bằng phím R chưa có bằng chứng tự động, cần thử tay. Game còn dễ (bot thắng trong khoảng 45 s).
- Cần chỉnh: cân bằng độ khó nếu ticket sau yêu cầu. Phần render chưa có test tự động, chỉ có ảnh chụp.

### Phase 2
- Đạt: số chuẩn và contract v1.1; 35 test qua CLI, mỗi tính năng mới có ít nhất một scenario; tính tất định 3 đêm; chạy cả đêm ≤ 0.5 s; khoảng 60 FPS ở 1280×720; UI đủ menu, tạm dừng, cài đặt, HUD, âm thanh.
- Chưa đạt hoặc chưa kiểm chứng: bot không thắng được với số chuẩn. Sau tag `phase-2`, người làm bài đã thử tay: chuỗi màn hình, tạm dừng, cài đặt, âm thanh đều ổn, và thắng được khi chơi tay. Các mục này chỉ có bằng chứng thử tay, không có bằng chứng tự động.
- Hỏng phase trước?: luật Phase 1 bị ticket thay nên test đã được sửa kèm lý do; bằng chứng Phase 1 vẫn còn nguyên ở tag `phase-1`.
- Cần chỉnh: hỏi trợ giảng về các giả định P2-1…P2-16; thêm test UI nếu còn thời gian.
### Phase 3
### Phase 4

## Tổng kết dự án
- Số liệu (số test, số commit, token):
- Điều hiệu quả:
- Điều chưa hiệu quả:
- Nếu làm lại:

# Nhật ký dùng AI

Công cụ: Claude Code (VS Code extension), model Claude Opus 5.5.

| Phase | Việc giao cho AI | AI sai ở đâu / cách phát hiện | Chỉnh harness | Token / chi phí ước tính |
|---|---|---|---|---|
| CP0 | Dựng khung dự án, AGENTS.md, hook Stop, CI, test tính tất định | `node --test tests/` không chạy trên Node 24 (thư mục bị hiểu là file). Phát hiện khi chạy `npm test` thật, sửa sang glob. Git trên Windows tự đổi sang CRLF, phát hiện qua cảnh báo khi commit, thêm `.gitattributes` ép LF | Thêm `.gitattributes` | khoảng 40k token |
| 1 | Đọc PRD-0 và contract, chốt giả định, viết `sim.js`, CLI, 23 test, phần hiển thị, bot, script bằng chứng | (1) 2 test do AI viết bị sai chứ không phải game sai: lấy snapshot sai tick; quên rằng Bóng Mực mặc định sẽ giết người chơi đứng yên trước giây 30. Phát hiện vì test đỏ, đọc lại thấy giả định trong test sai. (2) Script bằng chứng dùng `<(...)`, không chạy với Node trên Windows. (3) Chụp ảnh bằng Chrome với `--virtual-time-budget` bị treo vì vòng render liên tục, đã bỏ tham số này | Đưa mọi con số vào `tuning.js`, có test so với `game.contract.json` để không thể khai lệch. Thêm vào AGENTS.md: chạy `bash scripts/proof-phase1.sh` trước khi gắn tag | khoảng 120k token |
| 2 | Chuyển sang số chuẩn, viết lại `sim.js` theo thứ tự tick bắt buộc, thêm 3 bản đồ, tính năng mới, contract v1.1, 35 test, UI (menu, tạm dừng, cài đặt, HUD, âm thanh), đo FPS | (1) Khi viết test, AI hiểu sai kịch bản khá nhiều lần: Bóng Mực trong scenario tự đuổi theo và đánh người chơi; Bùa Gió nằm trên cầu làm người chơi chạy nhanh hơn; tính sai khoảng cách 3D trong test pulse; cộng thừa quãng đường sau khi lướt. Phát hiện vì test đỏ, đọc lại thấy lỗi ở test chứ không phải ở game. (2) Lỗi thật trong game: tick hồi sinh vẫn bị phím di chuyển đẩy đi, đã sửa. (3) Đêm 3 xuất phát ở (0,0,0) thì rơi ngay vì nằm trong tháp; phát hiện khi chạy thử headless rồi đọc sự kiện. (4) Đo FPS lần đầu ra khung nhìn 1262×624 chứ không phải 1280×720; phát hiện khi đọc output, sửa bằng Emulation.setDeviceMetricsOverride | AGENTS.md: số v1.1, thứ tự tick, lưu ý `quiet()`. Thêm skill `verify-phase`. Thêm `scripts/fps.mjs` | khoảng 250k token |
| 3 | | | | |
| 4 | | | | |

## Cách tiết kiệm token
- Phase 2: làm lõi headless trước (30 điểm test ẩn), test qua CLI, UI sau. Bỏ việc chỉnh bot sau 2 lần thử không hiệu quả, ghi trung thực là chưa đạt thay vì đốt thêm token.
- Đọc hết PRD-0 và contract một lần, chốt toàn bộ giả định trước, rồi viết code một lượt thay vì sửa nhiều vòng.
- Test đi qua CLI giống cách giảng viên chạy, nên không cần một tầng test riêng cho logic bên trong.
- Dùng bot tự chơi để chứng minh "chơi được tới thắng", thay vì phải chơi tay và quay video ở bước này.

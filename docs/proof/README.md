# Bằng chứng kiểm chứng

Chạy lại ở đúng tag (`git checkout phase-N`). Ở tag `phase-2`, các test Phase 1 đã được viết lại theo số chuẩn. Muốn xem bằng chứng Phase 1 nguyên bản thì checkout `phase-1`.

- `npm test`: test contract chạy qua CLI headless, giống cách giảng viên chạy
- `bash scripts/proof-phase1.sh`: bot chơi hết màn, người chơi đứng yên, kiểm tra tính tất định, kiểm tra exit 2, đo tốc độ. Kết quả ghi vào `docs/proof/phase-1/proof-run.txt`

## Phase 1

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` khai đúng số game đang dùng | Test so sánh `tuning` trong file với `src/core/tuning.js` | test `A: ...` | Đạt |
| Mô hình tick: snapshot ở tick 0 và mỗi N tick, `end` ở cuối, `time_left_s` | Test qua CLI | test `B/E: tick model`, `default snapshot-every` | Đạt |
| Tính tất định | Chạy 2 lần so từng byte (test + script); đổi seed thì output khác | test `E: determinism`, [proof-run.txt](phase-1/proof-run.txt) mục 3 | Đạt |
| Inputs: giữ giá trị cũ, xoay theo `cam_yaw_deg`, chuẩn hóa vector | Test | test `C: ...` (2 test) | Đạt |
| Đi lại, nhảy | Test vị trí sau 60 tick; test nhảy rồi đáp xuống Y = 0 | test `C: move...`, `jump` | Đạt |
| Nhặt đom đóm (bán kính tính cả biên, sức chứa) | Test | test `pickup` (2 test) | Đạt |
| Nạp ánh sáng, thắp đèn, thắng `all_lit`, điểm | Test | test `deposit` (2 test) | Đạt |
| Bóng Mực đuổi theo, chạm thì mất flame, rơi đom đóm, bất tử | Test | test `shade chases`, `hit` | Đạt |
| Tỏa sáng: choáng, đẩy lùi, tốn ánh sáng, cooldown, điểm | Test | test `pulse` (2 test), `stun` | Đạt |
| Bóng Mực sợ đèn (vùng an toàn) | Test 600 tick: Bóng Mực không bao giờ vào bán kính an toàn | test `safe_radius` | Đạt |
| Thua `no_flames` hoặc `dawn`, dừng sớm, mã thoát 0 | Test | test `lose` (2 test) | Đạt |
| Scenario dựng xong không phát sự kiện, không cộng điểm | Test | test `D: scenario setup` | Đạt |
| Sinh Bóng Mực với id tuần tự | Test | test `D: random_shades` | Đạt |
| File sai định dạng thì exit 2 và ghi lỗi ra stderr | Test 9 trường hợp + script | test `errors`, [proof-run.txt](phase-1/proof-run.txt) mục 4 | Đạt |
| Chơi được từ đầu tới thắng | Bot tham lam tự chơi 5 seed, xuất inputs, chạy lại qua CLI | [proof-run.txt](phase-1/proof-run.txt) mục 1, `phase-1/bot-seed*.jsonl` | Đạt (5/5 thắng) |
| Có thể thua | Người chơi đứng yên bị Bóng Mực chạm 3 lần | [proof-run.txt](phase-1/proof-run.txt) mục 2 | Đạt |
| Headless chạy nhanh | Đo 18000 tick (cả đêm) | [proof-run.txt](phase-1/proof-run.txt) mục 5 (khoảng 0.2 s) | Đạt |
| Camera 3D, HUD, Mây đội nón lá có đèn | Ảnh chụp bằng Chrome headless từ bản build | [screenshot-start.png](phase-1/screenshot-start.png) | Đạt |
| Đảo sáng dần khi thắp đèn | Ảnh với `?seed=1&lit=4` so với ảnh 0 đèn | [screenshot-4-lit.png](phase-1/screenshot-4-lit.png) | Đạt |
| Chơi lại sau khi thắng hoặc thua (phím R) | Thử tay trên trình duyệt | (chưa có bằng chứng tự động) | **Chưa kiểm chứng tự động**, cần thử tay |
| Chạy trên macOS/Linux | CI chạy trên ubuntu-latest và macos-latest | [GitHub Actions](../../.github/workflows/ci.yml) | Xem tab Actions |

## Phase 2 (Ticket-02, Contract v1.1)

Acceptance criteria chi tiết, mỗi mục ánh xạ tới một test hoặc bằng chứng, nằm ở [spec-phase2.md](../notes/spec-phase2.md). Chạy lại: `npm test` (35 test) và `bash scripts/proof-phase2.sh`.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Số chuẩn + contract v1.1 | Test so `tuning` với số chuẩn | test `A` | Đạt |
| Thứ tự tick, luật lõi (di chuyển, nhảy, lướt, nhặt, nạp, vùng an toàn, tỏa sáng, Bóng Mực, bị đánh, rơi, thắng/thua, điểm) | 23 test qua CLI | `tests/contract.test.js`, [proof-run.txt](phase-2/proof-run.txt) mục 1 | Đạt |
| Regression Phase 1 với số chuẩn | Các test Phase 1 chạy lại với số chuẩn (đã sửa test nào bị luật mới thay, có ghi lý do) | `tests/contract.test.js` | Đạt |
| Bản đồ chuẩn 3 đêm (đèn, cầu, bục nhảy, tầng, dốc, tháp) | Test vị trí và vật lý | `tests/phase2.test.js` (5 test) | Đạt |
| Gió mạnh Đêm 3 | Test thời điểm và lực đẩy | test `wind` | Đạt |
| Gió Lạc | 4 test | test `drifters: …` | Đạt |
| Bùa Gió | Test nhặt, tốc độ, lướt, hồi | test `charm` | Đạt |
| Tạm dừng (headless) | Test sim_tick, thời gian, lịch sinh đứng yên | test `pause` | Đạt |
| Tính tất định 3 đêm | Chạy 2 lần so từng byte | test `E`, [proof-run.txt](phase-2/proof-run.txt) mục 2 | Đạt |
| Headless 1 đêm ≤ 30 s | Đo thời gian | test `performance`, proof-run mục 3 (0.28–0.45 s) | Đạt |
| ≥ 30 FPS ở 1280×720 | `scripts/fps.mjs`: Chrome thật, khung nhìn 1280×720, 3 đêm, mỗi đêm 10 s | [fps.json](phase-2/fps.json): khoảng 60 FPS trung bình (vsync), Intel UHD 630 | Đạt (đo lúc người chơi đứng yên ở đầu đêm) |
| HUD, bảng màu, 3 đảo hiển thị | Ảnh chụp Chrome headless | [menu](phase-2/screenshot-menu.png), [night1](phase-2/screenshot-night1.png), [night2](phase-2/screenshot-night2.png), [night3](phase-2/screenshot-night3.png) | Đạt (ảnh) |
| Chuỗi 3 Đêm, menu tạm dừng, cài đặt lưu lại, âm thanh | Người làm bài thử tay sau tag `phase-2` (2026-11-20) | Báo cáo thử tay, không có bằng chứng tự động | Đạt (thử tay) |
| Chơi được từ đầu tới thắng với số chuẩn | Bot tham lam (`scripts/bot.js`) | [proof-run.txt](phase-2/proof-run.txt) mục 4 | **Chưa đạt bằng bot**: tốt nhất 3/5 đèn ở Đêm 1, 0–1 đèn ở Đêm 2/3. Luật đã được kiểm chứng bằng test; độ khó do số chuẩn quyết định. Người làm bài thử tay sau tag `phase-2` (2026-11-20) và báo **thắng được khi chơi tay** | Bot: chưa đạt · Thử tay: Đạt |

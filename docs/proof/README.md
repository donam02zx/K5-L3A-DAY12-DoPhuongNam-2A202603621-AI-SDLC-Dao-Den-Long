# Bằng chứng kiểm chứng

Chạy lại ở đúng tag (`git checkout phase-N`):
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

# Spec Phase 2 (Ticket-02, Contract v1.1): acceptance criteria

Mỗi tiêu chí được kiểm chứng bằng **test** (`tests/*.test.js`, chạy qua CLI headless), **ảnh hoặc số đo** (`docs/proof/phase-2/`), hoặc **thử tay**.
Số liệu chuẩn nằm ở `src/core/tuning.js` (TUNING và SPEC). Bản đồ nằm ở `src/core/maps.js`.

## Phần 1: Số liệu chuẩn và thứ tự tick
| # | Acceptance criterion | Kiểm chứng |
|---|---|---|
| 1.1 | `game.contract.json` là v1.1 và `tuning` khớp đúng số chuẩn (gồm các khóa dash và thời lượng Đêm 2/3) | test `A: ...` |
| 1.2 | Chạy 6 m/s, dừng ngay (≤ 0.1 s), xoay theo camera, vector dài hơn 1 được chuẩn hóa | test `C: ...` |
| 1.3 | Nhảy 7 m/s với g = 20, chỉ nhảy khi đang chạm đất | test `jump` |
| 1.4 | Lướt 14 m/s trong 12 tick theo hướng di chuyển, đứng yên thì theo hướng mặt. Hồi chiêu 90 tick tính từ lúc bắt đầu lướt. Lướt trên không giữ độ cao | test `dash` |
| 1.5 | Nhặt khi XZ ≤ 1.0 và chênh cao ≤ 1.5. Mang tối đa 10. Nhặt không có điểm | test `pickup` (2 test) |
| 1.6 | Đầu đêm có 20 đom đóm ở 20 điểm khác nhau. Ở tick 240k sinh thêm 1 nếu dưới 30 | test `spawns` |
| 1.7 | Nạp `min(mang, thiếu)`, +10 cho mỗi đom đóm nạp, đèn nhớ tiến độ. Chọn đèn gần nhất, bằng nhau thì id nhỏ hơn | test `deposit` (2 test) |
| 1.8 | Vùng an toàn 6 m chặn Bóng Mực. Bóng đang ở trong lúc đèn vừa thắp bị đẩy ra trong ≤ 30 tick và vô hại trong lúc đó | test `safe zone` |
| 1.9 | Tỏa sáng: tốn 3, bán kính 3D 5 m tính từ chân + 0.8 m, choáng 120 tick, đẩy 4 m trong 15 tick, +5 mỗi con, hồi chiêu 3 s | test `pulse` (2 test) |
| 1.10 | Bóng Mực phát hiện ở 12 m, bỏ đuổi ở 18 m, tốc độ 4 m/s (Đêm 3: 4.5 m/s). Trạng thái spawning/wander/chase/recoil/stunned | test `shade`, `spawns` |
| 1.11 | Bị đánh: −1 Ngọn Lửa, rơi floor(mang/2) đom đóm ra vành 1.5–2.5 m (sống 480 tick), bất tử 90 tick, Bóng Mực lùi 2 m trong 60 tick | test `hit`, `dropped motes` |
| 1.12 | Rơi khỏi đảo (Y < −10): xảy ra 1 lần kể cả khi bất tử, −1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick, hồi sinh có bất tử. Ngọn Lửa cuối thì thua ngay | test `fall` |
| 1.13 | Lịch sinh Bóng Mực: 2 con ở tick 300, sau đó mỗi 480/420/360 tick, cách người chơi ≥ 15 m, tối đa 6/8/10 | test `spawns` |
| 1.14 | Thứ tự xét kết thúc: no_flames → all_lit (kể cả đúng tick hết giờ) → dawn | test `win on the exact tick`, `no_flames wins` |
| 1.15 | Điểm thưởng khi thắng: floor(giây) × 2 + 50 × Ngọn Lửa | test `win all_lit` |
| 1.16 | Headless một đêm đầy đủ chạy ≤ 30 s | test `performance`, proof-run mục 3 (≤ 0.5 s) |

## Phần 2: Bản đồ chuẩn
| # | Acceptance criterion | Kiểm chứng |
|---|---|---|
| 2.1 | Vị trí và id đèn của 3 đêm khớp ticket | test `maps` |
| 2.2 | Đêm 2: đi từ A sang B qua cầu tre không rơi; bước ra khỏi cầu thì rơi | test `night 2: bamboo bridge` |
| 2.3 | Đêm 2: bục nhảy bắn vy 14 và 24 m/s về phía đảo kia, phím di chuyển không ghi đè, đáp xuống đảo B trong khoảng 1.4 s | test `night 2: bounce pad` |
| 2.4 | Đêm 3: vách tầng chặn người chơi, dốc đưa lên Y=3, bục nhảy ở (0,3,13) đưa lên tầng 2 (Y=6). Tháp chuông không leo được | test `night 3: tier walls…` |
| 2.5 | Đêm 3: cứ 30 s có gió 5 s đẩy 2 m/s, báo trước 2 s (lá bay + chữ trên HUD + âm thanh) | test `wind`. Phần báo trước: ảnh và thử tay |

## Phần 3: Tính năng mới
| # | Tính năng | Acceptance criterion | Kiểm chứng |
|---|---|---|---|
| 3.1 | Gió Lạc: sinh | Chỉ có ở Đêm 2 và 3. Sinh ở tick 1200k, tối đa 2 con, id D1, D2…, bắt đầu ở trạng thái idle | test `drifters: spawn` |
| 3.2 | Gió Lạc: đuổi và cướp | Chuyển sang chase khi Mây mang ≥ 5 và cách ≤ 15 m, mất điều kiện thì về idle. Chạm (XZ ≤ 1.2) thì cướp min(3, mang), chuyển flee 240 tick rồi removed. Mỗi con cướp 1 lần. Bất tử không chặn bị cướp. Cướp xảy ra trước khi Bóng Mực đánh | test `drifters: chase…`, `steal happens before…` |
| 3.3 | Gió Lạc: bị tỏa sáng | Đang chase thì chuyển flee mà không cướp. Đang flee có mang đồ thì `drifter_drop`, thả đom đóm thành loại dropped, biến mất sau 120 tick | test `drifters: pulse…` |
| 3.4 | Bùa Gió | Nhặt như đom đóm, `charm_picked` với 600 tick (nhặt lại thì làm mới). Chạy 7.2 m/s, lướt không hồi chiêu nhưng nhấn khi đang lướt bị bỏ qua. Xuất hiện lại sau 2700 tick. Vị trí theo ticket | test `charm` |
| 3.5 | Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện Bình Minh với tổng điểm. Thua thì chơi lại Đêm đó | Thử tay. Ảnh [menu](../proof/phase-2/screenshot-menu.png) |
| 3.6 | Tạm dừng | Esc/P dừng logic hoàn toàn. Có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Headless: tick vẫn tăng, sim_tick, thời gian và lịch sinh đứng yên, state `paused` | test `pause`. UI: thử tay |
| 3.7 | Cài đặt | Âm lượng và độ nhạy chuột, lưu vào localStorage giữa các lần mở | Thử tay |
| 3.8 | Âm thanh | Nhạc nền đêm. Hiệu ứng cho nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (tổng hợp bằng WebAudio, `src/render/audio.js`) | Thử tay |
| 3.9 | HUD đầy đủ | Ngọn Lửa trên trái. Đồng hồ trên giữa, đỏ và nhấp nháy khi ≤ 30 s. Đèn k/n và điểm trên phải. Thanh 10 ô dưới giữa. Hồi chiêu Lướt/Tỏa sáng dưới phải. Nhắc "E — Nạp ánh sáng (x/10)". Mũi tên chỉ đèn chưa sáng khi đèn ở ngoài màn hình | Ảnh [night1](../proof/phase-2/screenshot-night1.png), [night3](../proof/phase-2/screenshot-night3.png) + thử tay |
| 3.10 | Bảng màu chuẩn | Các thành phần được liệt kê dùng đúng hex của ticket (`PAL` trong `src/render/world.js`, biến CSS trong `index.html`). Ánh sáng môi trường = 0.15 + 0.55 × tỉ lệ đèn sáng | Đọc code + ảnh |
| 3.11 | Hiệu năng | ≥ 30 FPS trung bình ở 1280×720 | `scripts/fps.mjs` → [fps.json](../proof/phase-2/fps.json) (khoảng 60 FPS, bị giới hạn bởi vsync) |

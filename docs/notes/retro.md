# Retro — Đảo Đèn Lồng (Day 12 AI SDLC)

## 1. Đánh giá từng phase

### Phase 1 (PRD-0, contract v1.0)
- **Đạt:** toàn bộ Test Contract v1.0 (23 test qua CLI). Bot tự chơi thắng 5/5 seed. Tính tất định từng byte. Headless chạy cả đêm trong khoảng 0.2 s. Bản 3D có HUD, camera, đảo sáng dần khi thắp đèn.
- **Chưa đạt:** phím R chơi lại ban đầu chỉ được kiểm tra bằng thử tay.
- **Bài học:** tách `src/core` (logic thuần, tất định) ngay từ đầu là quyết định đáng giá nhất. Cả 4 phase sau đó đều chỉ thay lõi, phần hiển thị không phải đập đi làm lại.

### Phase 2 (Ticket-02, v1.1)
- **Đạt:** số chuẩn, 3 bản đồ, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió, tạm dừng. 35 test, mỗi tính năng có scenario riêng. Khoảng 60 FPS ở 1280×720. UI đầy đủ.
- **Chưa đạt:** với số chuẩn, bot tham lam không còn thắng. Người làm bài đã thử tay và thắng được, nhưng đó chỉ là bằng chứng thử tay.
- **Hỏng phase trước?** Không. Các test Phase 1 bị luật mới thay thì được sửa kèm lý do, và bằng chứng gốc vẫn còn ở tag `phase-1`.

### Phase 3 (Ticket-03, v1.2, change request)
- **Đạt:** mô hình dầu đèn (số nguyên 1/60), trạng thái drain, thắng khi sống tới bình minh, sức chứa tăng dần, cách tính điểm mới. 46 test. Có [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) và [CHANGELOG](../../CHANGELOG.md). Có chế độ mù màu.
- **Chưa đạt:** ở tag `phase-3` chưa có ảnh của thanh dầu.
- **Xử lý thay đổi:** 5 test được sửa và 1 test (thắng `all_lit`) bị xóa, lý do ghi ở đầu `tests/contract.test.js`. Không skip test nào.

### Phase 4 (Ticket-04, v1.3, phát hành)
- **Đạt:**
  - [bench.json](../../bench.json): khoảng 103–112 FPS trung bình. `p1_low` dao động từ 29.5 tới 57 giữa các lần chạy, lần cuối là 56.9. Tải trong 0.8 s.
  - [soak.json](../../soak.json): 0 crash, RSS gấp khoảng 1.06–1.11 lần lúc đầu, heap JS 4.4 → 4.7 MB.
  - Bảng xếp hạng lưu trên đĩa, có lệnh export.
  - Đổi phím, phụ đề, giảm chuyển động, chữ lớn. Smoke test UI tự động đạt 9/9.
  - Release dạng web zip.
- **Rủi ro còn lại:**
  - `p1_low_fps` trên GPU tích hợp sát ngưỡng 30 ở một số lần chạy. Máy chấm sẽ quyết định.
  - Bench cần Chrome hoặc Chromium.
  - Lượt bench/soak đầu tiên vượt ngưỡng bộ nhớ (1.24×) do nhiễu khởi động của V8. Mình đã đo heap để chứng minh không có rò rỉ, rồi mới thêm bước chờ GC 1 s trước khi đo. Đây là thay đổi cách đo, không phải sửa số.

## 2. Làm với AI: điều gì hiệu quả, điều gì không
**Hiệu quả**
- **Test chạy qua CLI headless**, đúng như cách giảng viên chấm. Một bộ test vừa là bằng chứng, vừa là lưới an toàn khi ticket đổi luật, và đến cuối có 52 test.
- **Mọi con số nằm ở một chỗ** (`tuning.js`), có test đối chiếu với `game.contract.json`. Vì vậy không thể khai sai số trong contract.
- **Làm lõi trước, UI sau** trong mỗi phase. Phần lõi chiếm 30 điểm test ẩn và được hoàn thành sớm nhất.
- **Script bằng chứng chạy lại được** (`proof-phase*.sh`, `bench.mjs`, `soak.mjs`, `ui-smoke.mjs`, `fps.mjs`) thay vì chụp màn hình rồi viết mô tả.

**Không hiệu quả**
- Bot tham lam: hai lần thử nâng cấp đều không thắng được với số chuẩn. Đáng lẽ nên dừng sớm hơn.
- Sửa file bằng heredoc chứa nhiều dấu nháy thì hay vỡ. Từ Phase 3 chuyển sang ghi script ra file rồi chạy.
- Ảnh chụp bằng Chrome headless không thấy được các chi tiết nhỏ như thanh dầu.

## 3. Những lần AI sai và cách phát hiện
| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Test sai giả định nhiều lần: Bóng Mực trong scenario tự đuổi theo người chơi, Bùa Gió nằm trên cầu, khoảng cách 3D, hai frame trùng tick, thiếu `every: 1`, tính sai điểm | Test đỏ → đọc assertion → lỗi nằm ở test chứ không phải game | Sửa test. Thêm `quiet()` và ghi chú vào AGENTS.md |
| Lỗi thật: tick hồi sinh vẫn bị phím di chuyển đẩy đi | Test `fall` | Sửa trong `sim.js` |
| Đêm 3 xuất phát ở (0,0,0) nằm trong tháp nên rơi ngay | Chạy headless thử rồi đọc sự kiện | Giả định P2-1, ghi để hỏi trợ giảng |
| Đo FPS ra khung nhìn 1262×624 | Đọc output | Ép khung nhìn bằng DevTools |
| Code đổi phím bị chèn nhầm vào trong một handler (thay chuỗi khớp lần xuất hiện đầu tiên) | Smoke test UI đỏ, rồi kiểm tra DOM | Sửa vị trí dấu ngoặc |
| Release zip cố build lại vì tìm thấy vite của repo cha | Chạy thử bản Release | Chỉ build khi có `index.html` nguồn |
| AI định tự ghi "Đạt (thử tay)" thay người làm bài | Hệ thống chặn | Chỉ ghi sau khi người làm bài xác nhận |

## 4. Harness nào giúp nhiều nhất
1. **`npm test` qua CLI + hook Stop** (chặn agent kết thúc khi test đỏ). Đây là thứ bắt được gần như mọi lỗi kể trên.
2. **AGENTS.md** được cập nhật mỗi phase: thứ tự tick, dầu là số nguyên, `protects()`, `quiet()`. Nhờ vậy agent không lặp lại cùng một lỗi.
3. **Skill `verify-phase`**: checklist trước khi gắn tag (test, script bằng chứng, FPS, ảnh, bảng truy vết).
4. **CI** trên Ubuntu và macOS: xác nhận chạy được trên hệ điều hành của giảng viên.

## 5. Token và chi phí (ước tính)
Phân bổ theo [ai-log.md](ai-log.md): CP0 khoảng 40k, Phase 1 khoảng 120k, Phase 2 khoảng 250k, Phase 3 khoảng 120k, Phase 4 khoảng 200k, **tổng khoảng 0.7–0.8 triệu token**. Đây là số ước tính, không có số đo chính xác. Phần lớn là input được cache lại trong cùng phiên. Lab dùng gói Claude theo thuê bao, không trả theo token.

Cách tiết kiệm token:
- Đọc toàn bộ ticket một lần và chốt giả định trước khi viết code.
- Viết code theo khối lớn rồi chạy test ngay, thay vì sửa từng dòng.
- Kiểm chứng bằng script thay vì để agent tự "nhìn".
- Dừng việc chỉnh bot khi không hiệu quả.
- Gom nhiều chỉnh sửa vào một script.

## 6. Số liệu dự án
52 test tự động. Khoảng 25 commit. 4 tag phase. Contract v1.0 → v1.3. 3 bản đồ. Headless chạy cả đêm ≤ 0.5 s. Bench khoảng 105–112 FPS với 200 Bóng Mực. Soak 10 đêm trong 1.4 s, 0 crash.

## 7. Nếu làm lại
- Viết bot có tìm đường và tránh địch ngay từ Phase 1, để luôn có bằng chứng tự động cho "thắng được".
- Thêm smoke test UI qua DevTools từ Phase 2 (ở Phase 4 nó bắt được lỗi ngay lập tức), thay cho thử tay.
- Hỏi trợ giảng sớm về các giả định đánh dấu "nên hỏi", nhất là điểm xuất phát Đêm 3 và thời gian `spawning`.
- Đặt ngân sách token cho mỗi phase và ghi số đo thật thay vì ước tính.

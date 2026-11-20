# Giả định và tiêu chí nghiệm thu

## CP0 (chuẩn bị)
- Stack: Three.js 0.170 + Vite 6, Node >= 20. Lý do: logic JS thuần chạy headless bằng Node không cần cửa sổ; build ra web tĩnh dễ phát hành; giảng viên chạy được trên macOS/Linux.

## Phase 1 (PRD-0, Test Contract v1.0)

Mọi con số nằm ở `src/core/tuning.js` và được copy y nguyên vào `game.contract.json`. Test `A: game.contract.json tuning matches...` sẽ fail nếu hai chỗ lệch nhau.

### Chỗ mơ hồ và giả định của mình
| # | Chỗ mơ hồ trong PRD-0 | Giả định |
|---|---|---|
| 1 | "Mất máu" | Máu = `flames` (3). Mỗi lần bị chạm mất 1 flame, sau đó bất tử `invuln_s` = 1.5 s. Một tick tối đa 1 lần chạm |
| 2 | "Tỏa sáng tốn ánh sáng" | Ánh sáng = đom đóm đang mang. Mỗi lần tỏa sáng tốn `pulse_cost` = 1 đom đóm. Không đủ thì không tỏa sáng và không phát sự kiện. Có cooldown 2 s |
| 3 | Tỏa sáng khi không có Bóng Mực nào trong bán kính | Vẫn tốn ánh sáng và vẫn phát `pulse` với `stunned_ids: []` |
| 4 | Xua Bóng Mực | Bóng Mực trong `pulse_radius` bị choáng 3 s (đứng yên, không gây hại) và bị đẩy ra xa thêm 4 m theo hướng từ người chơi tới nó (nếu trùng vị trí thì đẩy theo +X). Mỗi con bị choáng +25 điểm, kể cả con đang choáng sẵn |
| 5 | "Bóng Mực sợ những chiếc đèn" | Chỉ đèn **đã thắp** mới có vùng an toàn `safe_radius` = 6 m. Bóng Mực bị đẩy ra mép vùng nếu đi vào |
| 6 | Nạp ánh sáng | Nhấn interact trong `interact_radius` (3 m) của đèn chưa thắp gần nhất: nạp `min(đang mang, lantern_cost − đã nạp)`. Đủ `lantern_cost` = 5 thì đèn sáng |
| 7 | Nhặt đom đóm | Tự động khi trong `pickup_radius`, tối đa `carry_capacity` = 5 |
| 8 | Bị chạm thì rơi đom đóm | Rơi `floor(carried × 0.5)`, số rơi biến mất (không rơi xuống đất) |
| 9 | Rơi khỏi đảo | Không có: `fall_enabled = false`, người chơi bị giữ trong bán kính đảo 40 m |
| 10 | Thời lượng đêm / thua | Đêm dài 300 s. Hết giờ thì thua với lý do `dawn`. Hết flames thì thua `no_flames`. Cùng một tick vừa thắp đèn cuối vừa hết máu thì tính **thắng** |
| 11 | Điểm | Đom đóm +10, thắp đèn +100, choáng Bóng Mực +25. Khi **thắng** cộng thêm 2 × số giây còn lại (làm tròn xuống) và 50 × số flames còn lại. Thua thì không có thưởng cuối |
| 12 | Bản đồ Đảo Bến | Đảo tròn bán kính 40 m. 5 đèn trên vòng 25 m, L1 tại (0,0,25), các đèn cách nhau 72° |
| 13 | Đom đóm ngẫu nhiên | Ban đầu 30 con. Khi còn dưới 15 con thì cứ 4 s sinh thêm 1 con (không phát sự kiện vì contract không có sự kiện này) |
| 14 | Bóng Mực ngẫu nhiên | Ban đầu 2 con (S1, S2) ở mép đảo. Cứ 30 s sinh thêm 1 con, tối đa 6 con. Tốc độ 3.5 m/s, chậm hơn người chơi (6 m/s) |
| 15 | Nhảy | Vận tốc nhảy 7 m/s, trọng lực 20 m/s². Nhảy không ảnh hưởng va chạm vì mọi khoảng cách đo trên mặt phẳng XZ theo contract |
| 16 | Tên trạng thái Bóng Mực | `chase` và `stunned` |
| 17 | Thứ tự xử lý trong một tick | timer → di chuyển/nhảy → nhặt → nạp đèn → tỏa sáng → sinh Bóng Mực → Bóng Mực di chuyển → va chạm → sinh đom đóm → đồng hồ và điều kiện kết thúc |
| 18 | `--ticks` vượt quá frame cuối | Giữ nguyên input của frame cuối. Lỗi tham số dòng lệnh cũng trả mã thoát 2 |

### Tiêu chí nghiệm thu (mỗi dòng có test hoặc bằng chứng trong `docs/proof/README.md`)
- Chạy headless ra JSONL đúng định dạng: có snapshot ở tick 0 và mỗi N tick, dòng `end` luôn ở cuối, mã thoát 0.
- Cùng seed, scenario và inputs thì output giống hệt nhau từng byte.
- Mỗi luật ở bảng trên đều có ít nhất một test kiểm tra.
- Bot tự chơi thắng được Đêm 1 với bản đồ mặc định. Người chơi đứng yên thì thua.
- Bản có giao diện chơi được từ đầu tới thắng hoặc thua, và nhấn R để chơi lại.

### Thay đổi so với CP0
- Bỏ `tests/sim.test.js` và `tests/scenarios/hello.json`, vì định dạng headless tạm của CP0 đã được thay bằng Test Contract v1.0. Tính tất định giờ được kiểm tra trong `tests/contract.test.js`.

## Phase 2 (Ticket-02)

## Phase 3 (Ticket-03)

## Phase 4 (Ticket-04)

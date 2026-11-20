# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · Tài liệu lab: [docs/lab/](docs/lab/LAB-README.md) · Bằng chứng: [docs/proof/](docs/proof/README.md)

Game 3D góc nhìn thứ ba. Người chơi là Mây, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng. Mây đi qua **3 Đêm**: Đảo Bến, Đảo Cau (hai đảo nối bằng cầu tre), Đảo Chuông (ba tầng, có gió mạnh). Mỗi đêm Mây gom đom đóm, thắp lại các Đèn Lồng Lớn, né Bóng Mực và Gió Lạc. Thắng Đêm 3 thì tới màn Bình Minh.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node >= 20)

```bash
npm ci
npm run dev        # mở http://localhost:5173
```

## Điều khiển
| Phím | Hành động |
|---|---|
| `W` `A` `S` `D` | Đi (theo hướng camera) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong 2 m) |
| `F` / chuột trái | Tỏa sáng: tốn 3 đom đóm, choáng 2 s và đẩy lùi Bóng Mực trong 5 m |
| Chuột (bấm vào màn hình để khóa chuột) / `←` `→` | Xoay camera |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật chơi (số chuẩn Ticket-02)
- 3 **Ngọn Lửa**, hồi đầy ở đầu mỗi đêm. Bị Bóng Mực chạm thì mất 1, rơi một nửa số đom đóm đang mang ra đất (nhặt lại được trong 8 s), bất tử 1.5 s.
- Rơi khỏi đảo (xuống biển mây) thì mất 1 Ngọn Lửa và toàn bộ đom đóm, rồi hồi sinh ở điểm xuất phát.
- Mang tối đa 10 đom đóm. Mỗi đèn cần 10, nạp được nhiều lần. Đèn đã sáng tạo vùng an toàn 6 m.
- **Gió Lạc** (Đêm 2, 3) cướp 3 đom đóm nếu bạn mang từ 5 con trở lên. Tỏa sáng vào nó để lấy lại.
- **Bùa Gió** (lá bùa đỏ): trong 10 s chạy 7.2 m/s và lướt không cần hồi chiêu.
- Thời lượng mỗi đêm: 5:00 / 5:30 / 6:00. Thắp hết đèn thì thắng. Hết Ngọn Lửa hoặc trời sáng thì thua, và được chơi lại đêm đó.

## Cách tính điểm (chuẩn hóa)
| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 Đèn Lồng Lớn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần) | +5 |
| Khi thắng đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Test Contract v1.1 (headless)
- Khai báo ở [game.contract.json](game.contract.json). `tuning` lấy từ [src/core/tuning.js](src/core/tuning.js), có test đảm bảo hai nơi khớp nhau. Không trường nào là `null`.
- `--night` nhận 1, 2, 3. Trạng thái Bóng Mực: `spawning`, `wander`, `chase`, `recoil`, `stunned`. Gió Lạc: `idle`, `chase`, `flee`, `removed`.
- Giả định cho chỗ ticket chưa nói rõ (ví dụ điểm xuất phát Đêm 3 là (0,0,−20) vì (0,0,0) nằm trong tháp chuông) ở [assumptions.md](docs/notes/assumptions.md).

```bash
node src/headless/cli.js --seed 1 --night 2 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Test và bằng chứng
```bash
npm test                        # 35 test qua CLI headless (luật lõi v1.1 + mỗi tính năng mới có scenario)
bash scripts/proof-phase2.sh    # tính tất định 3 đêm, tốc độ cả đêm, bot, exit code -> docs/proof/phase-2/
node scripts/fps.mjs            # đo FPS ở 1280x720 (cần build + vite preview :4173)
```
Tham số URL: `?auto=1` vào thẳng game, `?night=N`, `?seed=S`, `?lit=K` thắp sẵn K đèn, `?fps=1` hiện FPS.

## Cấu trúc
- `src/core/`: logic game thuần, tất định (`sim.js`, `maps.js` 3 bản đồ chuẩn, `tuning.js` số chuẩn)
- `src/render/`: Three.js (`world.js` dựng đảo), UI và menu (`main.js`), âm thanh tổng hợp WebAudio (`audio.js`)
- `src/headless/cli.js`: entry point cho Test Contract
- `docs/notes/`: [spec Phase 2](docs/notes/spec-phase2.md), [giả định](docs/notes/assumptions.md), [nhật ký AI](docs/notes/ai-log.md), [retro](docs/notes/retro.md)
- Harness AI: [AGENTS.md](AGENTS.md), [.claude/settings.json](.claude/settings.json) (hook chặn agent kết thúc khi test đỏ), [CI](.github/workflows/ci.yml) (Ubuntu và macOS), skill [verify-phase](.claude/skills/verify-phase/SKILL.md)

## Sáng tạo của tôi
- Toàn bộ âm thanh tổng hợp bằng WebAudio (nhạc ngũ cung và hiệu ứng), không dùng file asset.
- Khăn đỏ của Mây, mắt tím của Bóng Mực, dải lụa uốn lượn của Gió Lạc, lá bay báo gió.
- Tất cả chỉ là phần hiển thị và âm thanh (`src/render/`), không đổi đầu ra headless: 35 test qua CLI vẫn đạt.

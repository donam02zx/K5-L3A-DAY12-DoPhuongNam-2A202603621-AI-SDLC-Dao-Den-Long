# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · Tài liệu lab: [docs/lab/](docs/lab/LAB-README.md) · Bằng chứng: [docs/proof/](docs/proof/README.md)

Game 3D góc nhìn thứ ba. Người chơi là Mây, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng. Mây chạy khắp Đảo Bến gom đom đóm, mang về thắp lại 5 Đèn Lồng Lớn, và né Bóng Mực trong sương đen. Thắp hết 5 đèn trước bình minh thì thắng.

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
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong 3 m) |
| `F` / chuột trái | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| `←` `→` / giữ chuột phải kéo | Xoay camera |
| `R` | Chơi lại (sau khi thắng hoặc thua) |

## Luật chơi
- Mây có 3 **flames** (máu). Bị Bóng Mực chạm thì mất 1 flame, rơi một nửa số đom đóm đang mang, rồi được bất tử 1.5 giây.
- Mang tối đa 5 đom đóm. Mỗi đèn cần 5 đom đóm để sáng. Đèn đã thắp tạo vùng an toàn bán kính 6 m mà Bóng Mực không vào được.
- Thắng khi thắp đủ 5 đèn. Thua khi hết flames, hoặc khi đêm (5 phút) kết thúc.

## Cách tính điểm
| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 Đèn Lồng Lớn | +100 |
| Làm choáng 1 Bóng Mực | +25 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi flame còn lại | +50 |

Thua thì giữ nguyên điểm đã có, không được thưởng cuối màn. Đèn được đặt sẵn là đã thắp trong scenario thì không tính điểm.

## Test Contract v1.0 (headless)
- Khai báo ở [game.contract.json](game.contract.json). Các con số `tuning` lấy từ [src/core/tuning.js](src/core/tuning.js), có test đảm bảo hai nơi luôn khớp nhau.
- Mọi khái niệm trong `tuning` đều có trong game, không trường nào là `null`. `fall_enabled = false` vì Mây không thể rơi khỏi đảo (bị giữ trong bán kính 40 m), nên không có sự kiện `player_hit` với `by: "fall"`.
- Trạng thái Bóng Mực: `chase`, `stunned`.

```bash
node src/headless/cli.js --seed 1 --night 1 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Test và bằng chứng
```bash
npm test                        # 23 test contract, chạy qua CLI headless
bash scripts/proof-phase1.sh    # bot chơi hết màn, kiểm tra tính tất định, exit code, tốc độ -> docs/proof/phase-1/
node scripts/bot.js 1 bot.json  # bot tham lam chơi Đêm 1 và xuất file inputs
```
Tham số URL khi chơi trên trình duyệt (dùng để chụp ảnh bằng chứng): `?seed=N` cố định seed, `?lit=N` thắp sẵn N đèn.

## Cấu trúc
- `src/core/`: logic game thuần, tất định, không phụ thuộc DOM hay three.js
- `src/render/`: phần hiển thị Three.js. Chỉ đọc state, mỗi tick gọi `step()` một lần như headless
- `src/headless/cli.js`: entry point cho Test Contract
- `docs/notes/`: [giả định](docs/notes/assumptions.md), [nhật ký AI](docs/notes/ai-log.md), [retro](docs/notes/retro.md)
- Harness AI: [AGENTS.md](AGENTS.md), [.claude/settings.json](.claude/settings.json) (hook chặn agent kết thúc khi test đỏ), [CI](.github/workflows/ci.yml) (Ubuntu và macOS)

## Sáng tạo của tôi
_(Phase 1 ưu tiên phần lõi; mục này sẽ cập nhật ở các phase sau.)_

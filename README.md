# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · Tài liệu lab: [docs/lab/](docs/lab/LAB-README.md)

Game 3D góc nhìn thứ ba. Người chơi điều khiển Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

## Cài đặt và chạy

```bash
npm ci
npm run dev        # mở http://localhost:5173
```

## Điều khiển
- `W` `A` `S` `D`: di chuyển

## Test và chế độ headless

```bash
npm test                                            # unit test + kiểm tra tính tất định
npm run headless -- tests/scenarios/hello.json      # in trạng thái cuối ra dạng JSON
```

## Cấu trúc
- `src/core/`: logic game thuần, chạy được không cần cửa sổ
- `src/render/`: phần hiển thị Three.js
- `src/headless/`: entry point cho Test Contract
- `docs/notes/`: giả định, nhật ký AI, retro · `docs/proof/`: bằng chứng
- Harness AI: [AGENTS.md](AGENTS.md), [.claude/settings.json](.claude/settings.json) (hook chặn kết thúc khi test đỏ), [CI](.github/workflows/ci.yml)

## Sáng tạo của tôi
_(sẽ cập nhật)_

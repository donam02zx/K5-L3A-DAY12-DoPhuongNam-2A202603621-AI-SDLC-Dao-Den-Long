# Bằng chứng kiểm chứng

Mỗi dòng là một yêu cầu. Chạy lại bằng chứng ở đúng tag phase tương ứng (`git checkout phase-N`).

| Phase | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| CP0 | Logic tất định (cùng đầu vào, cùng đầu ra) | `npm test`: chạy CLI headless hai lần rồi so sánh | [tests/sim.test.js](../../tests/sim.test.js), [cp0-test.txt](cp0-test.txt) | Đạt |

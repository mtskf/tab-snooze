# TODO

- [x] グループ復元の部分失敗検知はまだ未対応です。chrome.windows.create({ url: [...] }) が一部URLを開けない場合でも、全タブを「復元成功」として削除している。snoozeLogic.js (lines 601-613) / snoozeLogic.js (lines 650-656)

- [ ] Medium: chrome.windows.create の戻り tabs.length で判定していますが、MV3の戻りに tabs が含まれない環境があります（既定で返らないことが多い）。その場合でも「部分失敗」と誤判定し、復元成功でも全タブを残す挙動になります（重複復元が発生）。snoozeLogic.js (lines 604-612)
// Тестовый скрипт: docker compose exec filemanager node src/test_ai_extract.js
const fileTextExtract = require("./fileTextExtract");
const aiExtract = require("./aiExtract");

const SAMPLE_TEXT = `
ОПРЕДЕЛЕНИЕ
Арбитражный суд Калужской области
Дело № А23-4670/2024
Судья: Иванова Е.В.
Назначить судебную строительно-техническую экспертизу.
`;

async function main() {
  console.log("Отправляю тестовый текст в OmniRoute (" + (process.env.OMNIROUTE_URL || "http://omniroute:20129") + ")...");
  const result = await aiExtract.analyzeDocument({ kind: "text", text: SAMPLE_TEXT }, "test.txt");
  console.log("Результат:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("ОШИБКА:", err.message);
  process.exit(1);
});

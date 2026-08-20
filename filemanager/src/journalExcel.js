const ExcelJS = require("exceljs");
const db = require("./db");
const files = require("./files");

const JOURNAL_DIR = "/Дела/Журнал регистрации";
const JOURNAL_PATH = `${JOURNAL_DIR}/Журнал регистрации.xlsx`;

const TYPE_LABEL = { expertise: "Экспертизы", research: "Независимые исследования" };
const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль" };

const HEADERS = [
  "Стадия", "Структура", "Условное наименование", "Тип проекта", "Год начала проекта",
  "Описание", "Руководитель проекта", "Специалисты/Эксперты", "Заказчик", "№ дела или договора",
];
const COURT_GROUP_HEADERS = ["Сторона 1", "Сторона 2", "Судья"];
const COLUMN_WIDTHS = [12, 26, 30, 20, 12, 34, 22, 24, 26, 18, 22, 22, 20];

/** Стадия для отображения — для архива это "Завершён"/"Отменён", а не техническая стадия. */
function stageLabelFor(row) {
  if (row.is_cancelled) return "Отменён";
  if (row.stage === "done") return "Завершён";
  return STAGE_LABEL[row.stage] || row.stage;
}

function rowToValues(row) {
  return [
    stageLabelFor(row),
    row.organization || "",
    row.name || "",
    TYPE_LABEL[row.type] || row.type || "",
    row.year || "",
    row.description || "",
    row.manager_name || "",
    row.experts || "",
    row.court_or_customer || "",
    row.case_number || "",
    row.party1 || "",
    row.party2 || "",
    row.judge_name || "",
  ];
}

function buildSheet(workbook, sheetName, rows) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 2 }] });

  // Заголовки: первые 10 колонок — простые (растянуты на 2 строки высоты),
  // последние 3 — под общим заголовком-группой "Поля судебных экспертиз".
  HEADERS.forEach((title, i) => {
    const col = i + 1;
    sheet.mergeCells(1, col, 2, col);
    const cell = sheet.getCell(1, col);
    cell.value = title;
  });
  sheet.mergeCells(1, 11, 1, 13);
  sheet.getCell(1, 11).value = "Поля судебных экспертиз";
  COURT_GROUP_HEADERS.forEach((title, i) => {
    sheet.getCell(2, 11 + i).value = title;
  });

  for (let c = 1; c <= 13; c++) {
    const cell = sheet.getCell(1, c);
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FD" } };
  }
  const groupSubCell = sheet.getRow(2);
  for (let c = 11; c <= 13; c++) {
    groupSubCell.getCell(c).font = { bold: true };
    groupSubCell.getCell(c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    groupSubCell.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FD" } };
  }

  sheet.columns.forEach((col, i) => { col.width = COLUMN_WIDTHS[i]; });

  rows.forEach((row) => {
    const values = rowToValues(row);
    const excelRow = sheet.addRow(values);
    excelRow.alignment = { vertical: "top", wrapText: true };
  });

  return sheet;
}

/**
 * Пересобирает журнал регистрации с нуля из текущего состояния базы —
 * вызывается после любого изменения проекта (создание, смена стадии,
 * отмена, редактирование), поэтому файл всегда отражает актуальные
 * данные без ручного участия.
 */
async function regenerateJournal() {
  const { rows } = await db.query(`
    SELECT c.*, u.username AS manager_name
    FROM cases c
    LEFT JOIN users u ON u.id = c.manager_id
    ORDER BY c.created_at ASC
  `);

  const current = rows.filter((r) => !r.is_cancelled && r.stage !== "done");
  const archive = rows.filter((r) => r.is_cancelled || r.stage === "done");

  const workbook = new ExcelJS.Workbook();
  buildSheet(workbook, "ТЕКУЩИЕ", current);
  buildSheet(workbook, "АРХИВ", archive);

  const dirAbs = files.absolutePathFor(JOURNAL_DIR);
  await require("fs").promises.mkdir(dirAbs, { recursive: true });
  const fileAbs = files.absolutePathFor(JOURNAL_PATH);
  await workbook.xlsx.writeFile(fileAbs);
}

module.exports = { regenerateJournal, JOURNAL_PATH, JOURNAL_DIR };

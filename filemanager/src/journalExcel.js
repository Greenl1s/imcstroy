const ExcelJS = require("exceljs");
const files = require("./files");

const JOURNAL_DIR = "/Дела/Журнал регистрации";
const JOURNAL_PATH = `${JOURNAL_DIR}/Журнал регистрации.xlsx`;

const TYPE_LABEL = { expertise: "Экспертизы", research: "Независимые исследования" };
const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль" };

const HEADERS = [
  "Стадия", "Структура", "Условное наименование", "Тип проекта", "Тип экспертизы", "Год начала проекта",
  "Описание", "Руководитель проекта", "Специалисты/Эксперты", "Заказчик", "№ дела или договора",
];
const COURT_GROUP_HEADERS = ["Сторона 1", "Сторона 2", "Судья"];
const COLUMN_WIDTHS = [12, 26, 30, 20, 24, 12, 34, 22, 24, 26, 18, 22, 22, 20];

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
    row.expertise_type || "",
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
  sheet.mergeCells(1, 12, 1, 14);
  sheet.getCell(1, 12).value = "Поля судебных экспертиз";
  COURT_GROUP_HEADERS.forEach((title, i) => {
    sheet.getCell(2, 12 + i).value = title;
  });

  for (let c = 1; c <= 14; c++) {
    const cell = sheet.getCell(1, c);
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FD" } };
  }
  const groupSubCell = sheet.getRow(2);
  for (let c = 12; c <= 14; c++) {
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
 * Собирает книгу из готовых листов: [{ name, rows }].
 *
 * Вынесено отдельно, потому что книга нужна в двух местах: файл на диске,
 * который пересобирается сам после каждого изменения, и выгрузка с экрана
 * журнала. Раз колонки, заголовки и оформление одни и те же, то и код
 * должен быть один — иначе выгрузка с экрана и файл в папке однажды
 * разъедутся, и никто не поймёт, какой из них правильный.
 */
function buildWorkbook(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const { name, rows } of sheets) buildSheet(workbook, name, rows);
  return workbook;
}

/** Разделение на листы — то же правило, что и в интерфейсе журнала. */
const isArchive = (row) => row.is_cancelled || row.stage === "done";

/**
 * Убирает прежнюю файловую копию журнала из «Дел».
 *
 * Журнал теперь является отдельным разделом интерфейса, а Excel при
 * необходимости скачивается кнопкой из этого раздела. Удаляем только
 * созданный системой файл. Если человек положил в папку что-то ещё,
 * эти файлы остаются целыми и сама папка не удаляется.
 */
async function removeStoredJournal() {
  const fs = require("fs");
  try { await fs.promises.unlink(files.absolutePathFor(JOURNAL_PATH)); }
  catch (err) { if (err.code !== "ENOENT") throw err; }
  try { await fs.promises.rmdir(files.absolutePathFor(JOURNAL_DIR)); }
  catch (err) {
    if (err.code !== "ENOENT" && err.code !== "ENOTEMPTY") throw err;
  }
}

/** Старые вызовы обновления оставлены совместимыми, но больше не создают файл. */
async function regenerateJournal() {
  await removeStoredJournal();
}

module.exports = {
  regenerateJournal, buildWorkbook, isArchive, HEADERS, COURT_GROUP_HEADERS,
  removeStoredJournal, JOURNAL_PATH, JOURNAL_DIR,
};

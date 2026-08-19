const files = require("./files");
const { CASES_ROOT } = require("./folderAccess");

/**
 * Соответствие стадии — корневой папке внутри "Дела". Названия скопированы
 * буквально с реального Яндекс.Диска (без пробела после точки в номере,
 * "Завершенные"/"Отмененные" без "ё") — это не опечатка, а точное
 * соответствие тому, что уже привычно и используется в работе.
 */
const STAGE_ROOT_NAME = {
  plan: "01.Планы",
  active: "02.Активные проекты",
  control: "03.Проекты на контроле",
  done: "04.Архив/Завершенные",
};
const CANCELLED_ROOT_NAME = "04.Архив/Отмененные";

/** Абсолютный (от корня "Дела") путь до корневой папки данной стадии. */
function stageRootPath(stage) {
  const name = STAGE_ROOT_NAME[stage];
  if (!name) throw new Error(`Неизвестная стадия: ${stage}`);
  return `${CASES_ROOT}/${name}`;
}

function cancelledRootPath() {
  return `${CASES_ROOT}/${CANCELLED_ROOT_NAME}`;
}

/**
 * Создаёт структуру папок нового проекта — строго по разделу 9.2
 * инструкции. Два сценария:
 *
 *   directAssignment = false (обычный запрос, стадия "План"):
 *     {name}/
 *     ├── Планирование проекта/
 *     │   ├── Запрос/
 *     │   ├── Первичные материалы для ознакомления/
 *     │   └── ГП/
 *     └── {name}/
 *         ├── Материалы/
 *         ├── Организационные документы/
 *         └── Заключение/
 *
 *   directAssignment = true (прямое назначение суда, сразу стадия "Активный"):
 *     {name}/
 *     ├── Планирование проекта/        (для файла определения о назначении — без вложенных подпапок)
 *     └── {name}/
 *         ├── Материалы/
 *         ├── Организационные документы/
 *         └── Заключение/
 *
 * Возвращает путь до корневой папки проекта (от "Дела").
 */
async function createCaseFolders({ name, stage, directAssignment }) {
  const rootPath = `${stageRootPath(stage)}/${name}`;

  const planningPath = `${rootPath}/Планирование проекта`;
  if (directAssignment) {
    await files.ensureDir(planningPath);
  } else {
    await files.ensureDir(`${planningPath}/Запрос`);
    await files.ensureDir(`${planningPath}/Первичные материалы для ознакомления`);
    await files.ensureDir(`${planningPath}/ГП`);
  }

  const mainPath = `${rootPath}/${name}`;
  await files.ensureDir(`${mainPath}/Материалы`);
  await files.ensureDir(`${mainPath}/Организационные документы`);
  await files.ensureDir(`${mainPath}/Заключение`);

  return rootPath;
}

module.exports = {
  STAGE_ROOT_NAME,
  CANCELLED_ROOT_NAME,
  stageRootPath,
  cancelledRootPath,
  createCaseFolders,
};

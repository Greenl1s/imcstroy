#!/usr/bin/env node
/**
 * Разовый перенос фотографий приборов из базы в папки.
 *
 * Раньше фото прибора и скан документа хранились байтами прямо в базе
 * («Учёт», таблицы instrument_photos и instrument_documents). Теперь у
 * каждого прибора есть своя папка в файловом менеджере, и файлам место
 * там: их видно, их можно скачать, переслать, положить рядом ещё один
 * снимок. Держать те же байты вторым экземпляром в базе незачем — две
 * копии однажды разойдутся, и будет непонятно, какая настоящая.
 *
 * Скрипт выкладывает каждое фото файлом в папку прибора и переставляет
 * карточку на ссылку. Байты из базы удаляет только после того, как файл
 * действительно записан и прочитан обратно.
 *
 * ЗАПУСК — вручную, на боевом сервере, из контейнера filemanager:
 *
 *   # сначала вхолостую: ничего не меняет, только показывает план
 *   docker compose exec filemanager node scripts/photos-to-folders.js
 *
 *   # и только потом по-настоящему
 *   docker compose exec filemanager node scripts/photos-to-folders.js --apply
 *
 * Почему не в миграции и не при запуске: это перекладывание сотен
 * мегабайт на боевых данных. Такое должно происходить, когда человек
 * решил и смотрит на результат, а не само по себе при обновлении.
 */

const path = require("path");
const fs = require("fs");
const db = require("../src/db");
const files = require("../src/files");
const equipment = require("../src/equipment");

const APPLY = process.argv.includes("--apply");

/** Расширение по типу файла: mime → то, что человек ожидает увидеть. */
const EXT = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
  "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic",
  "application/pdf": ".pdf",
};

async function main() {
  console.log(APPLY
    ? "Перенос фотографий из базы в папки приборов."
    : "ПРОГОН ВХОЛОСТУЮ: ничего не меняется, показан только план.\n" +
      "Чтобы выполнить перенос, добавьте --apply.");
  console.log("");

  // Сначала раскладка: если папок ещё нет, класть некуда.
  const report = await equipment.sync();
  if (report.created.length) console.log(`Заведено папок: ${report.created.length}`);
  if (report.moved.length) console.log(`Перенесено папок: ${report.moved.length}`);

  const stats = { photos: 0, documents: 0, skipped: 0, failed: 0, bytes: 0 };

  for (const kind of ["photo", "document"]) {
    const table = kind === "photo" ? "instrument_photos" : "instrument_documents";
    const column = kind === "photo" ? "photo_link_path" : "document_link_path";
    const sub = kind === "photo" ? equipment.IMAGES_DIRNAME : equipment.DOCS_DIRNAME;

    const { rows } = await db.query(
      `SELECT p.instrument_id, p.mime_type, p.size_bytes, i.name, i.inventory_no,
              i.folder_path, i.${column} AS link
         FROM ${table} p
         JOIN instruments i ON i.id = p.instrument_id
        ORDER BY p.instrument_id`
    );

    for (const row of rows) {
      const label = `${row.inventory_no || "#" + row.instrument_id} — ${row.name}`;

      if (row.link) {
        // Ссылка уже есть — значит фото давно лежит файлом, а строка
        // в базе осталась от старых времён. Трогать её не будем: пусть
        // это решит человек, посмотрев на список.
        console.log(`  · ${label}: уже есть файл, байты в базе оставлены`);
        stats.skipped += 1;
        continue;
      }
      if (!row.folder_path) {
        console.log(`  ! ${label}: нет папки — пропущен`);
        stats.skipped += 1;
        continue;
      }

      const ext = EXT[row.mime_type] || ".bin";
      const base = kind === "photo" ? "Фото прибора" : "Документ поверки";
      const rel = `${row.folder_path}/${sub}/${base}${ext}`;

      if (!APPLY) {
        console.log(`  → ${label}: ${prettySize(row.size_bytes)} → ${rel}`);
        stats[kind === "photo" ? "photos" : "documents"] += 1;
        stats.bytes += Number(row.size_bytes || 0);
        continue;
      }

      try {
        const { rows: data } = await db.query(
          `SELECT bytes FROM ${table} WHERE instrument_id = $1`, [row.instrument_id]);
        const buffer = data[0].bytes;

        await files.ensureDir(`${row.folder_path}/${sub}`);
        const abs = files.safeResolve(rel);
        await fs.promises.writeFile(abs, buffer);

        // Проверяем, что файл действительно записан и того же размера, —
        // и только тогда убираем байты из базы. Обратного пути нет.
        const stat = await fs.promises.stat(abs);
        if (stat.size !== buffer.length) throw new Error("размер записанного файла не совпал");

        await db.query(`UPDATE instruments SET ${column} = $1 WHERE id = $2`,
          [rel, row.instrument_id]);
        await db.query(`DELETE FROM ${table} WHERE instrument_id = $1`, [row.instrument_id]);

        console.log(`  ✓ ${label}: ${prettySize(stat.size)} → ${rel}`);
        stats[kind === "photo" ? "photos" : "documents"] += 1;
        stats.bytes += stat.size;
      } catch (err) {
        // Одна неудача не должна останавливать остальные: прибор с
        // испорченным именем не повод бросать перенос на середине.
        console.error(`  ✗ ${label}: ${err.message}`);
        stats.failed += 1;
      }
    }
  }

  console.log("");
  console.log(`Фотографий: ${stats.photos}, документов: ${stats.documents}, ` +
    `пропущено: ${stats.skipped}, с ошибкой: ${stats.failed}`);
  console.log(`Объём: ${prettySize(stats.bytes)}`);
  if (!APPLY) console.log("\nЭто был прогон вхолостую. Повторите с --apply.");
  else console.log("\nГотово. Фото теперь лежат файлами, база разгружена.");
}

function prettySize(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Перенос не выполнен:", err.message);
    process.exit(1);
  });

// ============================================================
// Единый вход (SSO): переносит права доступа из fm_users (база ИСУ)
// в fm_permissions, сопоставляя пользователей по логину с users
// (база "Учёта оборудования"). Пароли из fm_users НЕ переносятся —
// они больше не нужны: единственный источник паролей теперь
// "Учёт оборудования".
//
// БЕЗОПАСНЫЙ РЕЖИМ ПО УМОЛЧАНИЮ: скрипт ничего не меняет, только
// показывает, что бы он сделал. Чтобы реально применить изменения,
// запустите с APPLY=1.
//
// Использование:
//   SOURCE_DATABASE_URL=postgres://...   (база ИСУ, где живут fm_users/fm_folder_permissions)
//   TARGET_DATABASE_URL=postgres://...   (база "Учёта оборудования", где живёт users)
//   node migrate-users.mjs                  — сухой прогон (ничего не меняет)
//   APPLY=1 node migrate-users.mjs          — реальное применение
// ============================================================

import pg from 'pg';

const APPLY = process.env.APPLY === '1';

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error('Укажите SOURCE_DATABASE_URL (база ИСУ) и TARGET_DATABASE_URL (база "Учёта оборудования")');
  process.exit(1);
}

const source = new pg.Pool({ connectionString: sourceUrl });
const target = new pg.Pool({ connectionString: targetUrl });

async function main() {
  console.log(APPLY ? '=== РЕЖИМ ПРИМЕНЕНИЯ (изменения будут сохранены) ===' : '=== СУХОЙ ПРОГОН (ничего не меняется) ===');
  console.log();

  const fmUsers = (await source.query('SELECT * FROM fm_users ORDER BY id')).rows;
  console.log(`Пользователей ИСУ (fm_users): ${fmUsers.length}`);

  const matched = [];   // { fmId, targetId, username, can_tools, can_db, can_cases }
  const unmatched = []; // логины, для которых нет пары в "Учёте оборудования"

  for (const fu of fmUsers) {
    const { rows } = await target.query(
      'SELECT id, username FROM users WHERE lower(username) = lower($1)',
      [fu.username]
    );
    if (rows.length) {
      matched.push({
        fmId: fu.id,
        targetId: rows[0].id,
        username: fu.username,
        can_tools: fu.can_tools,
        can_db: fu.can_db,
        can_cases: fu.can_cases,
      });
    } else {
      unmatched.push(fu.username);
    }
  }

  console.log(`Сопоставлено с "Учётом оборудования": ${matched.length}`);
  for (const m of matched) {
    console.log(`  ИСУ #${m.fmId} "${m.username}"  ->  Учёт оборудования #${m.targetId}`);
  }

  if (unmatched.length) {
    console.log();
    console.log(`⚠ НЕ НАЙДЕНО в "Учёте оборудования" (${unmatched.length}) — создайте им аккаунты там вручную и запустите скрипт ещё раз:`);
    for (const u of unmatched) console.log(`  - ${u}`);

    const unmatchedIds = fmUsers.filter((fu) => unmatched.includes(fu.username)).map((fu) => fu.id);
    if (unmatchedIds.length) {
      const { rows: orphanRows } = await source.query(
        'SELECT path, access FROM fm_folder_permissions WHERE user_id = ANY($1::int[])',
        [unmatchedIds]
      );
      if (orphanRows.length) {
        console.log();
        console.log(`⚠ У несопоставленных пользователей есть персональные права на папки — они будут УДАЛЕНЫ (${orphanRows.length}):`);
        for (const r of orphanRows) console.log(`  - ${r.path} (${r.access})`);
        console.log('  Если это важно — сначала создайте аккаунт этому человеку в "Учёте оборудования" и запустите скрипт заново.');
      }
    }
  }

  console.log();
  console.log('Что будет сделано:');
  console.log(`  1. В базе ИСУ создана/обновлена таблица fm_permissions — ${matched.length} строк`);
  console.log(`  2. Права на папки/файлы (fm_folder_permissions.user_id) перевешаны на новые id — для ${matched.length} пользователей`);
  console.log(`  3. Таблица fm_users переименована в fm_users_old (не удаляется, как подстраховка)`);

  if (!APPLY) {
    console.log();
    console.log('Это был сухой прогон. Чтобы применить по-настоящему, запустите с APPLY=1.');
    await source.end();
    await target.end();
    return;
  }

  console.log();
  console.log('Применяю изменения...');

  const client = await source.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS fm_permissions (
        user_id INTEGER PRIMARY KEY,
        can_tools BOOLEAN NOT NULL DEFAULT false,
        can_db BOOLEAN NOT NULL DEFAULT false,
        can_cases BOOLEAN NOT NULL DEFAULT false
      );
    `);

    for (const m of matched) {
      await client.query(
        `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           can_tools = EXCLUDED.can_tools, can_db = EXCLUDED.can_db, can_cases = EXCLUDED.can_cases`,
        [m.targetId, !!m.can_tools, !!m.can_db, !!m.can_cases]
      );
    }

    // Перевешиваем права на конкретные папки/файлы в "Дела" на новые id.
    await client.query(`ALTER TABLE fm_folder_permissions ADD COLUMN IF NOT EXISTS new_user_id INTEGER;`);
    for (const m of matched) {
      await client.query(
        `UPDATE fm_folder_permissions SET new_user_id = $2 WHERE user_id = $1`,
        [m.fmId, m.targetId]
      );
    }
    // Если остались непронумерованные (пользователь не сопоставлен) — не трогаем их
    // старый user_id, просто оставляем как есть в резервной копии; такие строки
    // в fm_folder_permissions с NULL new_user_id ниже не переносим.
    await client.query(`DELETE FROM fm_folder_permissions WHERE new_user_id IS NULL;`);
    await client.query(`ALTER TABLE fm_folder_permissions DROP COLUMN user_id;`);
    await client.query(`ALTER TABLE fm_folder_permissions RENAME COLUMN new_user_id TO user_id;`);
    await client.query(`ALTER TABLE fm_folder_permissions ALTER COLUMN user_id SET NOT NULL;`);

    await client.query(`ALTER TABLE fm_users RENAME TO fm_users_old;`);

    await client.query('COMMIT');
    console.log('Готово. Таблица fm_users переименована в fm_users_old.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка, всё откачено:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await source.end();
  await target.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

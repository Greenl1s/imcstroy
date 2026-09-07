#!/bin/bash
# ============================================================
#  Разворачивается ли база С НУЛЯ.
#
#  Docker выполняет всё из db/ ровно один раз — при первом запуске
#  на пустом томе, по алфавиту имён файлов. Значит именно так и надо
#  проверять: пустая база, файлы по порядку, ON_ERROR_STOP.
#
#  Это не формальность. Если db/ не разворачивается, проект нельзя
#  поднять на новой машине — а это ровно та минута, когда всё горит:
#  переезд, авария, восстановление.
#
#  Дополнительно сверяем результат с эталонной базой: мало развернуться
#  без ошибок, надо получить ТУ ЖЕ схему, на которой работает код.
#
#  Запуск:
#    sh test/db-fresh.test.sh
#    ETALON=uchet sh test/db-fresh.test.sh     # с чем сверять
# ============================================================

# Без set -e: проверки должны идти до конца, даже если одна не прошла —
# иначе видно только первую поломку, а хочется весь список сразу.
DB_DIR="$(dirname "$0")/../db"
PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-5433} -U ${PGUSER:-pribory}"
FRESH=db_fresh_check
ETALON=${ETALON:-uchet}

pass=0
fail=0
say() { # say <ок?> <текст>
  if [ "$1" = "0" ]; then echo "PASS $2"; pass=$((pass+1)); else echo "FAIL $2"; fail=$((fail+1)); fi
}

$PSQL -d postgres -q -c "DROP DATABASE IF EXISTS $FRESH" -c "CREATE DATABASE $FRESH" 2>/dev/null

echo "--- применяем db/ по алфавиту, как это делает docker ---"
broken=""
for f in $(ls "$DB_DIR"/*.sql | LC_ALL=C sort); do
  if $PSQL -d $FRESH -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>/tmp/db-fresh-err.txt; then
    :
  else
    echo "    ❌ $(basename "$f"): $(grep ERROR /tmp/db-fresh-err.txt | head -1)"
    broken="$broken $(basename "$f")"
  fi
done
[ -z "$broken" ]; say $? "все файлы из db/ применяются на пустой базе${broken:+ (упали:$broken)}"

# Порядок не должен зависеть от языковых настроек машины: docker сортирует
# файлы средствами шелла, а тот — по локали контейнера.
if diff -q "$(ls "$DB_DIR"/*.sql | LC_ALL=C sort | tr '\n' ' ' > /tmp/order-c.txt; echo /tmp/order-c.txt)" \
           "$(ls "$DB_DIR"/*.sql | LC_ALL=en_US.UTF-8 sort 2>/dev/null | tr '\n' ' ' > /tmp/order-u.txt; echo /tmp/order-u.txt)" >/dev/null; then
  say 0 "порядок файлов одинаков в разных языковых настройках"
else
  say 1 "порядок файлов одинаков в разных языковых настройках"
fi

echo "--- сверяем схему с эталонной базой «$ETALON» ---"
dump_cols() {
  $PSQL -d "$1" -tAc "SELECT table_name||'.'||column_name||':'||data_type
                        FROM information_schema.columns
                       WHERE table_schema='public' ORDER BY table_name, column_name" | sort
}
dump_cons() {
  $PSQL -d "$1" -tAc "SELECT c.relname || ' | ' || con.conname || ' | ' || con.contype::text
                        FROM pg_constraint con
                        JOIN pg_class c ON c.oid = con.conrelid
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                       WHERE n.nspname = 'public'" | sort
}
dump_view() {
  $PSQL -d "$1" -tAc "SELECT ordinal_position||' '||column_name FROM information_schema.columns
                       WHERE table_name='instruments_view' ORDER BY ordinal_position"
}

diff <(dump_cols $ETALON) <(dump_cols $FRESH) > /tmp/diff-cols.txt
say $? "таблицы и колонки совпадают с эталоном$( [ -s /tmp/diff-cols.txt ] && echo ' (см. /tmp/diff-cols.txt)')"

diff <(dump_cons $ETALON) <(dump_cons $FRESH) > /tmp/diff-cons.txt
say $? "ключи и ограничения совпадают$( [ -s /tmp/diff-cons.txt ] && echo ' (см. /tmp/diff-cons.txt)')"

diff <(dump_view $ETALON) <(dump_view $FRESH) > /tmp/diff-view.txt
say $? "порядок колонок в instruments_view совпадает"

# Точечные проверки того, что чинили.
has() { [ -n "$($PSQL -d $FRESH -tAc "$1")" ]; }

if has "SELECT 1 FROM information_schema.columns
         WHERE table_name='instruments' AND column_name='document_url'"
then say 1 "колонки-призрака document_url в схеме быть не должно"
else say 0 "колонки-призрака document_url в схеме нет"
fi

if has "SELECT 1 FROM pg_constraint
         WHERE conrelid='fm_permissions'::regclass AND contype='f'"
then say 0 "у fm_permissions есть внешний ключ на users"
else say 1 "у fm_permissions есть внешний ключ на users"
fi

if has "SELECT 1 FROM information_schema.columns
         WHERE table_name='cases' AND column_name='organization'"
then say 0 "поля журнала регистрации у cases на месте"
else say 1 "поля журнала регистрации у cases на месте"
fi

$PSQL -d postgres -q -c "DROP DATABASE IF EXISTS $FRESH" 2>/dev/null

echo
echo "$pass/$((pass+fail)) passed"
[ "$fail" -eq 0 ]

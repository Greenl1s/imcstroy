# Оформление ИСУ — НИЦ «Строительство»

Пакет переносит согласованный визуальный стиль в существующую ИСУ: синюю палитру,
тёмную боковую панель, эмблему, значок вкладки, светлые карточки, таблицы и формы.
Профиль перемещается вниз боковой панели. На главной добавляется заголовок.
Данные, набор разделов и содержимое карточек остаются из рабочей системы.
Демонстрационные записи и дополнительные блоки макета не устанавливаются.

Не копируйте index.html или preview.js из макета поверх ИСУ: это демонстрация.
Установщик из этого архива изменяет текущий index.html, сохраняя скрипты и ID
элементов. При несовместимой структуре HTML он прекращает установку до записи.

## Windows — PowerShell

Скачайте isu-corporate-design.zip в папку «Загрузки», затем:

```powershell
scp "$env:USERPROFILE\Downloads\isu-corporate-design.zip" admin@213.171.26.248:/home/admin/
ssh admin@213.171.26.248
```

## Ubuntu — после подключения к серверу

Команды рассчитаны на существующий репозиторий /home/admin/pribory.

```bash
python3 -m zipfile -e /home/admin/isu-corporate-design.zip /home/admin/isu-design-update
python3 /home/admin/isu-design-update/install-design.py --root /home/admin/pribory
cd /home/admin/pribory
sudo docker compose up -d --build --no-deps filemanager
sudo docker compose ps filemanager
curl -fsS https://files.imcstroy.ru/isu-corporate.css | head -n 3
```

После успешной сборки откройте https://files.imcstroy.ru/ и нажмите Ctrl+F5.
Для значка вкладки может потребоваться закрыть и снова открыть вкладку.
Проверьте вход, главную, список дел, журнал и форму создания документа.
Контейнер filemanager кратковременно перезапустится; остальные сервисы не перезапускаются.
Не выполняйте docker compose down или удаление volumes.

## Откат

Установщик печатает путь резервной копии. Они сохраняются вне репозитория:
/home/admin/isu-design-backups/pribory/.
Для восстановления последней копии:

```bash
python3 /home/admin/isu-design-update/install-design.py --root /home/admin/pribory --rollback
cd /home/admin/pribory
sudo docker compose up -d --build --no-deps filemanager
```

Откат прекращается, если файлы оформления после установки были изменены вручную,
чтобы не затереть более поздние изменения. В таком случае используйте напечатанный
путь резервной копии и сравните файлы перед восстановлением.

## Какие файлы меняются

- filemanager/web/index.html — точечные изменения установщиком, копия до изменений сохранена;
- filemanager/web/isu-corporate.css — новая тема;
- filemanager/web/brand/cstroy-mark.svg — эмблема;
- filemanager/web/brand/favicon.png — присланный значок вкладки.

Исходные style.css, JavaScript, серверный код, Caddy, Docker Compose, .env, базы и
документы не заменяются. Для постоянного хранения изменений добавьте изменённый
index.html и три новых файла в ваш Git-репозиторий; перед git add проверьте diff.

Проверки пакета: применение к HTML ИСУ, сохранность всех ID и скриптов,
повторная установка без дубликатов и восстановление исходных файлов.
Полная проверка установленной версии с рабочими данными выполняется после установки.

# Kaiten — Interface Map (live walkthrough)

> Every surface of `aopab.kaiten.ru` (space 36022), explored with Playwright on
> 2026-06-22. Russian labels quoted verbatim with English glosses; real `data-testid`s
> noted as `tid:`. Screenshots live in `research/.scratch/ui-*.png` (gitignored).
> This is the map of what Kaiten *has*; micro-kaiten implements a small, opinionated subset.

## 1. Top bar (global)
Logo (layered diamond mark + "Kaiten" wordmark) · global **search** "Найти" · **Улучшить
тариф** (upgrade) · **Kaiten · AI** badge · help (?) · mail · **Уведомления** (notifications,
bell) · **profile avatar** (`tid: app-bar-profile-avatar`).

## 2. View toolbar (per space)
Switches the board area between **five view modes** plus actions:

| Control | Gloss | Notes |
|---|---|---|
| **Доски** | Boards | default kanban canvas |
| **Списки** | Lists | list view of cards |
| **Таблица** | Table | spreadsheet/grid view |
| **Timeline** | Timeline | Gantt-style |
| **Календарь** | Calendar | cards by date |
| **Отчёты** | Reports | analytics (see §6) |
| **Архив** | Archive | archived-card table (see §7) |
| **Добавить** | Add | add board/card/space |
| **Фильтры** | Filters | filter panel (see §5) |
| Полный вид карточек | Full card view | facade density toggle |
| Свернуть все доски | Collapse all boards | |
| Добавить в избранное | Add to favourites | star |
| AI Transcribe Menu | — | AI meeting transcription |

## 3. Left sidebar (`--app-tree-width: 300px`)
**Личное** (Personal) · **Избранное** (Favourites, count) · space list (e.g. **Обустройство
квартиры**) · **Шаблоны пространств** (Space templates) · **Администрирование** (Admin, §8).
Each space expands to its boards.

## 4. Board canvas
Multiple boards laid in a row (e.g. **Backlog**, **Sprint**). Per board:
- Header: drag handle (`DragIndicatorIcon`), title (`tid: board-title`), collapse chevron
  (`tid: expander-button`), on hover: link, **board menu** (`tid: board-context-menu-button`), `+`.
- Columns: title + live count (`tid: board-lane-cards-count`); hover reveals `+` (`AddIcon`)
  and a `⋮` column menu (`tid: <name>-title-menu`). Quick-add input `tid: create-card-field`
  (placeholder "Сформулируйте задачу").
- Cards: `tid: board-card-item` (see card facade in `kaiten-live-card.feature`).
- Real columns here — Backlog: `Очередь` (37). Sprint: `На неделю → на день → В работе →
  Жду → Готово`.

## 5. Filters panel ("Добавить фильтр")
Searchable list of **22 filterable attributes**, each with an icon:
Название (Title) · Заказчик (Requester) · Заказчик заявки службы поддержки · Участник
(Participant) · Ответственный (Responsible) · ID · Срочность (Urgency) · Статус блокировки
(Block status) · Метка (Label) · Родительская/Дочерняя карточка (Parent/Child card) · Статус
· Тип карточки (Card type) · Размер (Size) · Завершена (Completed) · Создана (Created) ·
Последнее перемещение (Last move) · Обновлена (Updated) · Взята в работу (Started) ·
Планируемое начало / Запланированный конец (Planned start/end) · Срок (Deadline).

## 6. Reports (Отчёты) — 13 analytics
Суммарный отчёт (Summary) · Сроки по задачам (Deadlines) · Воронка продаж (Sales funnel) ·
**Накопительная диаграмма потока** (Cumulative Flow Diagram) · Контрольный график (Control
chart) · Спектральная диаграмма (Scatterplot) · Динамика изменений времени цикла (Cycle-time
dynamics) · **Пропускная способность** (Throughput) · Распределение карточек (Card
distribution) · **Время цикла** (Cycle time) · Время разрешения блокировок (Block-resolution
time) · Спринты (Sprints) · **Скорость выполнения** (Velocity).

## 7. Archive (Архив)
A sortable, **exportable table** (СКАЧАТЬ = download, НАСТРОЙКИ = settings) of archived cards.
Columns: Название · Колонка · Дорожка · ID · Дата создания · Взята в работу · Выполнена ·
Срок · Суммарное время · Суммарное время блокировок · Размер · Трудозатраты.

## 8. Administration (Администрирование)
Учёт времени (Time tracking) · Служба поддержки (Support desk) · **Типы карточек** (Card
types) · **Виды карточек** (Card views/facades) · Хранилище (Storage) · **Метки** (Labels) ·
Оплата (Billing) · Дерево сущностей (Entity tree) · Настройки компании · **Пользователи**
(Users) · Роли пользователей (Roles) · **Пользовательские поля** (Custom fields) · Каталоги
(Catalogs) · Журнал событий (Event log) · Экспорт данных компании · Календари · **Журнал
аудита** (Audit log) · Ресурсное планирование (Resource planning) · Категории блокировки.

## 9. Card detail (modal at `/boards/card/<id>`)
- **Header:** title (`tid: card-title`), id (`tid: card-id-in-card-header`), requester
  "Заказчик …", created time, favourite star (`tid: favorite-card-button`), fullscreen, close.
- **Action bar:** add (`+`) · timer (▶) · **advance pill naming next column**
  (`tid: move-to-next-column-button`, e.g. "→ НА ДЕНЬ") · priority flag · **block**
  (`tid: block-card-button`) · **share** (`tid: share-card-button`) · **⋮ menu**
  (`tid: card-three-dots-menu`, see §10).
- **Основные параметры:** Расположение (`tid: card-location`, "Sprint / На неделю") · Тип
  (`tid: card-type-chip`) · Участники (`tid: add-members`) · Срок (deadline → calendar picker).
- **Описание:** rich editor (`tid: card-description-editor`) — **Визуальный / Markdown**
  toggle, H1–H3, lists, quote, image, attachment, table, divider; **Сохранить** to commit.
- **Right panel:** tabs **КОММЕНТАРИИ** (Comments, `tid: new-comment-editor`, mic dictation,
  placement below/right toggle) and **СПРОСИТЬ ИИ** (Ask AI).

## 10. Card actions menu (⋮)
Скопировать (Copy id/link) · Переместить (Move) · Дублировать (Duplicate) · Учёт времени
(Time tracking) · Показать историю (History) · Подписаться (Subscribe) · Привязать к сервису
(Link to service) · Экспортировать (Export) · Комментарии по email · Заблокировать (Block) ·
Архивировать (Archive) · **Удалить (Delete, red)**.

## 11. Card types
Letter+color markers, change via `tid: card-type-change-button` / `card-type-chip`:
**C** Card · **B** Bug · **F** Feature ("Текущий тип" / "Изменить тип").

---

### micro-kaiten read
Kaiten is a *broad* PM suite — 5 view modes, 13 reports, 22 filters, 20 admin screens, a
12-item card menu. micro-kaiten is the **opposite**: one spatial board view, no reports, no
admin, capture + advance as the only first-class acts. The lesson isn't the feature list —
it's that even this dense product keeps the **card facade** clean and the **advance**
action front-and-centre; that's the part worth matching.

# BDD captured by actually performing these actions on the live Kaiten board
# (aopab.kaiten.ru, space 36022) with Playwright on 2026-06-22 — created card
# #66379928 "🤖 bdd test", renamed it, wrote+saved a description, set a deadline,
# opened the participant picker, and inspected the actions menu. Real data-testids
# noted as `# tid:`. Reference for may-kaiten, not a literal port.

Feature: Create a card from a column
  As someone capturing a task
  I want to add a card straight into a column
  So that it appears immediately at the right stage

  Scenario: Quick-add creates a card in the targeted column
    Given the board "Sprint" with column "На неделю"
    When I focus the column's quick-add input "Сформулируйте задачу"   # tid: create-card-field
    And I type a title and press Enter
    Then a new card appears in "На неделю"                             # tid: board-card-item
    And the column count increments
    And the new card has a deep-link "/space/36022/boards/card/<id>"   # data-card-id on the node


Feature: Edit a card's title
  As the card's owner
  I want to rename it in place
  So that the title stays accurate

  Scenario: Renaming the title persists
    Given a card open in detail                                       # tid: card-title
    When I click the title, select all, type a new title and blur
    Then the header shows the new title
    And the card facade on the board shows the new title              # tid: card-title-text


Feature: Edit a card's description
  As someone documenting a task
  I want a rich-text description that I explicitly save
  So that detail lives on the card

  Scenario: Writing and saving a description
    Given a card open in detail
    When I click the description area                                 # tid: card-description-editor
    Then a rich editor appears with a "Визуальный/Markdown" toggle and a formatting toolbar
      # H1–H3, lists, quote, image, attachment, table, divider
    When I type text and click "Сохранить"
    Then the description is saved and rendered on the card
    # NB: clicking away does NOT save — the explicit "Сохранить" button is required.


Feature: Set a card's deadline
  As someone scheduling work
  I want to pick a due date from a calendar
  So that the card shows a deadline badge

  Scenario: Picking a date from the calendar
    Given a card with no deadline showing "Установить срок"
    When I click "Установить срок"
    Then a month calendar opens (e.g. "июнь 2026") with weekday headers "П В С Ч П С В"
    When I click a day number
    Then the deadline is set (the "Установить срок" prompt is replaced by the date)
    And a deadline badge appears on the card facade                  # tid: facade-deadline


Feature: Add participants to a card
  As someone assigning work
  I want to pick people (or groups) for the card
  So that their avatars show on the facade

  Scenario: The participant picker lists people and groups
    Given a card open in detail
    When I click "Добавить участников"                               # tid: add-members
    Then a picker opens with tabs "УЧАСТНИКИ" and "ГРУППЫ" and a search   # tid: search-members-field-input
    And it suggests members (e.g. "sp+ka @sp_ka")
    When I pick a member
    Then their avatar appears on the card facade                     # tid: facade-members


Feature: Change a card's type
  As someone classifying work
  I want to switch the card type
  So that the card reads as a Card, Bug or Feature

  Scenario: Switching type from the type chip
    Given a card open in detail
    When I click the type chip "C Card"                              # tid: card-type-chip
    Then I can choose under "Изменить тип": "C Card", "B Bug", "F Feature"
    And the chosen type's colour marker shows on the card facade     # tid: card-type-change-button


Feature: Card actions menu (⋮)
  As someone managing a card's lifecycle
  I want copy/move/duplicate/block/archive/delete in one menu
  So that whole-card operations are in one place

  Scenario: The actions menu exposes lifecycle operations
    Given a card open in detail
    When I open the "⋮" menu                                         # tid: card-three-dots-menu
    Then it offers: Скопировать, Переместить, Дублировать, Учёт времени,
      Показать историю, Подписаться, Привязать к сервису, Экспортировать,
      Комментарии по email, Заблокировать, Архивировать, and Удалить (red)

  Scenario: Deleting a card
    Given a card open in detail
    When I open the "⋮" menu and choose "Удалить"
    Then I am asked to confirm
    And on confirm the card is removed from the board and its count decrements

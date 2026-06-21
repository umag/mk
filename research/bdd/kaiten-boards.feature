# BDD extracted from kaiten.ru board behavior (reference spec, scraped 2026-06-22).
# These scenarios document how *Kaiten's* boards work and look — the bar PRODUCT.md
# names. Treat as reference behavior to reinterpret, not a literal test suite for
# may-kaiten (e.g. our scroll is canvas-level, we have no chip labels). Russian UI
# terms are kept in parentheses.

Feature: Kanban board structure and flow
  As a person organizing work
  I want a board of stage-columns I move cards across
  So that the state of every task is visible at one glance ("один взгляд")

  Background:
    Given a board with the columns "Очередь", "В работе", "Проверка", "Готово"
      # Backlog / In progress / Review / Done
    And each column represents exactly one state ("один статус — одно состояние")

  Scenario: A card advances one stage at a time
    Given a card "Write spec" in column "Очередь"
    When I move the card to the next column
    Then the card appears in "В работе"
    And the card's stage is visible to every team member viewing the board

  Scenario: A card reaches Done and can be archived
    Given a card "Ship release" in column "Проверка"
    When I move the card to "Готово"
    Then the card sits in "Готово"
    And the card can be archived out of the active view

  Scenario Outline: Cards flow forward through every stage
    Given a card in column "<from>"
    When I move it to the next column
    Then it appears in "<to>"

    Examples:
      | from      | to        |
      | Очередь   | В работе  |
      | В работе  | Проверка  |
      | Проверка  | Готово    |


Feature: Swimlanes (дорожки)
  As a lead with several work streams on one board
  I want horizontal lanes that split cards by category
  So that streams stay separated while sharing the same column flow

  Scenario: Lanes split work by type while preserving columns
    Given a board with lanes "Фичи", "Баги", "Техдолг"
      # Features / Bugs / Tech debt
    Then every lane shares the same columns "Очередь → В работе → Проверка → Готово"
    And a card belongs to exactly one lane and one column (a cell / "ячейка")

  Scenario: A per-assignee lane shows each person their own work
    Given a lane is created for each assignee
    When a manager views the board
    Then the manager sees the progress of each assignee in that person's lane
    And each assignee can find their own cards in their own lane


Feature: WIP limits (WIP-лимиты)
  As a team avoiding overload
  I want a cap on cards per column
  So that the board signals when work-in-progress is too high

  Scenario: Column stays calm under its limit
    Given column "В работе" has a WIP limit of 3
    And the column holds 2 cards
    Then the column is shown normally

  Scenario: Column turns red when the limit is exceeded
    Given column "В работе" has a WIP limit of 3
    When a 4th card enters "В работе"
    Then the system highlights the entire column in red ("выделит всю колонку красным")
    And the team is signalled to stop starting new work


Feature: Keeping the board orderly
  As someone whose board fills up
  I want to collapse, archive, filter and bulk-edit
  So that the board stays readable without losing data

  Scenario: Collapse a board or lane to reclaim screen space
    Given a board (or lane) taking up the full width
    When I click the collapse arrow in its top corner ("стрелочка в углу")
    Then the element shrinks and stops taking much space on screen

  Scenario: Auto-archive keeps Queue and Done clean
    Given auto-archiving ("автоархивация") is enabled for "Очередь" and "Готово"
    When a card has sat inactive past the threshold
    Then the card moves to the archive automatically
    And its data remains retrievable from the archive

  Scenario: Filter the board down to what matters
    When I open "ФИЛЬТРЫ" and apply a filter
    Then only cards matching the filter remain visible
    And the rest are hidden, not deleted


Feature: Bulk actions on cards (массовые действия)
  As someone editing many cards at once
  I want to select a set and act on all of them together
  So that routine changes don't take N separate edits

  Scenario: Select several cards by Shift-clicking
    When I hold SHIFT and click multiple cards
    Then the selected cards are marked
    And a bulk-action control panel appears on the right
    And the panel shows the count of selected cards

  Scenario: Act on all filtered cards at once
    Given a filter is applied via "ФИЛЬТРЫ"
    When I open "МАССОВЫЕ ДЕЙСТВИЯ" and choose "ДОБАВИТЬ ОТФИЛЬТРОВАННЫЕ"
    Then every filtered card is added to the selection

  Scenario: Move every card out of a lane in one action
    When I open a lane's menu and choose "ПЕРЕМЕСТИТЬ ВСЕ КАРТОЧКИ"
    Then all cards in that lane are moved together

  Scenario Outline: Bulk operations available on a selection
    Given multiple cards are selected
    When I choose the bulk operation "<operation>"
    Then the operation is applied to every selected card

    Examples:
      | operation                |
      | Archive                  |
      | Move to column/board     |
      | Change labels            |
      | Change card type         |
      | Set assignee/responsible |
      | Set deadline             |
      | Change card size         |
      | Update custom field      |


Feature: Spaces hierarchy (пространства)
  As someone running several areas of work
  I want Spaces over Boards over Cards
  So that boards group sensibly and can be shared across contexts

  Scenario: Three-level hierarchy
    Then work is organized as Space ("пространство") → Board ("доска") → Card ("карточка")

  Scenario: A board pinned across spaces
    Given a board is pinned/linked to a space ("доска, привязанная к пространству")
    When I open a different space it is linked into
    Then the same board appears as a side panel in that space
    And cards on it can be decomposed and tracked from either space

# BDD captured from the LIVE Kaiten instance aopab.kaiten.ru, space 36022
# ("Обустройство квартиры"), driven with Playwright on 2026-06-22. Every scenario
# below was observed in the real product; real data-testids are noted as `# tid:` so
# these double as executable test specs. Layout observed: two boards on one canvas —
# "Backlog" (1 column: Очередь / 37 cards) and "Sprint" (На неделю → на день →
# В работе → Жду → Готово). Reference behavior for may-kaiten, not a literal port.

Feature: Space holds multiple boards on one canvas
  As the owner of a space
  I want several boards laid out together
  So that related work is visible without switching pages

  Scenario: A space renders more than one board side by side
    Given I open space 36022 "Обустройство квартиры"          # url: /space/36022/boards
    Then I see the board "Backlog"                             # tid: board-title
    And I see the board "Sprint" to its right                  # tid: board-title
    And each board has its own columns and card counts

  Scenario: A board can be collapsed to reclaim space
    Given the board "Sprint"
    When I click the board's collapse chevron                  # tid: expander-button / ChevronRightIcon
    Then the board folds to its header and frees canvas width


Feature: Columns and their headers
  As someone scanning a board
  I want each column to show its name and live count
  So that load per stage is obvious at a glance

  Background:
    Given the board "Sprint" with columns "На неделю", "на день", "В работе", "Жду", "Готово"
      # tid: column-title-<name>, container tid: column-<id>

  Scenario: Each column header shows a live card count
    Then column "На неделю" shows a count badge                # tid: board-lane-cards-count
    And the count equals the number of cards in that column

  Scenario: Column controls appear on hover
    When I hover a column header
    Then an add-card "+" control appears                       # tid: AddIcon
    And a "⋮" column menu appears                              # tid: <name>-title-menu / MoreVertIcon


Feature: Quick-add a card to a column
  As someone capturing a task
  I want an always-available input at the top of a column
  So that I can add a card without leaving the board

  Scenario: An empty column exposes its quick-add input
    Given column "На неделю" has no cards
    Then it shows a quick-add input placeholder "Сформулируйте задачу"   # tid: create-card-field
      # ("Formulate a task")

  Scenario: Typing a title and confirming creates a card in that column
    Given I focus the quick-add input of column "На неделю"    # tid: create-card-field
    When I type a card title and press Enter
    Then a new card appears at the top of "На неделю"          # tid: board-card-item
    And the column count increments by one                     # tid: board-lane-cards-count


Feature: Move a card between columns (drag-and-drop)
  As someone advancing work
  I want to drag a card to another column
  So that its stage updates and counts stay accurate

  # Verified live: dragging card "созвон с Киком зашедулить" from "На неделю" to
  # "на день" and back. Source count 1→0, destination 0→1, then restored.

  Background:
    Given card "созвон с Киком зашедулить" is in column "На неделю"   # tid: board-card-item
    And column "На неделю" shows count 1 and "на день" shows count 0

  Scenario: Dragging a card forward updates both column counts
    When I drag the card from "На неделю" onto "на день"
    Then the card now sits in column "на день"
    And "На неделю" count becomes 0
    And "на день" count becomes 1
    And the card keeps its assignee avatar                     # tid: facade-members
    And the emptied "На неделю" reveals its quick-add placeholder "Сформулируйте задачу"

  Scenario: Dragging the card back restores the original state
    Given the card is in "на день"
    When I drag the card from "на день" back onto "На неделю"
    Then the card sits in "На неделю" again
    And "На неделю" count returns to 1 and "на день" to 0


Feature: Advance a card by one column from its detail view
  As someone who prefers a single click to a drag
  I want a button that moves the card to the next column
  So that advancing is one action and names its destination

  # Verified live: the detail action bar shows a pill that NAMES the next column.

  Scenario Outline: The advance button is labelled with the next column
    Given I open a card whose column is "<current>"            # tid: move-to-next-column-button
    Then the advance pill reads "→ <next>"

    Examples:
      | current   | next     |
      | На неделю  | на день  |
      | Очередь    | (next column on that board) |

  Scenario: Clicking advance moves the card one column forward
    Given a card open in detail with advance pill "→ на день"
    When I click the advance button                            # tid: move-to-next-column-button
    Then the card's location becomes "Sprint / на день"        # tid: card-location
    And the advance pill re-targets the following column ("→ В работе")

# BDD extracted from kaiten.ru card behavior & appearance (reference spec, scraped
# 2026-06-22). Documents how *Kaiten's* cards look and behave — the "clean card
# density" PRODUCT.md sets as the bar. Reference, not a literal may-kaiten suite:
# may-kaiten deliberately drops labels/covers/chips and adds the advance mechanic.
# Russian UI terms kept in parentheses.

Feature: Card facade — read a card at one glance (фасад карточки)
  As someone scanning a board
  I want the card's face to carry just enough signal
  So that I read status, deadline and priority without opening it ("один взгляд")

  Scenario: A full card facade shows its key signals
    Given a card with a title, cover, labels, assignees and a deadline
    Then the card face ("фасад") shows the title
    And it shows the cover image ("обложка") if one is set
    And it shows colored labels ("метки")
    And it shows assignee and responsible-person avatars ("исполнитель", "ответственный")
    And it shows the deadline badge ("срок")
    And it shows a checklist progress bar when the card has a checklist ("чек-лист")

  Scenario Outline: Two preset facade views
    Given the board uses the "<view>" card view
    Then each card shows "<shown>"

    Examples:
      | view       | shown                                                                  |
      | Полный     | all configured fields                                                  |
      | Компактный | title, participants, deadline, blockers, and unfilled required fields  |

  Scenario: A custom facade picks and orders fields
    When I configure the card facade
    Then I choose which fields appear on the face
    And I set the order in which they are displayed


Feature: Deadline color states (срок)
  As someone triaging by urgency
  I want the deadline badge to change color with time
  So that lateness is visible from across the board

  Scenario Outline: Deadline badge color by state
    Given a card whose deadline state is "<state>"
    Then the deadline badge is "<color>"

    Examples:
      | state                  | color  |
      | time still available   | gray   |
      | due today              | yellow |
      | overdue                | red    |
      | completed on time      | green  |


Feature: Blockers (блокировки)
  As someone untangling dependencies
  I want blocked cards to stand out and name their blocker
  So that impediments are obvious on the board

  Scenario: A blocked card shows a red badge
    Given a card is marked as blocked
    Then the card shows a bright red badge ("яркая красная плашка")
    And the blocking card may be referenced from it
    And the dependency is visible directly on the board


Feature: Stale-card warning (застоявшаяся карточка)
  As a lead watching flow
  I want cards that sit too long to flag themselves
  So that stuck work surfaces without me hunting for it

  Scenario: A card that overstays a stage turns red
    Given a stale threshold is configured for a column
    When a card stays in that column past the threshold
    Then a red warning icon appears in the card's bottom-right corner
    And the icon reflects time spent in the current stage


Feature: Required fields (обязательные поля)
  As an admin enforcing data quality
  I want certain fields to be mandatory
  So that cards don't advance missing key information

  Scenario: Required fields can be set per card type or per board
    Then any custom field can be marked required for a card type
    Or marked required only on a specific board

  Scenario: An empty required field is flagged on the facade
    Given a card with an unfilled required field
    Then the required field is highlighted in color ("выделены цветом")
    And a warning is shown on the card facade ("предупреждение на фасаде карточки")
    # Note: docs do not state whether movement is hard-blocked or only warned.


Feature: Card types, dependencies and order
  As someone keeping a busy board legible
  I want typed cards, dependencies and color
  So that different work reads differently at a glance

  Scenario: Card types distinguish kinds of work
    Given unlimited card types are available
    When I assign a type to a card
    Then cards of different types are visually distinguishable on the board
    And cards can be filtered by type

  Scenario: Dependencies and blocking between cards
    Given card A depends on / is blocked by card B
    Then the relationship is shown on the cards
    And A is marked blocked while B is unresolved (see blocker badge)

  Scenario: Checklists break a card into trackable subtasks
    Given a card with a checklist ("чек-лист")
    Then a progress bar shows inside the card
    And the same progress is visible on the card facade


Feature: Opening and editing a card
  As someone acting on a single task
  I want the card to expand into full detail
  So that I can see and change everything about it

  Scenario: Click a card to see full detail
    When I click a card
    Then I see its description, attached files, checklists and child tasks
      # "описание, прикрепленные файлы, чек-листы и список дочерних задач"

  Scenario: Multiple people can own one card
    Given a card on the board
    When I add several assignees
    Then all assignee avatars appear on the card face
    And assignees can be changed quickly

  Scenario: Child-card progress rolls up to the parent
    Given a parent card with child cards
    When child cards are completed
    Then the parent reflects the progress of its children

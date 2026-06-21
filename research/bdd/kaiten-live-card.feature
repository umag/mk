# BDD captured from the LIVE Kaiten card view on aopab.kaiten.ru (space 36022),
# Playwright, 2026-06-22. Observed on real cards (#61298427 "курсы актерского",
# #61888347 "созвон с Киком зашедулить"). Real data-testids noted as `# tid:`.
# The card detail is a modal at a deep-linkable URL /space/36022/boards/card/<id>.

Feature: Card facade on the board
  As someone scanning the board
  I want the card face to carry just enough signal
  So that I read a task without opening it

  Scenario: A card shows its title
    Given a card on the board                                  # tid: board-card-item
    Then it shows the card title                               # tid: card-title-text

  Scenario Outline: Optional facade signals appear only when present
    Given a card that has "<signal>"
    Then the card face shows "<element>"

    Examples:
      | signal          | element                          |
      | an assignee     | a round avatar (facade-members)  |
      | a comment       | a comment counter (facade-comments-counter) |
      | a deadline      | a deadline badge (facade-deadline) |
      | a card type     | a type marker (card-type-change-button) |

  Scenario: Cards stay visually clean
    Then a card carries only title plus the present signals
    And there is no row of colored tag/label chips on the face


Feature: Opening a card to its detail modal
  As someone acting on one task
  I want a focused detail view over the dimmed board
  So that I can see and edit everything about the card

  Scenario: Clicking a card opens a deep-linkable detail modal
    When I click a card                                        # tid: board-card-item
    Then a detail modal opens over a dimmed canvas
    And the URL becomes "/space/36022/boards/card/<id>"
    And the modal can be closed (X) or maximised (fullscreen)

  Scenario: The header identifies the card
    Then the header shows the card title                       # tid: card-title
    And a card number like "#61888347"                         # tid: card-id-in-card-header
    And the requester "Заказчик sp+ka"
    And a created-time like "Создана 3 месяца назад"
    And a favourite (star) toggle                              # tid: favorite-card-button


Feature: Card detail action bar
  As someone managing a single card
  I want primary actions in one row
  So that advancing, blocking, sharing are one click

  Scenario Outline: The action bar exposes core controls
    Given a card open in detail
    Then the action bar shows "<control>"

    Examples:
      | control                                   |
      | advance pill naming the next column (move-to-next-column-button) |
      | a timer / start control                   |
      | a priority flag                           |
      | a block-card button (block-card-button)   |
      | a share button (share-card-button)        |
      | a three-dots menu (card-three-dots-menu)  |

  Scenario: Blocking a card
    When I click the block-card button                         # tid: block-card-button
    Then the card is marked blocked
    And the block is reflected on the card facade on the board


Feature: Main parameters of a card
  As someone filling in a task
  I want location, type, participants and deadline together
  So that the card's context is set in one place

  Scenario: Location breadcrumb shows board and column
    Then "Расположение" shows "Sprint / На неделю"             # tid: card-location
    And it links back to that board and column

  Scenario: Card type is shown and changeable
    Then "Тип" shows a type chip "C Card"                      # tid: card-type-chip

  Scenario: Participants can be added
    Given a card with no participants
    Then "Участники" offers "Добавить участников"              # tid: add-members
    When I add a participant
    Then their avatar appears on the card facade               # tid: facade-members

  Scenario: A deadline can be set
    Given a card with no deadline
    Then "Срок" offers "Установить срок"
    When I set a deadline
    Then a deadline badge appears on the card facade           # tid: facade-deadline


Feature: Description
  As someone documenting a task
  I want a rich description area
  So that the card explains itself

  Scenario: Empty description shows guidance, filled shows content
    Given a card with no description
    Then the description shows "Введите текст описания задачи, чтобы сделать её более понятной"
    Given a card with a description                            # tid: card-description-editor
    Then the description renders its content (e.g. a link "https://dramaqueen.school/")


Feature: Comments and Ask-AI
  As someone collaborating on a card
  I want a comments thread and an AI helper side by side
  So that discussion and assistance live with the card

  Scenario: The side panel has Comments and Ask-AI tabs
    Then the panel shows tabs "КОММЕНТАРИИ" and "СПРОСИТЬ ИИ"
    And "КОММЕНТАРИИ" is selected by default

  Scenario: Writing a comment
    Given the comments tab is active
    Then a composer shows "Напишите комментарий" with a mic button   # tid: new-comment-editor / type-comment
    When I type a comment and submit
    Then it is added to the thread
    And the card's facade comment counter increments            # tid: facade-comments-counter

  Scenario: Comments placement can be toggled
    Then I can place comments below or to the right            # tid: comments-placement-below-button / comments-placement-right-button

# Requirements Document

## Introduction

The Todo Life Dashboard is a client-side web application that serves as a personal productivity homepage. It displays the current time and date with a contextual greeting, a configurable focus (Pomodoro) timer, a full-featured to-do list, and a quick-links panel for favourite websites. All user data is persisted using the browser's Local Storage API. The dashboard is built with plain HTML, CSS, and Vanilla JavaScript — no frameworks or backend required. It supports both light and dark visual modes and allows users to personalise the greeting with a custom name.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Greeting_Panel**: The UI section that displays the current time, date, and personalised greeting message.
- **Focus_Timer**: The configurable countdown timer component based on the Pomodoro technique.
- **Task_List**: The UI section that manages the user's to-do items.
- **Task**: A single to-do item with a title, completion state, and creation timestamp.
- **Quick_Links_Panel**: The UI section that stores and displays shortcut buttons to external URLs.
- **Link**: A user-defined shortcut consisting of a display name and a URL.
- **Local_Storage**: The browser's `localStorage` API used for all client-side data persistence.
- **Theme**: The visual colour mode of the Dashboard — either "light" or "dark".
- **Pomodoro_Duration**: The configurable length of a focus session, defaulting to 25 minutes.

---

## Requirements

### Requirement 1: Greeting Panel — Time and Date Display

**User Story:** As a user, I want to see the current time and date on the Dashboard, so that I can stay oriented throughout my day without switching to another app.

#### Acceptance Criteria

1. THE Greeting_Panel SHALL display the current local system time in 24-hour HH:MM format, updating every 60 seconds.
2. THE Greeting_Panel SHALL display the current date in the format "Weekday, DD MonthName YYYY" (e.g., "Monday, 12 September 2026").
3. WHEN the local time is between 05:00 and 11:59, THE Greeting_Panel SHALL display the greeting "Good morning".
4. WHEN the local time is between 12:00 and 17:59, THE Greeting_Panel SHALL display the greeting "Good afternoon".
5. WHEN the local time is between 18:00 and 20:59, THE Greeting_Panel SHALL display the greeting "Good evening".
6. WHEN the local time is between 21:00 and 04:59, THE Greeting_Panel SHALL display the greeting "Good night".

---

### Requirement 2: Custom Name in Greeting

**User Story:** As a user, I want to personalise the greeting with my name, so that the Dashboard feels like it was made for me.

#### Acceptance Criteria

1. THE Greeting_Panel SHALL provide an input field for the user to enter a custom name of 1 to 50 characters.
2. WHEN the user saves a custom name containing at least 1 non-whitespace character, THE Dashboard SHALL display the greeting with the trimmed name appended as a suffix (e.g., "Good morning, Rizki").
3. THE Dashboard SHALL persist the custom name in Local_Storage so the name is restored on page reload.
4. IF no custom name has been saved or the saved value is empty, THEN THE Greeting_Panel SHALL display the greeting without a name suffix.
5. IF Local_Storage is unavailable, THEN THE Dashboard SHALL display the greeting without a name suffix and SHALL NOT prevent the page from loading.

---

### Requirement 3: Focus Timer

**User Story:** As a user, I want a configurable countdown timer on the Dashboard, so that I can use the Pomodoro technique to manage my focus sessions.

#### Acceptance Criteria

1. THE Focus_Timer SHALL display a countdown in MM:SS format.
2. THE Focus_Timer SHALL initialise to the configured Pomodoro_Duration on page load.
3. WHEN the user activates the Start button, THE Focus_Timer SHALL begin counting down at one-second intervals.
4. WHEN the user activates the Stop button, THE Focus_Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the user activates the Reset button, THE Focus_Timer SHALL stop counting and reset the display to the current Pomodoro_Duration.
6. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop automatically, play an audible alert sound, and display a visual notification to indicate the session has ended, with the display remaining at 00:00.
7. WHILE the countdown is running, THE Focus_Timer SHALL disable the Start button and enable the Stop button.
8. WHILE the countdown is paused, stopped, or reset, THE Focus_Timer SHALL enable the Start button and disable the Stop button.
9. IF the Pomodoro_Duration is not a whole number between 1 and 60 minutes, THEN THE Focus_Timer SHALL reject the value and retain the previous valid duration.
10. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL transition to the stopped state with the Reset button enabled.

---

### Requirement 4: Configurable Pomodoro Duration

**User Story:** As a user, I want to change the focus timer duration, so that I can adapt it to my preferred working style.

#### Acceptance Criteria

1. THE Focus_Timer SHALL provide an input control that allows the user to set the Pomodoro_Duration in whole minutes between 1 and 120.
2. WHEN the user changes the Pomodoro_Duration while the Focus_Timer is not actively running, THE Focus_Timer SHALL reset the countdown to the new duration within 1 second.
3. THE Dashboard SHALL persist the Pomodoro_Duration in Local_Storage so the value is restored on page reload.
4. IF the user enters a Pomodoro_Duration outside the range of 1 to 120 minutes, THEN THE Focus_Timer SHALL reject the input upon confirmation, retain the previous valid duration, and display an error message indicating the valid range of 1 to 120 minutes.
5. WHEN the user changes the Pomodoro_Duration while the Focus_Timer is actively running, THE Focus_Timer SHALL apply the new duration only when the current session ends and the timer is reset.

---

### Requirement 5: Task Management — Core Operations

**User Story:** As a user, I want to add, edit, complete, and delete tasks, so that I can track what I need to do throughout my day.

#### Acceptance Criteria

1. THE Task_List SHALL provide a text input field and an "Add" button for creating new tasks.
2. WHEN the user submits a non-empty task title containing at least 1 non-whitespace character and no more than 200 characters, THE Task_List SHALL add the Task to the bottom of the list and clear the input field.
3. IF the user submits an empty or whitespace-only task title, THEN THE Task_List SHALL reject the submission, display an inline error message indicating the title is required, and retain focus on the input field.
4. IF the user submits a task title exceeding 200 characters, THEN THE Task_List SHALL reject the submission, display an inline error message indicating the maximum length, and retain focus on the input field.
5. THE Task_List SHALL render each Task with a checkbox, the task title, an edit control, and a delete control.
6. WHEN the user activates a Task's checkbox, THE Task_List SHALL toggle the Task's completion state and apply a visual completion style (e.g., strikethrough) to the task title.
7. WHEN the user activates a Task's edit control, THE Task_List SHALL replace the task title with an editable input field pre-filled with the current title and place focus on that input field.
8. WHEN the user saves an edited task title containing at least 1 non-whitespace character and no more than 200 characters, THE Task_List SHALL update the Task's title and return to the read-only display.
9. IF the user saves an edited task title that is empty or whitespace-only, THEN THE Task_List SHALL reject the change, display an inline error message indicating the title is required, and retain the previous title in the editable input field.
10. IF the user saves an edited task title exceeding 200 characters, THEN THE Task_List SHALL reject the change, display an inline error message indicating the maximum length, and retain the editable input field with the current input.
11. WHEN the user activates a Task's delete control, THE Task_List SHALL remove the Task from the list immediately without requiring additional confirmation.

---

### Requirement 6: Task Persistence

**User Story:** As a user, I want my tasks to be saved automatically, so that I do not lose them when I refresh or close the browser tab.

#### Acceptance Criteria

1. WHEN any Task is added, updated, or deleted, THE Task_List SHALL immediately synchronise the full task collection (up to 100 tasks) to Local_Storage.
2. WHEN the Dashboard loads, THE Task_List SHALL restore all Tasks from Local_Storage, preserving titles, completion states, and original order.
3. IF Local_Storage is unavailable or write operation fails, THEN THE Task_List SHALL retain the in-memory task collection for the current session and display an error indication to the user.
4. IF the Dashboard loads and Local_Storage is absent or contains malformed task data, THEN THE Task_List SHALL initialise with an empty task collection.

---

### Requirement 7: Duplicate Task Prevention

**User Story:** As a user, I want to be prevented from adding duplicate tasks, so that my list stays clean and unambiguous.

#### Acceptance Criteria

1. WHEN the user submits a task title that, after trimming leading and trailing whitespace, matches an existing Task title using case-insensitive comparison, THE Task_List SHALL reject the submission and display an inline error message identifying the duplicate.
2. WHEN the user modifies the content of the task input field after a duplicate error is displayed, THE Task_List SHALL clear the duplicate error message.

---

### Requirement 8: Task Sorting

**User Story:** As a user, I want to sort my task list, so that I can prioritise and review tasks in the order most useful to me.

#### Acceptance Criteria

1. THE Task_List SHALL provide a sort control with the options: "Default (Date Added)", "A → Z", and "Z → A".
2. WHEN the user selects "Default (Date Added)", THE Task_List SHALL re-render the task list ordered by creation timestamp, newest first, without modifying the stored task data.
3. WHEN the user selects "A → Z", THE Task_List SHALL re-render the task list ordered by task title in ascending alphabetical order, without modifying the stored task data.
4. WHEN the user selects "Z → A", THE Task_List SHALL re-render the task list ordered by task title in descending alphabetical order, without modifying the stored task data.
5. WHEN the user changes the sort option, THE Task_List SHALL persist the selected sort option to Local_Storage immediately.
6. WHEN the Dashboard loads, THE Task_List SHALL restore the previously selected sort option from Local_Storage, or default to "Default (Date Added)" if no sort preference is stored.

---

### Requirement 9: Quick Links Management

**User Story:** As a user, I want to save and open shortcut links to favourite websites, so that I can navigate to them quickly from the Dashboard.

#### Acceptance Criteria

1. THE Quick_Links_Panel SHALL provide a name input field, a URL input field, and an "Add Link" button.
2. WHEN the user submits a Link where the name is between 1 and 50 characters (inclusive) and the URL begins with "http://" or "https://" (case-insensitive) and is no longer than 2048 characters, AND the total number of stored Links is fewer than 20, THE Quick_Links_Panel SHALL add the Link as a clickable button.
3. IF the user submits a Link with an empty name, a name exceeding 50 characters, a URL that does not begin with "http://" or "https://" (case-insensitive), or a URL exceeding 2048 characters, THEN THE Quick_Links_Panel SHALL reject the submission and display an inline error message adjacent to the invalid field identifying which validation rule was violated.
4. WHEN the user activates a Link button, THE Dashboard SHALL open the exact URL associated with that Link in a new browser tab.
5. WHEN the user activates a Link's delete control, THE Quick_Links_Panel SHALL remove the Link from the panel.
6. WHEN any Link is added or deleted, THE Quick_Links_Panel SHALL synchronise the full link collection to Local_Storage.
7. WHEN the Dashboard loads and Local_Storage contains a valid link collection, THE Quick_Links_Panel SHALL restore all Links from Local_Storage and display them as clickable buttons.
8. IF the Dashboard loads and Local_Storage is unavailable or contains data that cannot be parsed as a valid link collection, THEN THE Quick_Links_Panel SHALL initialise with an empty link collection and display an error message indicating that saved links could not be restored.
9. IF the user submits a Link when the panel already contains 20 Links, THEN THE Quick_Links_Panel SHALL reject the submission and display an inline error message indicating the maximum link limit has been reached.

---

### Requirement 10: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between light and dark visual modes, so that I can use the Dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a toggle control to switch between the "light" Theme and the "dark" Theme.
2. WHEN the user activates the theme toggle, THE Dashboard SHALL apply the selected Theme to all UI components within 100 milliseconds.
3. THE Dashboard SHALL persist the selected Theme in Local_Storage so the Theme is restored on page reload.
4. IF the value stored in Local_Storage for the Theme preference is absent or not a recognized Theme value, THEN THE Dashboard SHALL default to the "light" Theme.
5. IF Local_Storage is unavailable, THEN THE Dashboard SHALL apply the "light" Theme for the current session without persisting the preference.

---

### Requirement 11: Single-File Architecture and Browser Compatibility

**User Story:** As a developer, I want the Dashboard to use a single CSS file and a single JavaScript file, so that the project structure stays clean and maintainable.

#### Acceptance Criteria

1. THE Dashboard SHALL consist of exactly one HTML file at the project root, one CSS file located in the `css/` directory, and one JavaScript file located in the `js/` directory, with no additional CSS or JavaScript files in any other location.
2. THE Dashboard SHALL operate correctly in the current stable versions of Chrome, Firefox, Edge, and Safari, where "operates correctly" means all features render visually and function without JavaScript errors in the browser console and without requiring any build tool, bundler, or local development server.
3. THE Dashboard SHALL use only browser-native APIs available without installation, and SHALL NOT load any external scripts, stylesheets, or resources from third-party URLs at runtime.

---

### Requirement 12: Performance and Responsiveness

**User Story:** As a user, I want the Dashboard to load quickly and respond immediately to interactions, so that it does not interrupt my workflow.

#### Acceptance Criteria

1. THE Dashboard SHALL complete initial page render within 2 seconds on a standard broadband connection (defined as download speed ≥ 25 Mbps).
2. WHEN the user interacts with any control (button, checkbox, or text input), THE Dashboard SHALL reflect the change in the UI within 100 milliseconds.
3. THE Dashboard SHALL adapt its layout to viewport widths from 320px to 2560px, such that all text remains legible and all interactive controls remain operable without horizontal scrolling at any width within that range.
4. IF the Dashboard fails to complete initial page render within 5 seconds, THEN THE Dashboard SHALL display a loading indicator and retain any previously loaded data without data loss.
5. WHEN the user resizes the viewport, THE Dashboard SHALL reflow its layout to fit the new dimensions within 200 milliseconds.

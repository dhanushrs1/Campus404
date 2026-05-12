# Campus404 - Tracks Feature Documentation

This document provides a comprehensive, "pin-to-pin" explanation of the **Tracks** system in the Campus404 platform. A Track is fundamentally a learning path designed to teach a given subject (like a programming language, algorithm, or toolset) through a structured hierarchy of sections, interactive exercises, code tasks, and quizzes. 

Detailed here is the entire end-to-end implementation including database schema/hierarchy, admin panel management, user-facing interfaces, related business logic, and a fully conceptualized example.

---

## 1. Core Hierarchy and Database Schema

The core logic is modeled hierarchically. Everything stems from a generic `Track` and breaks down into granular, actionable learning units. The data models are defined in `api/curriculum/models.py`.

1. **Track**: The highest-level container (e.g., "Python Fundamentals", "React Masterclass"). It includes meta-information such as `title`, `description`, `language_id`, `featured_image_url`, and an `order` for display ranking.
2. **Section**: Tracks are divided into Sections (Modules/Chapters) such as "Basic Syntax" or "Control Flow". Each section acts as a logical grouping of Exercises and optionally contains a `badge_url` to reward users upon completion.
3. **Exercise**: Discovered inside Sections, Exercises represent individual learning concepts. An exercise operates in a specific `mode` (typically `task` or `quiz`) and provides `theory_content` (the teaching material).
4. **Task (for Code Exercises)**: If the exercise is a coding task, it dictates the `instructions_md`, standard `starter_code` provided to the user, valid `solution_code`, and an array of `test_cases` (evaluated to verify correctness).
5. **QuizQuestion / QuizOption (for Quiz Exercises)**: If the exercise is a quiz, it defines multiple questions and their associated boolean (right/wrong) options.
6. **User Progress**: The `UserTaskProgress` table bridges the curriculum to the user, recording `user_id`, `task_id`, `status` (completed), and timestamps.

---

## 2. Admin Panel Implementation

Admins create and curate the curriculum dynamically without hardcoding configurations. The admin ecosystem lives primarily in `client/src/backend/curriculum/`.

### 2.1 Track Management (`TrackListPage.jsx` & `TrackManagerPage.jsx`)
- **Creation**: Admins can define new tracks by assigning a Name, Description, and picking a Language config (e.g., Python 3.8.1, Node.js 18).
- **Listing & Organization**: An organized dashboard queries to `shared/curriculumApi.js`, enabling pagination, searching, and opening tracks for deeper editing.

### 2.2 Section & Exercise Editor (`TrackEditorPage.jsx`)
- Once a Track is opened, nested editors allow the admin to construct the hierarchy. Admins append Sections, organize them structurally using an `order` integer, and embed corresponding Exercises into those sections. 

### 2.3 The Content Studio (`ExerciseStudio.jsx`)
- The most critical admin feature is the `ExerciseStudio`. Here, admins create the actual content logic.
- **For Coding Tasks**: Admins write markdown-based instructions, provide default code snippets (starter code), provide the required solution, and structure robust JSON-based **Test Cases**. These test cases are fed directly to the Judge system.
- **For Quizzes**: Admins add prompts and multiple-choice options, checking which options hold the `"is_correct": true` flag.

---

## 3. User Panel Implementation

The User experience focuses on discovery, syllabus tracking, and interactive learning. 

### 3.1 Course Discovery (`TracksPage.jsx`)
- Found in `client/src/frontend/pages/TracksPage/`, this acts as the entry catalog.
- **Logic**: Tracks are fetched via `getTrackTree()` from the `shared/learningApi.js`. The `TracksPage` normalizes data, determining visual tech icons (React, Python, C++, etc.) using heuristic checks inside `inferTrackIconType` against the title / description / DB language ID.
- Users view progress badges, hero backgrounds, and an inviting listing to choose their path.

### 3.2 Syllabus Overview (`TrackOverviewPage.jsx`)
- Clicking a Track reveals the syllabus view. It outlines the specific sections and enumerates the child exercises. Active progress (queried from `shared/learningProgress.js`) determines which exercises feature a locked/unlocked or "Completed" status.

### 3.3 Interactive Learning Environment (`WorkspacePage.jsx`)
- When starting an Exercise, the user enters the Workspace IDE.
- **Layout Logic**: The workspace connects theory/instructions (on the left pane) with a code editor (on the right pane). 
- **Execution Lifecycle**: 
  1. The user types code based on the loaded exercise's `starter_code` and `instructions_md`.
  2. Upon hitting "Run/Submit", the Workspace sends the user's source code along with the admin-defined `test_cases` to the isolated remote **Judge System** (`judge/worker.py` and `judge/judge_api.py`). 
  3. The judge evaluates the script in Dockerized containers against the tests and returns detailed execution results.
  4. If all tests pass, an API request triggers the backend to create/update a `UserTaskProgress` entry. The user receives an automated success confirmation and is moved to the next exercise/task.

---

## 4. End-to-End Example: "Python Fundamentals" Track

To fully comprehend the workflow, here is a complete lifecycle of creating and consuming one Track.

### STEP 1: Admin Creates the Track
1. An admin logs into the Admin Panel and navigates to the **Curriculum Manager**.
2. They click "New Track" -> Title: `"Python Fundamentals"`, Language: `"Python 3.8.1"`.
3. In `TrackEditorPage`, they create a new **Section** called `"1. Basics"`.
4. Inside `"1. Basics"`, they create an **Exercise** called `"Variables and Math"`.
5. In `ExerciseStudio`, the admin configures a **Task**:
   - **Instructions (Markdown)**: `"Declare a variable named \`total\` that adds 5 and 10. Print \`total\`."`
   - **Starter Code**: `total = 0\n# Write your code here\n`
   - **Test Cases**: `[ { "input": "", "expected_output": "15\n", "is_hidden": false } ]` 

### STEP 2: The Data Layer
- The Backend (`api/curriculum/router.py`) handles the POST requests and safely saves this hierarchy using SQLAlchemy into the Postgres tables (`tracks`, `sections`, `exercises`, `tasks`).

### STEP 3: The User Discovers the Track
1. A new user opens the portal and visits the `/tracks` route (`TracksPage.jsx`).
2. The UI runs `inferTrackIconType` and detects "Python", automatically attaching the blue/yellow Python SVG logo and default banner images.
3. The user clicks "Start Track", launching them into the `TrackOverviewPage`.

### STEP 4: The User Completes the Exercise
1. Clicking into `"Variables and Math"`, navigating them to the **WorkspacePage**.
2. The left pane renders the Markdown instruction. The right pane code editor is pre-populated with `total = 0 \n # Write your code here`.
3. The user modifies the code to:
   ```python
   total = 5 + 10
   print(total)
   ```
4. The user clicks **Submit**. The `WorkspacePage` triggers an API payload sent to the backend and routed to the Python **Judge Worker**.
5. The judge runs the script, matches the standard output literally to the test case `expected_output` (`"15\n"`), and returns a `Pass` response.
6. The client recognizes the success, triggers fireworks/celebration UI, and seamlessly fires a background request pushing `{ task_id: 1, status: 'completed' }` to `UserTaskProgress`. The exercise is subsequently unlocked natively on the sidebar for future visits.

---

## 5. Technical Stack Connections Snapshot
- **Database Models**: SQLAlchemy (`api/curriculum/models.py`)
- **Backend Routing**: FastAPI (`api/curriculum/router.py`)
- **Admin UI Components / IDE Editor**: React (`client/src/backend/curriculum/`)
- **User Facing UI**: React (`client/src/frontend/pages/TracksPage`, `WorkspacePage.jsx`)
- **Code Execution Environment**: Isolated Docker Containers orchestrated via FastAPI Judge app (`judge/main.py`).
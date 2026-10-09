# Vocabulary Quest: An Interactive Jeopardy Game for Language Learning

**Vocabulary Quest** is a custom-built, single-page web application designed with ESL (English as a Second Language) in mind and general vocabulary lessons. It adapts the classic **Jeopardy! game format** to encourage active student engagement, critical thinking, and creative use of target language structures.

Unlike standard Jeopardy!, this tool focuses on **question-formulation and answer-construction**, forcing students to manipulate specific vocabulary in context rather than simply recalling definitions.

## 🎯 Educational Goals
*   **Active Recall:** Students must construct original questions using target phrases, requiring them to understand the nuance of the vocabulary.
*   **Creative Output:** The "Answerer" role requires students to generate coherent, context-appropriate responses in real-time.
*   **Peer Interaction:** The game structure naturally divides the class into pairs or groups for turn-based interaction.
*   **Immediate Feedback:** A built-in scoring system provides instant feedback on question quality and answer length/depth.

## 🛠️ Key Features

### 1. Flexible Content Setup
Teachers can easily customize the lesson content in real-time:
*   **Categories:** Add between 3 and 5 thematic categories (e.g., "Phrasal Verbs," "Business Vocabulary," "Travel").
*   **Vocabulary Lists:** Paste lists of target words or phrases into each category. The system automatically shuffles these terms to ensure a fresh game every time.
*   **Player Management:** Support up to 6 players (students).

### 2. Interactive Gameplay
The game board mimics the Jeopardy! grid:
1.  Players take turns selecting a point value (e.g., 100, 200) from a category.
2.  The selected **Questioner** must formulate an original question using the revealed target phrase.
3.  A random **Answerer** is drawn to respond.

### 3. Dynamic Scoring & Penalties
The app includes a robust scoring modal that allows teachers to reward or penalize based on performance:
*   **Standard Win:** Both participants get half the points.
*   **Questioner Wins:** Full points go to the questioner if their formulation was superior.
*   **Answerer Wins:** Full points go to the answerer for a perfect response.
*   **No Points:** Awarded if both fail.

**Optional Deductions (Quality Control):**
To maintain high standards, teachers can apply automatic deductions before finalizing the score:
*   **"Yes/No" Question Penalty:** If the question is too simple (a binary yes/no), the questioner's points are halved.
*   **Uncreative Question Penalty:** If the question lacks originality, points are reduced.
*   **Short Answer Penalty:** If the answerer gives a brief or incomplete response, their points are reduced.

## 📝 How to Use This Game in Class

1.  **Preparation:** Before the lesson, open the "Setup" screen. Enter your target vocabulary lists and assign them to categories. Add student names.
2.  **Launch:** Click "Start Game." The board will generate a grid based on your input.
3.  **Execution:**
    *   Call out a player name (the system tracks turns automatically).
    *   Ask the current player to select a card value.
    *   When the modal opens, ask the designated **Questioner** to formulate their question aloud.
    *   Select the appropriate outcome from the scoring buttons (e.g., "Both were correct") or apply penalties if the quality was low.
4.  **Review:** After the game ends, the winner is automatically announced via an alert.

## 💡 Why Teachers Should Use This
*   **Zero Setup Friction:** No physical boards to print; everything is generated instantly in the browser.
*   **Student-Centered:** Students perform the cognitive work of creating questions, not just answering them.
*   **Differentiated:** The penalty system allows you to gently challenge students who are struggling with question complexity without stopping the flow of the game.
*   **Customizable:** You can change the categories and vocabulary instantly between different lessons or topics (e.g., switch from "Verbs" to "Adjectives" in minutes).

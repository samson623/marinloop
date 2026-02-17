# 🚨 MEDFLOW AI HEALTHOS HANDOFF 🚨

**Project**: HealthOS (Voice AI Upgrade)
**Goal**: Transform the voice feature from a simple tab-switcher to a context-aware health assistant ("Body" + "Brain").
**Status**: ACTIVE - PHASE 1 IN PROGRESS (Wiring 50% Complete)

## 1. Architecture (The Goal)
We are building a "Health Operating System" with:
*   **Sensors**: Schedule, Adherence, Notifications, Medical Context.
*   **Effectors**: Navigation, Modals (wiring), Form Pre-filling (drafts), Logging.
*   **Brain**: LLM-based Intent extraction (`AIService`).

## 2. Implementation Plan (The Path)
### Phase 1: Cortical Connections (Wiring) - **IN PROGRESS**
*   **Goal**: Ensure `store.openAddMedModal()` works globally.
*   **Why**: The AI (Brain) needs actions (Body) to execute commands.

### Phase 2: Hippocampus (Intelligence) - **NEXT**
*   **Goal**: Connect LLM to understand natural language ("Add Amoxicillin 500mg").
*   **How**: `AIService` extracts JSON -> `store.setDraftMed()` -> Modal pre-fills.

## 3. Current State (Right Now)
*   **DONE**: `src/shared/stores/app-store.ts` updated with `showAddMedModal`, `draftMed`, etc.
*   **DONE**: `src/app/App.tsx` updated to trigger these actions from voice commands.
*   **PENDING**: `src/app/views/MedsView.tsx` still uses local state `useState`. Needs refactor to use `useAppStore`.
*   **PENDING**: `src/app/views/ApptsView.tsx` still uses local state `useState`. Needs refactor to use `useAppStore`.

## 4. Immediate Next Step for Next Agent
1.  **Refactor MedsView**: Replace `const [showAdd, setShowAdd] = useState(false)` with `useAppStore`.
2.  **Refactor ApptsView**: Replace `const [showAdd, setShowAdd] = useState(false)` with `useAppStore`.
3.  **Verify**: Test "Add Medication" voice command opens the modal.
4.  **Start Phase 2**: Implement `AIService` intent parsing.

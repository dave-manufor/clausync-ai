---
trigger: model_decision
description: When working on the web app interface
---

#Application Design System (ADS)\*\*

## **1\. Interface Philosophy**

- **Signal Over Noise:** In a risk intelligence tool, "decoration" is distraction. Color is used strictly to indicate status (Safe/Risk/Action) or hierarchy.
- **Cognitive Comfort:** Legal reviews can take hours. We prioritize high contrast for text and reduced "neon bleed" compared to the marketing site.
- **The "Glass" Hierarchy:** We use depth to manage complexity.

  - _Level 0 (Base):_ The Application Shell.
  - _Level 1 (Content):_ Cards and Data Tables.
  - ## _Level 2 (Float):_ Modals, Dropdowns, and Sticky Headers.

    ## **2\. Design Tokens (The Variables)**

_For Coding Agents: Implement these as CSS Custom Properties allowing instant Theme Switching._

### **2.1 Color Semantics**

We utilize the "Ultrasonic" palette but mapped to functional roles.

| Token Name        | Dark Mode (Default)       | Light Mode (Legal View) | Function                |
| :---------------- | :------------------------ | :---------------------- | :---------------------- |
| \--app-bg         | \#08041E (Ink Black)      | \#F4F5F7 (Pale Slate)   | The global canvas.      |
| \--surface-1      | \#110C2A (Deep Navy)      | \#FFFFFF (White)        | Cards, Sidebar, Tables. |
| \--surface-2      | \#1F1836 (Lighter Navy)   | \#F8F9FB (Off-White)    | Hover states, Inputs.   |
| \--border-subtle  | rgba(161, 124, 255, 0.15) | \#E2E8F0                | Dividers, card borders. |
| \--primary-action | \#5814BA (Ultrasonic)     | \#5814BA (Ultrasonic)   | Primary Buttons.        |
| \--text-main      | \#FFFFFF                  | \#0F172A (Slate 900\)   | Headers, Primary Data.  |
| \--text-body      | \#E2E8F0 (Slate 200\)     | \#334155 (Slate 700\)   | Contract text, labels.  |

### **2.2 Status Colors (The "Traffic Light" System)**

Derived from the PRD requirement for a "Green/Yellow/Red" risk scoring system.

- **Critical (Red):** \#FF4757 (Bg: rgba(255, 71, 87, 0.1))
  - _Use:_ "Material Conflict Detected," "Clause Removed."
- **Warning (Yellow):** \#FDCB6E (Bg: rgba(253, 203, 110, 0.1))
  - _Use:_ "Ambiguous Terms," "Tier 1 Analysis Pending."
- **Safe (Green):** \#2ED573 (Bg: rgba(46, 213, 115, 0.1))

  - _Use:_ "No Changes," "Compliance Verified."

    ### **2.3 Typography**

- **UI Font:** Inter or Plus Jakarta Sans. Optimized for UI labels and buttons.
  - _Weight:_ Regular (400), Medium (500), Bold (600).
- **Reading Font:** Merriweather or Roboto Serif (Optional user toggle).
  - _Use:_ Specifically for the "Document Viewer" pane to mimic paper contracts.
- **Code Font:** JetBrains Mono.

  - ## _Use:_ JSON Diffs, Metadata Hashes, CSS Selectors.

    ## **3\. Application Layout (The Shell)**

    ### **3.1 Sidebar Navigation (Left)**

- **Width:** Fixed 240px (Collapsible to 64px).
- **Appearance:** \--surface-1 with a right border (\--border-subtle). No blur/glass effect here (performance optimization).
- **Logo:** Placed top-left. Text visible only when expanded.
- **Menu Items:**

  - _Active State:_ Background tint of \--primary-action (10% opacity) \+ Left border strip (3px solid \--accent-glow).
  - _Icons:_ Enclosed styling (duotone opacity) inspired by the 'Musemind' dashboard.

    ### **3.2 Top Bar (Global Context)**

- **Height:** 64px. Sticky.
- **Appearance:** Glassmorphic (backdrop-filter: blur(12px)).
- **Elements:**

  - _Breadcrumbs:_ "Monitors \> AWS \> Terms of Service"
  - _Global Search:_ "Search for 'Indemnification'..."
  - ## _User Profile:_ Avatar \+ Dropdown.

    ## **4\. Componentry**

    ### **4.1 Functional Cards (Dashboard Widgets)**

Adapted from the "Bento Grid" concept but strictly functional.

- **Container:** Rounded corners (16px). Background \--surface-1.
- **Header:** Title (Left) \+ Action Icon (Right \- Kebab menu or "Expand").
- **Interaction:**

  - _Hover:_ Slight lift (transform: translateY(-2px)) \+ Border color shift to \--accent-glow.
  - _Loading:_ Use "Shimmer" skeletons (\--surface-2 to \--surface-1 gradient animation), never spinning loaders for whole cards.

    ### **4.2 The "Diff" Viewer (Core Feature)**

This is the heart of the product. It must show "Before" and "After" states clearly.

- **Split View Layout:** Left pane (Original), Right pane (Modified).
- **Visual Language:**
  - _Additions:_ Highlight Green (rgba(46, 213, 115, 0.2)). Text is **Bold**.
  - _Removals:_ Highlight Red (rgba(255, 71, 87, 0.2)). Text is \~\~Strikethrough\~\~.
- **Context Ribbon:** A sticky footer showing the "AI Risk Assessment" (Tier 1 Analysis) summary.

  ### **4.3 Data Tables**

- **Headers:** Uppercase, small text (11px), \--text-muted.
- **Rows:** Height 48px or 60px (Compact/Comfy toggle).
- **Zebra Striping:** No. Use single pixel borders (\--border-subtle) between rows.
- **Row Hover:** Background change to \--surface-2.

  ***

  ## **5\. Data Visualization**

Reference the 'Finexy' and 'ShapeStats' images for chart styling.

### **5.1 Charts**

- **Line Charts:** Smooth curves (Bezier).
  - _Stroke:_ 2px width. Gradient stroke (Start: \--accent-glow, End: Transparent).
  - _Fill:_ Vertical gradient fade below the line (opacity 0.2 to 0).
- **Bar Charts:** Rounded tops (border-radius: 4px 4px 0 0). Solid \--primary-action fill.

  ### **5.2 The "Risk Pulse"**

- Used in the sidebar list of monitored vendors.
- **Implementation:** A 6px circle next to the vendor name.

  - _Green:_ Static.
  - ## _Red:_ Slowly pulsing (CSS animation scale 1 to 1.2).

    ## **6\. Frontend Implementation Notes (Rules for Agents)**

    ### **6.1 Dark/Light Mode Logic**

- **Default:** Dark Mode (Command Center feel).
- **Switching:** Use a data-theme="light" attribute on the \<html\> tag.
- **Shadows:**

  - _Dark Mode:_ 0 4px 20px rgba(0,0,0, 0.5) (Heavy, diffuse).
  - _Light Mode:_ 0 2px 8px rgba(0,0,0, 0.05) (Subtle, crisp).

    ### **6.2 Accessibility (a11y)**

- **Contrast:** Ensure \--text-muted on \--app-bg passes WCAG AA (4.5:1).
- **Focus States:** Do not rely on color alone. Inputs and buttons must have a visible ring (2px solid \--accent-glow) on focus.

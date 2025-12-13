---
trigger: model_decision
description: When working on the landing page
---

# **Clausync.ai | Design System & Interface Guidelines**

Version: 2.0 (Deep Intelligence)

Target Audience: UI/UX Engineers, Frontend Developers, AI Coding Agents

## **1\. Core Design Philosophy**

Our interface is not just a tool; it is a **Command Center**. It must feel stable, fast, and perceptive.

- **Principle 1: The Void & The Light.** We use deep, near-black backgrounds ("The Void") to minimize eye strain. Information ("The Light") glows against this canvas. We do not use "flat" colors; we use luminance to indicate importance.
- **Principle 2: Cognitive Clarity.** Legal data is dense. Our UI strips away decoration. If an element doesn't help the user understand a risk, it doesn't belong.
- **Principle 3: Fluid Depth.** We use **Glassmorphism** and subtle gradients to create a sense of layering. The "Content" floats above the "Background," and "Alerts" float above the "Content."

---

## **2\. Design Tokens (The Variables)**

_For Coding Agents: Implement these as CSS Custom Properties (Variables) at the :root level._

### **2.1 Color Palette (From Source)**

We utilize the provided "Ultrasonic" palette to create a high-contrast dark mode.

| Token Name       | Hex Value     | Usage Principle                                                                             |
| :--------------- | :------------ | :------------------------------------------------------------------------------------------ |
| \--surface-void  | **\#08041E**  | **The Global Background.** All pages start here. It is deep, ink-black with a hint of navy. |
| \--primary-brand | **\#5814BA**  | **The Action.** Primary buttons, active toggles, and key brand moments.                     |
| \--accent-glow   | **\#A17CFF**  | **The Focus.** Focus rings, toggle switches, and subtle gradients. High energy.             |
| \--accent-soft   | **\#BFC0FF**  | **The Support.** Secondary borders, unselected icons, or subdued text links.                |
| \--text-main     | **\#FFFFFF**  | **The Signal.** Primary headers and body text.                                              |
| \--text-muted    | _Opacity mod_ | Use \--text-main with 0.6 opacity for metadata/labels.                                      |
| \--semantic-risk | \#FF4757      | _Derived._ Use for "Material Conflict" or critical alerts.                                  |
| \--semantic-safe | \#2ED573      | _Derived._ Use for "No Changes" or success states.                                          |

### **2.2 Typography**

We prioritize readability and geometric precision.

- **Font Family:** Inter, Outfit, or DM Sans (Clean, modern sans-serif).
- **Code Font:** JetBrains Mono or Fira Code (For JSON diffs and contract clauses).

**Scale Principles:**

- **Headings:** Tight letter spacing (\-0.02em). Bold weights.
- **Body:** Relaxed letter spacing (0em or \+0.01em). High legibility.
- **Captions/Labels:** Uppercase, wide tracking (\+0.05em), muted color.

---

## **3\. Component Library (Atomic Guidelines)**

### **3.1 The "Glass" Card (Container Molecule)**

Instead of solid borders, we use depth and light.

- **Background:** Use a low-opacity white or brand color fill (e.g., rgba(255, 255, 255, 0.03)).
- **Backdrop Filter:** Apply blur(12px) to create the "frosted glass" look over the deep background .
- **Border:** A subtle "shine" gradient border. Top-left is lighter (rgba(255, 255, 255, 0.1)), bottom-right is invisible.
- **Shadow:** Large, diffuse colored shadows (box-shadow: 0 20px 40px \-10px rgba(88, 20, 186, 0.2)).

### **3.2 Buttons & Actions**

- **Primary Button:**
  - **Fill:** Solid \--primary-brand (\#5814BA).
  - **Glow:** On hover, emit a subtle shadow matching the fill color.
  - **Text:** White, bold.
- **Secondary/Ghost Button:**
  - **Fill:** Transparent.
  - **Border:** 1px solid \--accent-soft (\#BFC0FF).
  - **Hover:** Fill with 10% opacity \--accent-soft.

### **3.3 Gradients & "The Aurora"**

To break up the darkness, use "Auroras"—soft, blurred blobs of color positioned behind key UI elements.

- **Usage:** Place a large, highly blurred circle of \--primary-brand or \--accent-glow behind the main dashboard chart or the primary CTA.
- **CSS Reference:** filter: blur(100px); opacity: 0.4;

---

## **4\. Layout & Spacing**

### **4.1 The Grid**

- **Fluidity:** Use a 12-column fluid grid.
- **Margins:** Generous. In a data-heavy tool, whitespace (or "void-space") is the only way to prevent cognitive overload.
- **Gap:** Use a standardized 8pt grid scale (8px, 16px, 24px, 32px).

### **4.2 Dashboard Composition**

- **Navigation:** Vertical sidebar on the left. Darkest shade of glass (\--surface-void with a subtle overlay).
- **Header:** Minimal. Just the search bar and context. Blends into the background.
- **Canvas:** The center stage. Where the "Cards" float.

---

## **5\. Data Visualization (The "Intel" Layer)**

We are visualizing risk, not just data.

- **Charts:** Do not use solid fills. Use **Gradient Strokes** (Line charts that fade from opaque to transparent).
- **Risk Indicators:**
  - _High Risk:_ Pulsing \--semantic-risk dot.
  - _Safe:_ Static \--semantic-safe ring.
- **Diff Views:**
  - _Removed Text:_ Red background with strikethrough (low opacity).
  - _Added Text:_ Green/Blue background (low opacity). highlighting the exact change.

---

## **6\. Motion & Interaction (The Feel)**

- **Speed:** Interactions should feel "snappy" (150ms \- 200ms).
- **Easing:** Use ease-out for entering elements (they slide into place confidently).
- **Micro-interactions:**
  - _Hover:_ Elements should subtly "lift" (scale up 1.02x) or brighten (brightness 110%).
  - _Click:_ Elements should subtly compress (scale down 0.98x).

---

## **7\. Frontend Implementation Guide (For Agents)**

**Tailwind CSS Config Example:**

JavaScript  
module.exports \= {  
 theme: {  
 extend: {  
 colors: {  
 void: '\#08041E', // The infinite background  
 brand: '\#5814BA', // The primary energy  
 glow: '\#A17CFF', // The neon accent  
 mist: '\#BFC0FF', // The subtle support  
 },  
 backgroundImage: {  
 'glass-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',  
 },  
 boxShadow: {  
 'neon': '0 0 20px rgba(161, 124, 255, 0.3)',  
 }  
 }  
 }  
}

**CSS Glassmorphism Class:**

CSS  
.glass-panel {  
 background: rgba(8, 4, 30, 0.7); /\* Void color with transparency \*/  
 backdrop-filter: blur(16px);  
 \-webkit-backdrop-filter: blur(16px);  
 border: 1px solid rgba(191, 192, 255, 0.1); /\* Periwinkle hint \*/  
 box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);  
}

## **8\. Landing Page Architecture**

**Goal:** To immerse the user in the "Command Center" immediately. The page should feel like a portal to a secure, intelligent infrastructure, not just a marketing brochure.

### **8.1 Global Page Styles**

- **The Canvas:** The entire page sits on the `--surface-void` (`#08041E`) background. Do not use white or light gray sections.
- **The Geometry:**
  - **Cards:** Use `border-radius: 24px` (Smooth, engineered curves).
  - **Buttons:** Use `border-radius: 8px` (Precise, clickable).
- **The Atmosphere:** Use the **"Aurora"** effect heavily. Place large, blurred blobs of `--primary-brand` and `--accent-glow` behind the Hero image and the Final CTA to create depth without clutter.
- **Texture:** Overlay a subtle **Noise Texture** (5% opacity) on the background to prevent color banding and add a "tactile" security feel.

### **8.2 Section Breakdown**

#### **A. The Hero (The Command Center)**

- **Layout:** Centered alignment.
- **Typography:**
  - **Headline:** Massive scale (H1). Gradient text using `--accent-glow` to `--text-main`.
  - **Sub-headline:** `--text-muted`. Max-width 600px.
- **Visual Anchor:** A 3D-perspective "Floating Dashboard."
  - Effect: The interface tilts backward slightly (Perspective: 1000px, RotateX: 10deg).
  - Glow: A strong outer shadow (`box-shadow: 0 0 80px rgba(88, 20, 186, 0.4)`) lifts it off the Void.
- **Trust Signal:** A monochromatic opacity strip of client logos (e.g., "Trusted by 50+ Legal Teams") sitting quietly at the bottom of the viewport.

#### **B. The "Bento" Grid (Feature Intelligence)**

- **Concept:** Modular intelligence. A grid of varying aspect ratios (1x1, 2x1) showcasing specific capabilities.
- **Card Style:**
  - **Background:** The standard "Glass Panel" (`rgba(255, 255, 255, 0.03)` \+ Blur).
  - **Border:** `1px` solid border using a linear gradient (Top-Left `--accent-soft` to Bottom-Right Transparent).
- **Content Archetypes:**
  - The Metric Card: A single large number (e.g., "99.9% Sync") in `--accent-glow`.
  - The Focus Card: A zoomed-in UI snippet showing the "Risk Pulse" dot in action.
  - The Insight Card: A short text block describing AI analysis.

#### **C. The Neural Flow (Process Visualization)**

- **Concept:** Visualize the invisible. Show how Clausync sits between the Enterprise and the Vendor.
- **The Schematic:**
  1. **Input Node:** Icon representing "Vendor Site" (dim/static).
  2. **The Processor:** The central Clausync logo, glowing intensely. Animated connection lines flow into it.
  3. **Output Node:** A "Secure Shield" icon turning green, representing the output report.
- **Style:** Line art only. Use thin, crisp lines (`1px` `--accent-soft`) with small moving dots along the paths to imply data transmission.

#### **D. The Interactive Preview**

- **Layout:** Full-width container.
- **Content:** A high-fidelity, non-tilted view of the interface.
- **Interactivity:**
  - Simulate a "Live Scan."
  - Animate a cursor hovering over a "Change Detected" alert.
  - On hover, the alert expands to show the diff (Red background for removed text, Green for added).

#### **E. The "Vigilant" Testimonials**

- **Structure:** Horizontal scrolling strip (Carousel).
- **Card Design:** Smaller glass panels.
- **Avatar:** Enclosed in a `--primary-brand` ring.
- **Rating:** Use 5 stars in `--accent-glow` (avoid generic yellow).

#### **F. The Footer & Final Call**

- **The "Warp Speed" CTA:**
  - A floating box separated from the footer.
  - **Background:** A deep vertical gradient (`#5814BA` to `#08041E`).
  - **Action:** "Initialize Monitoring" (Primary Button).
- **Footer Base:**
  - **Logo:** Large, watermarked version of the `clausync` logotype (10% opacity) spanning the width.
  - **Links:** Organized in simple columns. Text is `--text-muted` until hovered (transitions to `--text-main`).

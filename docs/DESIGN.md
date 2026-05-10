---
name: Echo Narrative Intelligence
colors:
  surface: '#06151e'
  surface-dim: '#06151e'
  surface-bright: '#2c3b45'
  surface-container-lowest: '#021018'
  surface-container-low: '#0e1d26'
  surface-container: '#12212a'
  surface-container-high: '#1d2c35'
  surface-container-highest: '#283740'
  on-surface: '#d5e5f1'
  on-surface-variant: '#c4c6cc'
  inverse-surface: '#d5e5f1'
  inverse-on-surface: '#23323c'
  outline: '#8e9196'
  outline-variant: '#44474c'
  surface-tint: '#bac8dc'
  primary: '#bac8dc'
  on-primary: '#243141'
  primary-container: '#0d1b2a'
  on-primary-container: '#768497'
  inverse-primary: '#525f71'
  secondary: '#d3c5aa'
  on-secondary: '#382f1d'
  secondary-container: '#4f4631'
  on-secondary-container: '#c1b49a'
  tertiary: '#fbb980'
  on-tertiary: '#4c2700'
  tertiary-container: '#2c1400'
  on-tertiary-container: '#af7644'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e4f9'
  primary-fixed-dim: '#bac8dc'
  on-primary-fixed: '#0f1c2c'
  on-primary-fixed-variant: '#3a4859'
  secondary-fixed: '#f0e1c5'
  secondary-fixed-dim: '#d3c5aa'
  on-secondary-fixed: '#221b0a'
  on-secondary-fixed-variant: '#4f4631'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#fbb980'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#693c0e'
  background: '#06151e'
  on-background: '#d5e5f1'
  surface-variant: '#283740'
typography:
  case-file-title:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  document-body:
    fontFamily: Courier Prime
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  ui-control:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  handwritten-note:
    fontFamily: Courier Prime
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label-small:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
spacing:
  margin-page: 40px
  gutter-grid: 24px
  unit-base: 8px
  stack-tight: 4px
  stack-loose: 32px
---

## Brand & Style
The design system is rooted in the "Detective Noir meets Vintage Archive" aesthetic, designed to transform a digital tool into a physical-feeling investigative experience. The target audience is writers, roleplayers, and creators who value immersion and storytelling. 

The visual language rejects modern glass or flat surfaces in favor of high-fidelity textures. It utilizes a skeuomorphic-lite approach, where the interface feels like an organized mess of evidence on a desk. The emotional response should be one of "cracking the case"—evoking the focused, quiet intensity of a 1940s archive room. The UI does not just facilitate AI creation; it serves as the detective’s dossier.

## Colors
The color palette is built on the high-contrast tension between shadows and illuminated documents. 
- **Deep Navy & Charcoal Gray:** Form the base of the interface, representing the dimly lit office or "the void" where AI characters emerge.
- **Parchment Beige:** Used for primary containers (files, notes), providing a warm, high-contrast surface for readability.
- **Sepia:** Used for borders, subtle highlights, and "aged" states.
- **Evidence Red:** A critical accent color used exclusively for destructive actions, high-priority alerts, or "marked" evidence.
- **Ink Blue:** Used for hyperlinks and secondary controls, mimicking the look of a fountain pen mark on a page.

## Typography
The typographic strategy creates a clear distinction between "The System" and "The Content."
- **System Controls:** Use **Hanken Grotesk**. This clean, modern sans-serif represents the "Echo" tool itself—functional, sharp, and authoritative. It is frequently used in all-caps for labels to mimic institutional stamps or headers.
- **The Dossier:** Use **Courier Prime**. All user-generated content, character descriptions, and AI responses are rendered in this typewriter face. It conveys the feeling of a drafted report or an official statement.
- **Hierarchies:** Large headers should feel like stamped ink or bolded file headings, while body text should maintain the rhythmic spacing of a mechanical typewriter.

## Layout & Spacing
The layout follows a "Desktop Surface" philosophy. It uses a fixed-grid system (12 columns) for core navigation, but inner content areas behave like a **Physical Archive**. 
- **Containers:** Content is housed in "File Folders" or "Clipboards" that overlap slightly to create a sense of physical stacks.
- **Rhythm:** Spacing is generous but irregular. Elements are not always perfectly aligned to the pixel, suggesting the organic placement of documents on a corkboard.
- **Margins:** Wide margins (40px) around the main viewport simulate the frame of a workspace.

## Elevation & Depth
Depth is conveyed through **Tactile Layering** rather than traditional drop shadows.
- **The Foundation:** The bottom layer is the "Corkboard" or "Dark Wood Desk," featuring a subtle grain texture and Deep Navy/Charcoal gradients.
- **The Document Layer:** Surfaces like Parchment Beige use a slight inner shadow to appear recessed or "pressed" onto the desk, or a hard, high-offset shadow (Evidence Red or Dark Blue) to appear like a thick folder.
- **Stacking:** Each new "window" or character profile is a new "folder tab." Shadows are tight and high-opacity, mimicking the thin gap between stacked sheets of paper.
- **Interactive Depth:** Hovering over a file tab should cause it to "lift" slightly (increase shadow spread and scale by 1.02x).

## Shapes
This design system utilizes **Sharp** edges (0px) for almost all primary containers to maintain the appearance of cut paper and rigid folders. 
- **Folders:** The only exception is the "Folder Tab" shape, which uses a 45-degree angle or a very slight (2px) corner on the top right to distinguish it as a physical tab.
- **Buttons:** Buttons are perfect rectangles, resembling rubber stamps or physical toggle switches.
- **Divider Lines:** Lines should appear as "scores" in the paper or ink-drawn strokes, sometimes with intentionally frayed or textured edges.

## Components
- **Buttons (Stamps):** Primary buttons should look like "Approved" stamps. They feature a heavy border (2px), all-caps text, and a slight "ink splatter" texture. On click, they shift 2px down/right to simulate being pressed.
- **Tabs (File Folders):** Navigation tabs are styled as physical folder tabs at the top of a container. Active tabs are Parchment Beige; inactive tabs are Sepia or Deep Navy.
- **Inputs (Typewriter Fields):** Input fields should not have boxes. Instead, use a single horizontal line (Ink Blue) to mimic a form. As the user types, the text appears in Courier Prime.
- **Cards (Evidence Cards):** Used for character snippets. They include a small "paperclip" icon in the top right corner and a subtle "coffee stain" or "crease" background texture.
- **Checkboxes (X-Marks):** When checked, a checkbox should display a handwritten "X" in Evidence Red, appearing as if a detective marked it with a wax pencil.
- **Progress Bars (Ink Level):** Progress is visualized as a line of ink being drawn across the page, with an uneven, bleeding edge at the tip.
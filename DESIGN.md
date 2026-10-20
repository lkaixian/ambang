# AMBANG design direction

Written by the agent from the choices already in the dashboard, not from a brief. It is a draft for the owner to correct: edit anything that is wrong, and the UI should follow.

## Read
Reading this as: an analyst and policymaker early-warning tool for Malaysian island and highland tourism, in a calm, evidence-first style, dial ENERGY 1 / RHYTHM 2 / MOTION 2.

## Dials
- **ENERGY 1.** Users act on numbers that may mean closing a place. The page stays quiet and lets the score and its band be the loudest thing on screen.
- **RHYTHM 2.** Consistent card system with deliberate breaks: the overview stat row is a grid, the AI brief is a tinted band instead of another white card, the triage board is rows with a coloured edge, the calendar is a heat grid.
- **MOTION 2.** Motion only shows change: numbers count and bars, lines and map colours ease when the weights switch; the chat window pops from its button. No entrance animation on cards.

## Palette (and why)
- Ink `#0F2429` / `#40595E` / `#576F74`: dark teal-black for text so the page reads as paper, not as a screen. The lightest ink is kept at 4.5:1 or better.
- Paper `#F1F5F5`, white cards: low-glare background so the coloured bands are the only strong colour.
- Band colours: Normal teal `#157F6C`, Warning amber `#B8791A`, Alert coral `#C4442C`, Critical deep red `#7E2216`. Colour carries meaning (risk band) and nothing else, so every band is also named in text.
- One tinted surface, teal-bg `#E3F0EC`, marks the AI-written content so it is never mistaken for measured data.

## Type
- IBM Plex Sans for reading, IBM Plex Mono for every number. Reason: tabular figures keep scores, weights and counts aligned in tables and while they count, and the pair is neutral enough not to compete with the data.

## Shape and depth
- Small radius (3px) and 1px borders, no resting shadows. Reason: reads as a document or report; elevation is not used to rank anything.
- Pills only for status (band names, counts), never as decoration.

## Identity motif
- The four-band score bar: the same Normal / Warning / Alert / Critical segments appear as the map legend, the What-if chart zones, the triage rows' coloured edge and the pills.

## Decisions to revisit
- The product name is text only; there is no logo yet (placeholder by choice, see R-23).
- No dark theme is shipped. If one is added, both themes must be verified (R-34).

# ScoutReport UI

## Brand tokens

Use the exported `brandTokens`, CSS variables in `src/tokens.css`, or the
Tailwind preset (`tailwind.preset.ts`) instead of hardcoding brand colours in
application components.

| Token       | Value     | Usage                                          |
| ----------- | --------- | ---------------------------------------------- |
| `bg`        | `#0B0518` | Main dark background                           |
| `accent`    | `#FF0052` | Primary actions; use dark text on this colour  |
| `secondary` | `#70408F` | Borders, chips and decoration; never body text |
| `surface`   | `#160D26` | Raised content surfaces                        |
| `border`    | `#70408F` | Borders                                        |
| `text`      | `#FFFFFF` | Main text                                      |
| `muted`     | `#C4B8D6` | Muted text                                     |
| `success`   | `#4ADE80` | Success feedback                               |
| `warning`   | `#FACC15` | Warning feedback                               |
| `danger`    | `#FB7185` | Danger feedback                                |

### Contrast

| Foreground          | Background          | Contrast | Guidance                |
| ------------------- | ------------------- | -------- | ----------------------- |
| White `#FFFFFF`     | `#0B0518`           | 20:1     | Pass                    |
| Accent `#FF0052`    | `#0B0518`           | 5.1:1    | Pass                    |
| White `#FFFFFF`     | Accent `#FF0052`    | 3.9:1    | Large or bold text only |
| Secondary `#70408F` | `#0B0518`           | 2.7:1    | Decorative use only     |
| White `#FFFFFF`     | Secondary `#70408F` | 7.5:1    | Pass                    |

Do not use the secondary colour for body text. Primary buttons use the
background colour for their text.

## Logo icons

`pnpm --filter @scoutreport/ui generate-icons` resizes only the supplied
`apps/web/public/brand/scoutreport-x-avatar.png` to favicon, Apple touch and
app-icon sizes. The source image also serves as the default Open Graph image.

The interface uses the system font stack; no additional brand assets or fonts
are required.

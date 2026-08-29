# Design system — "the shared fridge board"

Kasama's job is to digitise something people already have: the whiteboard or the pile of
sticky notes on a shared fridge. So cards read like pinned notes, the board reads like
handwriting, and anything with a ledger quality — pesos, due dates, timestamps — is set in
mono.

**Tokens** live in two places that must stay in step: `src/lib/theme.ts` for values that
have to be passed as props (icon tints, `RefreshControl`, placeholder text) and
`tailwind.config.js` for the class names. Same hexes, same names.

| Token | Use |
| --- | --- |
| `canvas` | The ground a screen sits on — the fridge door behind the notes |
| `paper` | Every card, lifted off the canvas. The one card surface in the system |
| `page` | Recessed: pressed states, progress tracks, inset counters. Deep enough that pressing a card is visible |
| `line` | Hairline borders and dividers |
| `ink` / `ink-soft` / `ink-muted` | Text, in descending emphasis. `ink-faint` is decorative only |
| `moss` / `moss-light` | Primary actions, active tab, "done" |
| `mustard` | Money, "due soon", the default washi tape |
| `brick` | Overdue, destructive, anything needing chasing |
| `sage` | Settled, calm accents, streaks |
| `slate` | Informational: hints, callouts, "here is something to know". Promoted out of the category tints, so it adds a voice without adding a hue |
| `wash-*` / `deep-*` | Derived pale fills and their readable foregrounds, for pills and banners |
| `bezel` | Warm near-black, used for shadows rather than pure black |

**Type.** React Native matches a custom face by family name alone, so every weight is
registered separately and reached by family, not by `font-bold`:

| Class | Face | Use |
| --- | --- | --- |
| `font-sans` `font-ui` `font-ui-semibold` `font-ui-bold` `font-ui-black` | Manrope | All UI text |
| `font-hand` `font-hand-bold` | Caveat | Greetings, board posts, "your turn" — never buttons or labels |
| `font-mono` `font-mono-bold` | IBM Plex Mono | Peso amounts, due dates, timestamps |

Caveat is a delight, not a voice: if it starts appearing on labels and buttons it stops
being special and starts being hard to read. The faces load through `expo-font` in
`app/_layout.tsx`, behind the native splash — a handwriting-led layout that reflows after
first paint reads as a rendering bug.

**Components.** `NoteCard` is the base surface (paper, hairline border, warm shadow,
optional `Tape` and a fraction of a degree of pin skew). `Tape` is the decorative strip at a
card's top-left, hidden from screen readers. `Pill` is the status badge. `Avatar` carries a
paper ring so faces can overlap. `BoardTabBar` replaces react-navigation's default bar.
Status never rides on colour alone — every pill pairs its tone with a word and a glyph.

## Motion

Motion tokens follow the same two-places rule as colour: `src/lib/motion.ts` for the values
JS drives (curves, durations, springs) and `tailwind.config.js` for the two easing classes.
Nothing in the app animates on a number typed at the call site.

| Token | Value | Use |
| --- | --- | --- |
| `ease-out-strong` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entrances, exits, anything answering a touch |
| `ease-in-out-strong` | `cubic-bezier(0.77, 0, 0.175, 1)` | Something moving while it stays on screen |
| `press` / `pressSmall` / `pressLarge` | 100ms, `scale` 0.97 / 0.96 / 0.94 | Press feedback, sized to the target |
| `duration.state` / `.panel` / `.fill` | 150 / 240 / 320ms | A state flip, a card arriving, a progress bar travelling |

There is no `ease-in` token. It starts slow, which delays the exact moment the user is
watching.

Three rules decide whether something animates at all:

- **Frequency sets the budget.** The tab rail is tapped dozens of times a day, so it
  switches instantly and always will — four tabs are peers, and a transition there is a tax
  paid on every switch. Press feedback is felt rather than watched, so it gets 100ms.
  Sheets, dialogs and a chore leaving its section get a real animation. Nothing gets more.
- **Press feedback starts on press-*in*.** Waiting for the tap to complete is the latency
  people actually notice. The dip is on the whole surface so the label and icon travel with
  it, which is what makes it read as something physical rather than a colour swap.
- **Reduced motion ships with the animation.** Every entrance, exit and layout transition
  carries `ReduceMotion.System`, the stack cross-fades instead of sliding, and the loading
  skeletons hold a dimmed state instead of pulsing. Movement goes; the opacity and colour
  changes that explain *what* happened stay.

The class-driven transitions compile through NativeWind to Reanimated shared values, so they
run on the UI thread — they keep going while the JS thread is busy with the fetch that
prompted them. Two things bite when adding one: the `transition-*` class has to be on the
element from its first render (NativeWind upgrades a component to an animated one once, and
adding it later remounts the component), and a `transform` in the `style` prop beats the
class that drives the press dip and silently cancels it. `NoteCard` puts its pin-skew on a
wrapper for that second reason.

## Every screen draws its own header

There is no native header anywhere in the app. `ScreenHeader` sits on the tabs, `FormHeader`
on everything in the root stack, and `Stack` is configured `headerShown: false` throughout.

That is a bug fix, not a preference. react-navigation's header on Android is a platform
Toolbar that pads itself in `CustomToolbar.onApplyWindowInsets`; under `edgeToEdgeEnabled`
it never got a status bar inset here, so on the form screens the title drew on top of the
clock and the back arrow sat under the camera cutout. Pushing those screens instead of
presenting them didn't move it. Nor did declaring `statusBarTranslucent`, which is the knob
react-navigation reads to decide the same thing.

`SafeAreaView` doesn't depend on that inset dispatch reaching it — it re-reads
`rootWindowInsets` off the root view on every pre-draw — and it is what the tab screens have
always used, which is why the bug never reached them.

One wrinkle worth knowing before touching `FormScreen`: a `SafeAreaView` insets by the
*nearest provider's* safe area, not by its own position on screen. With a single provider at
the app root, a screen presented as a sheet on iOS would be padded as though it started at
the top of the display, opening a status bar's worth of empty space above its title. So
`FormScreen` nests a `SafeAreaProvider` of its own, and the inset gets measured where the
screen actually is. Nothing has to be guessed from the platform or the presentation, which
is what the two failed attempts had in common.

## The mark

Kasama's icon is a paper note pinned up with a strip of washi tape across its top-left
corner — the same device `Tape.tsx` draws on every card, rather than a letter in a rounded
square. At 48px on a home screen a "K" has to compete with every other app whose icon is its
initial; the tape belongs to this app and nothing else.

`tools/generate-icons.py` renders the whole set from one function (Pillow, and nothing the
app itself depends on):

```
python3 tools/generate-icons.py
```

| Asset | Notes |
| --- | --- |
| `icon.png` | 1024², opaque and full bleed — iOS applies its own mask and rejects transparency |
| `android-icon-{background,foreground,monochrome}.png` | The note is drawn small enough to survive Android's circle, squircle and teardrop masks; the tape overhang is allowed past that line |
| `splash-icon.png` | The tile is drawn into the image, so the handover from launcher to splash is one object twice rather than two pictures |
| `favicon.png` | Full bleed; a rounded corner is a wasted pixel at 16px |
| `notification-icon.png` | Android keeps only the alpha, so this is one flat shape on transparent. Feed it the colour icon and every notification arrives as a white blob |

`LogoMark` in `src/components/ui/Logo.tsx` draws the same geometry in views, for the auth
screens and the cold-start frame. Change one, change the other.

## Text size

Text scales with the reader's setting by default, and that default is the point: body copy,
headings, card titles, hints and empty states are all left alone to grow.

`textCap` in `src/lib/theme.ts` names the four exceptions, for text inside a box that cannot
grow with it — where the alternative to a cap isn't bigger text, it's clipped text. Anything
capped has to carry its meaning somewhere else too: the week strip spells each day and its
count out in its accessibility label, the tab bar keeps its icons, the swipe panels keep
their glyphs, and an avatar's initials always sit beside the name they stand for.

| Cap | For |
| --- | --- |
| `fixed` (1) | Cannot grow at all — a count inside an 18pt badge |
| `grid` (1.2) | One of N cells sharing a row: the week strip, the day grid |
| `control` (1.3) | A label inside a control that can stretch a little: chips, swipe panels |
| `inline` (1.5) | A label riding beside body text: pills, the "your turn" tag |

## Where the design outran the schema

Three things the design asked for had no column behind them. They were flagged rather than
faked, and have since been built:

| Design element | Where it lives now |
| --- | --- |
| Chore streaks | `chore_streaks`, a `security_invoker` view. Walking a housemate's turns newest-first, count the finished ones until a missed turn; a turn that is open but not yet late is skipped rather than treated as a break |
| Tape colour per note | `announcements.tape_color`, a palette *token* rather than a hex, so re-tuning a colour isn't a data migration. Notes written before the column keep a colour hashed from their id |
| Pinned notes | `announcements.pinned`, plus `set_announcement_pinned()`. Pinning is open to the whole household while editing stays with the author — see the migration for why those can't share one policy |
| A receipt on a note | `announcements.image_path` plus the private `receipts` bucket. The photo is what the house checks a total against, so it belongs on the post that asks — see [Data model](data-model.md) |

## One palette, everywhere

The design brief originally covered only Home, Bills, Chores and the Board; onboarding,
settings, auth and the detail modals kept the teal/coral/sand scales the app shipped with,
so the app rendered in two visual languages at once. Those scales are gone. Every screen now
draws in the tokens above.

The same pass fixed a quieter bug on those screens: they styled text with Tailwind's
`font-bold` and `font-semibold`, which do nothing here — React Native matches a custom face
by family name, so a "bold" heading was rendering at regular weight. They now use the
`font-ui-*` families like the rest of the app.

There is no deprecated scale left in `src/lib/theme.ts`. If a screen needs a colour that
isn't in the table above, that's a design decision, not a local one.

## Language

The interface is written in English throughout — screens, alerts, form hints, push
notification copy, and the bodies `pending_reminders()` composes in SQL. "Kasama" stays as
the product name.

# Create an event

An organizer names a meeting, picks a time, and lands on the event page with an invite link to send to friends.

## Sub-features

- `create-desktop` creates an event from the home page form at desktop width.
- `create-phone` creates an event from the phone layout, which defaults the time to the next evening slot.
- `create-invite` shows the short invite link `/m/<code>` in the share dialog.

## How to get to it (user POV)

- Open `/` on a desktop browser and fill the form beside the headline.
- Open `/` on a phone and type a name on the invitation card.
- Choose a meeting-type chip such as `Group dinner` to fill the occasion.

## Driving it with drive.mjs

Preconditions:

- Doctor exits 0.

- **Desktop.** Run `node .claude/skills/verify-where2meet/scripts/drive.mjs create-event`. The flow fills textbox `Occasion`, opens button `Pick a date and time`, chooses `Go to the Next Month`, the first enabled day and `18:00`, fills textbox `Your name`, and chooses `Create Meeting`. The URL becomes `/meet/evt_<id>` and the document title starts with the event title.
- **Phone.** Run `node .claude/skills/verify-where2meet/scripts/drive.mjs create-event --phone`. The flow fills textbox `Event name`, presses Enter to close the keyboard, and chooses `Start planning`.
- **Invite link.** Both runs choose the banner button `Share event` (desktop) or `Share` (phone) and read the text that ends in `/m/<code>`. `result.json` holds it as `invite`.
- **Proof.** Run `.claude/skills/verify-where2meet/scripts/sql.sh "select id, title, meeting_time from event order by created_at desc limit 1"`. The row has the `title` and `eventId` from `result.json`.

## Gotchas

- The home page form changes after hydration. Wait for network idle before typing, as the flow does.
- Days before today are disabled in the calendar, so the flow picks a day in the next month.
- The phone card hides `Start planning` while textbox `Event name` has focus.
- The phone layout names the organizer `Organizer`. The desktop layout uses the name typed in `Your name`.
- A `Save this plan` sign-in dialog can open on the event page. The flow chooses `Not now`.

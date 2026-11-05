# Toasts and messages: how we use them

A toast is a small message that appears for a few seconds. Use it sparingly. Most actions do not need one, because the screen already shows the result.

## When to use what

| Situation | Use | Example |
|---|---|---|
| The result is visible on screen | **Nothing** | Like, follow, bookmark, post a comment, save a job or a wishlist item |
| The result is out of sight | **A toast** | "Link copied", "Request sent", "Sent for second approval" |
| The person can reverse it | **A toast with Undo** | "Post hidden", "Muted @sam", "Muted \"spoilers\"" |
| A form field is wrong | **A message next to the field** | "Username is taken" |
| A problem that stays | **A banner** | "You are offline" |
| Serious or cannot be undone | **A dialog** | "Delete your account?" |
| Something failed | **An error toast** that says what failed and what to do | "Could not follow. Check your connection and try again." |

## Web

```ts
const { toast } = useToast();       // or: import { toast } from '@/hooks/use-toast'

toast.success('Saved');
toast.error('Could not save', friendlyError(err));
toast.warning('This takes a while');
toast.info('Sent for second approval', 'A different admin has to approve it.');
toast.undo('Post hidden', () => unhidePost(...), "We'll show fewer posts like this.");
toast({ title, description, variant });   // the general form still works
```

What the system does for you:
- **Looks:** success (green edge), warning (amber), info (blue), error (red). Shown on every screen size, at the top on a phone and the bottom right on a wide screen.
- **Time on screen:** longer for long messages, at least 7 seconds for an error, at least 8 seconds when there is an Undo button.
- **A bare "Error" title** becomes "Something went wrong". A bare "Success" is replaced by its description.
- **The same message is not shown twice** at once. At most three are shown together.
- **Screen readers:** errors are read out at once, everything else at the next pause.

## Mobile

`Alert.alert(...)` with no buttons, or one button, is shown as a toast (see `ToastContext`). Two or more buttons open a dialog.

```ts
showToast({ title: 'Post hidden', message: '...', type: 'info', action: { label: 'Undo', onPress: () => ... } });
```

- Toasts wait in a queue (at most three) instead of replacing each other.
- The button on a toast runs its action once.
- The colour comes from `type`. When you use `Alert.alert`, it is guessed from the words, and a sentence with "not", "could not" or "unable" counts as an error.
- Time on screen follows the length of the message. A small buzz happens only for errors and warnings.
- Screen readers announce each toast.

## Writing the message

- Say what happened, in sentence case: "Could not save your changes", not "Error".
- Say what to do when there is something to do: "Check your connection and try again."
- Never show raw system text. Pass a caught error through `friendlyError(err, 'Could not save')` (from `@cinecraft/core`). Messages we wrote ourselves pass through; database, network and session errors are replaced.
- Use the same words on web and mobile.

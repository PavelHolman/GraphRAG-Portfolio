<script lang="ts">
  // Centred chat: answer caption above a bottom pill field. Ghost hints cycle in the field; an empty
  // submit plays the hint shown. docs/spec/chat.md, winning variant B.
  import { untrack } from 'svelte';
  import Answer from './Answer.svelte';
  import type { Message } from './types.ts';

  interface Props {
    messages: Message[];
    followups: string[];
    hint: string;
    streaming: boolean;
    focused: string | null;
    onsend: (prompt: string) => void;
    onplayhint: () => void;
    oncite: (id: string, label: string) => void;
    oninput: (active: boolean) => void;
    onclose: () => void;
    /** Desktop: the answer box takes exactly the intro's height so the field never moves. */
    slotHeight: number;
    /** The field exists only once the visitor asks to talk; "Ask about me" morphs into it. */
    open: boolean;
    /** Opened on purpose (the button), so it takes focus; not when a Section asked a question. */
    autofocus: boolean;
    /** Closes the field and any answer, morphing back into the button. */
    ondismiss: () => void;
  }
  let {
    messages,
    followups,
    hint,
    streaming,
    focused,
    onsend,
    onplayhint,
    oncite,
    oninput,
    onclose,
    slotHeight,
    open,
    autofocus,
    ondismiss,
  }: Props = $props();
  let draft = $state('');
  let input = $state<HTMLInputElement | undefined>();
  // The ghost hint fades only when it cycles, not when the field first appears: that entrance
  // belongs to the morph, and a second fade on top of it smears the text.
  const firstHint = untrack(() => hint);
  let cycled = $state(false);
  $effect(() => {
    if (hint !== firstHint) cycled = true;
  });
  // Focus only on an explicit open: a question asked from the Sections must not pop a phone keyboard.
  $effect(() => {
    if (input && autofocus) input.focus({ preventScroll: true });
  });
  const current = $derived(messages.filter((m) => m.role === 'answer').at(-1));
  const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
  const question = $derived(lastPrompt?.parts[0]?.kind === 'text' ? lastPrompt.parts[0].text : '');
  function submit(e: Event) {
    e.preventDefault();
    const text = draft.trim();
    if (text) {
      onsend(text);
      draft = '';
    } else onplayhint();
  }
  // Tab in the empty field completes the ghost hint so it can be edited or sent.
  const keydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      ondismiss();
    } else if (e.key === 'Tab' && !draft && hint) {
      e.preventDefault();
      draft = hint;
    }
  };
  const send = (p: string) => () => onsend(p);
  // Only text in the field pauses the hint rotation and the Scene's hint preview; focus alone
  // does not, or the hints would freeze whenever "Ask about me" leaves the cursor here.
  $effect(() => {
    oninput(draft.length > 0);
  });
</script>

<div class="col">
  {#if current}
    <section
      class="caption"
      class:suggested={lastPrompt?.suggested}
      style:--slot="{slotHeight}px"
      aria-live="polite"
    >
      <div class="q">
        <span>{lastPrompt?.suggested ? '✦ ' : ''}{question}</span>
        <button class="close" onclick={onclose} aria-label="close the answer">×</button>
      </div>
      <div class="text">
        <Answer parts={current.parts} {oncite} {focused} />
        {#if current.streaming}<span class="caret"></span>{/if}
        {#if current.error}<p class="error">{current.error}</p>{/if}
      </div>
    </section>
  {/if}

  {#if open}
    <form class="field" onsubmit={submit} aria-busy={streaming}>
      <!-- Close on the left mirrors send on the right: the pill reads as close … ask … send. -->
      <button
        type="button"
        class="dismiss"
        aria-label="close the chat"
        title="Close (Esc)"
        onclick={ondismiss}>×</button
      >
      <div class="inputwrap">
        {#if !draft}
          <span class="ghost"
            >{#key hint}<span class="cycle" class:fade={cycled}>{hint}</span>{/key}</span
          >
        {/if}
        <input
          bind:this={input}
          bind:value={draft}
          aria-label="Ask about this resume"
          autocomplete="off"
          onkeydown={keydown}
        />
      </div>
      <button
        type="submit"
        class="send"
        class:live={streaming}
        aria-label={draft ? 'send' : 'ask the suggested question'}>{draft ? '↵' : '▶'}</button
      >
    </form>
  {/if}

  {#if followups.length && !streaming}
    <div class="follow">
      {#each followups as f, i (i)}<button onclick={send(f)}>{f}</button>{/each}
    </div>
  {/if}
</div>

<style>
  .col {
    display: grid;
    gap: 10px;
    z-index: 20;
    color: var(--fg);
    min-width: 0;
    pointer-events: none;
  }
  .caption,
  .field,
  .follow > * {
    pointer-events: auto;
  }
  /* Phones: a sheet pinned to the bottom of the Hero. */
  @media (max-width: 760px) {
    .col {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: max(24px, calc(env(safe-area-inset-bottom) + 24px));
    }
  }
  .field {
    /* Shares its name with the "Ask about me" button, so opening morphs one pill into the other. */
    view-transition-name: ask;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border-radius: 999px;
    background: rgba(15, 14, 13, 0.88);
    border: 1px solid rgba(241, 239, 233, 0.14);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .inputwrap {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 36px;
    display: flex;
    align-items: center;
  }
  input {
    position: relative;
    width: 100%;
    /* No browser padding or margin: the caret and typed text start exactly where the ghost hint
       does (Chromium's default 1px 2px put the caret 2px right of it). */
    padding: 0;
    margin: 0;
    line-height: normal;
    background: none;
    border: 0;
    color: var(--fg);
    font:
      15px 'DM Sans',
      sans-serif;
    outline: none;
    z-index: 1;
  }
  .ghost {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    color: var(--fg-muted);
    font:
      15px 'DM Sans',
      sans-serif;
    pointer-events: none;
    overflow: hidden;
    white-space: nowrap;
  }
  .cycle {
    display: inline-block;
  }
  .cycle.fade {
    animation: fadein 0.5s ease;
  }
  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .field .send {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    color: var(--bg);
    font-size: 13px;
    font-weight: 600;
    flex: none;
    cursor: pointer;
  }
  /* Close: quiet until pointed at, so it never competes with the send button. */
  .dismiss {
    flex: none;
    /* Same footprint as the send button, so the two ends of the pill balance. */
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--fg-muted);
    font-size: 17px;
    line-height: 1;
    opacity: 0.55;
    cursor: pointer;
    transition:
      opacity 0.15s ease,
      background 0.15s ease;
  }
  .dismiss:hover,
  .dismiss:focus-visible {
    opacity: 1;
    background: rgba(241, 239, 233, 0.08);
  }
  /* While an Answer streams, the send button breathes. */
  .send.live {
    animation: breathe 1.4s ease-in-out infinite;
  }
  @keyframes breathe {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 138, 114, 0.5);
    }
    70% {
      box-shadow: 0 0 0 7px rgba(255, 138, 114, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(255, 138, 114, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .send.live {
      animation: none;
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
  }
  .caption {
    min-width: 0;
    height: var(--slot);
    grid-template-rows: auto 1fr;
    background: rgba(15, 14, 13, 0.82);
    border: 1px solid rgba(241, 239, 233, 0.1);
    border-radius: 14px;
    padding: 12px 16px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    animation: rise 0.3s ease;
    display: grid;
    gap: 8px;
  }
  .caption.suggested {
    border-color: rgba(255, 138, 114, 0.22);
  }
  @keyframes rise {
    from {
      transform: translateY(6px);
      opacity: 0;
    }
  }
  .q {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font:
      10px/1.6 'Azeret Mono',
      monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .q {
    min-width: 0;
  }
  .close {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid rgba(241, 239, 233, 0.14);
    background: none;
    color: var(--fg-muted);
    font:
      14px/1 'DM Sans',
      sans-serif;
    cursor: pointer;
  }
  .close:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  /* The question wraps; a pasted job description is clamped to three lines. */
  .q span {
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    line-height: 1.5;
  }
  /* The whole Answer stays reachable: the text scrolls inside the caption, never behind the chips. */
  .text {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    /* Reserve the scrollbar's column from the start so text does not reflow when it appears. */
    scrollbar-gutter: stable;
    padding-right: 6px;
  }
  .caret {
    display: inline-block;
    width: 6px;
    height: 12px;
    background: var(--accent);
    margin-left: 3px;
    animation: blink 1s steps(2) infinite;
  }
  @keyframes blink {
    to {
      opacity: 0;
    }
  }
  .error {
    color: var(--accent);
    font:
      12px 'Azeret Mono',
      monospace;
    margin: 6px 0 0;
  }
  .follow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    animation: fadein 0.6s ease 0.2s both;
  }
  .follow button {
    flex: none;
    max-width: 100%;
    white-space: normal;
    text-align: left;
    background: none;
    border: 1px solid rgba(241, 239, 233, 0.14);
    color: var(--fg-muted);
    border-radius: 999px;
    padding: 5px 10px;
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
  }
  .follow button:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  /* Phones: a compact sheet. Shorter answer box, tighter type, follow-ups in one swipeable row. */
  @media (max-width: 700px) {
    .col {
      bottom: max(12px, calc(env(safe-area-inset-bottom) + 12px));
      gap: 8px;
    }
    .caption {
      padding: 10px 12px;
      gap: 6px;
    }
    .caption {
      height: auto;
    }
    .text {
      max-height: 18vh;
      font-size: 13.5px;
    }
    .follow {
      /* A scrolling row inside a grid must not size the column to its full content width. */
      min-width: 0;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -12px;
      padding: 0 12px;
    }
    .follow::-webkit-scrollbar {
      display: none;
    }
    .follow button {
      white-space: nowrap;
      max-width: 80vw;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>

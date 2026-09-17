<script lang="ts">
  // Centred chat: answer caption above a bottom pill field. Ghost hints cycle in the field; an empty
  // submit plays the hint shown. docs/spec/chat.md, winning variant B.
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
  }: Props = $props();
  let draft = $state('');
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
    if (e.key === 'Tab' && !draft && hint) {
      e.preventDefault();
      draft = hint;
    }
  };
  const focusIn = () => oninput(true);
  const focusOut = () => oninput(draft.length > 0);
  const send = (p: string) => () => onsend(p);
  const cite = (id: string) => () => oncite(id, '');
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

  <form class="field" onsubmit={submit}>
    <span class="mark" class:live={streaming}>›</span>
    <div class="inputwrap">
      {#if !draft}
        <span class="ghost"
          >{#key hint}<span class="cycle">{hint}</span>{/key}</span
        >
      {/if}
      <input
        bind:value={draft}
        aria-label="Ask about this resume"
        autocomplete="off"
        onfocus={focusIn}
        onblur={focusOut}
        onkeydown={keydown}
      />
    </div>
    <button type="submit" aria-label={draft ? 'send' : 'ask the suggested question'}
      >{draft ? '↵' : '▶'}</button
    >
  </form>

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
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 16px;
    border-radius: 999px;
    background: rgba(15, 14, 13, 0.88);
    border: 1px solid rgba(241, 239, 233, 0.14);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .mark {
    color: var(--fg-muted);
    font:
      16px 'Azeret Mono',
      monospace;
  }
  .mark.live {
    color: var(--accent);
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
    animation: fadein 0.5s ease;
  }
  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .field button {
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

<script lang="ts">
  // Centred chat: answer caption above a bottom pill field. Ghost hints cycle in the field; an empty
  // submit plays the hint shown. docs/spec/chat.md, winning variant B.
  import Answer from './Answer.svelte';
  import type { CitePart, Message } from './types.ts';

  interface Props {
    messages: Message[];
    followups: string[];
    hint: string;
    streaming: boolean;
    focused: string | null;
    onsend: (prompt: string) => void;
    onplayhint: () => void;
    oncite: (id: string) => void;
    oninput: (active: boolean) => void;
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
  }: Props = $props();
  let draft = $state('');
  let open = $state(false);
  const current = $derived(messages.filter((m) => m.role === 'answer').at(-1));
  const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
  const question = $derived(lastPrompt?.parts[0]?.kind === 'text' ? lastPrompt.parts[0].text : '');
  const cites = $derived(
    (current?.parts.filter((p) => p.kind === 'cite') ?? []).filter(
      (p, i, a) => a.findIndex((q) => (q as CitePart).id === (p as CitePart).id) === i,
    ) as CitePart[],
  );

  function submit(e: Event) {
    e.preventDefault();
    const text = draft.trim();
    if (text) {
      onsend(text);
      draft = '';
      open = false;
    } else onplayhint();
  }
  const toggle = () => {
    open = !open;
  };
  const focusIn = () => oninput(true);
  const focusOut = () => oninput(draft.length > 0);
  const send = (p: string) => () => onsend(p);
  const cite = (id: string) => () => oncite(id);
  $effect(() => {
    oninput(draft.length > 0);
  });
</script>

<div class="col">
  {#if current}
    <section class="caption" class:open class:suggested={lastPrompt?.suggested} aria-live="polite">
      <div class="q">
        <span>{lastPrompt?.suggested ? '✦ ' : ''}{question}</span>
        <button
          class="toggle"
          onclick={toggle}
          aria-label={open ? 'collapse answer' : 'expand answer'}
        >
          {open ? '−' : '+'}
        </button>
      </div>
      <div class="text">
        <Answer parts={current.parts} {oncite} {focused} />
        {#if current.streaming}<span class="caret"></span>{/if}
        {#if current.error}<p class="error">{current.error}</p>{/if}
      </div>
      {#if cites.length}
        <div class="cites">
          {#each cites as c (c.ordinal)}
            <button class:focused={focused === c.id} onclick={cite(c.id)}
              ><i>{c.ordinal + 1}</i>{c.title}</button
            >
          {/each}
        </div>
      {/if}
      {#if followups.length && !streaming}
        <div class="follow">
          {#each followups as f (f)}<button onclick={send(f)}>{f}</button>{/each}
        </div>
      {/if}
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
      />
    </div>
    <button type="submit" aria-label={draft ? 'send' : 'ask the suggested question'}
      >{draft ? '↵' : '▶'}</button
    >
  </form>
</div>

<style>
  .col {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: max(24px, calc(env(safe-area-inset-bottom) + 24px));
    margin: 0 auto;
    max-width: 680px;
    display: grid;
    gap: 10px;
    z-index: 20;
    color: var(--fg);
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
  .q span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toggle {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid rgba(241, 239, 233, 0.14);
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }
  .text {
    max-height: 9em;
    overflow: hidden;
    mask-image: linear-gradient(#000 75%, transparent);
  }
  .caption.open .text {
    max-height: 50vh;
    overflow: auto;
    mask-image: none;
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
  .cites,
  .follow {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }
  .cites button {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg);
    border: 1px solid rgba(241, 239, 233, 0.12);
    color: var(--fg);
    border-radius: 999px;
    padding: 5px 10px 5px 6px;
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
  }
  .cites button i {
    font:
      9px/1 'Azeret Mono',
      monospace;
    font-style: normal;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 138, 114, 0.18);
    color: var(--accent);
  }
  .cites button.focused,
  .cites button:hover {
    border-color: var(--accent);
  }
  .follow button {
    flex: none;
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
</style>

<script lang="ts">
  import { store } from './lib/store.svelte';
  import { nav, type View } from './lib/nav.svelte';
  import Intro from './lib/ui/Intro.svelte';

  // Screens load on demand, so the first paint only carries the one you are looking at.
  const VIEWS: Record<View, () => Promise<{ default: any }>> = {
    solve: () => import('./views/Solve.svelte'),
    train: () => import('./views/Train.svelte'),
    lib: () => import('./views/Library.svelte'),
    drills: () => import('./views/Drills.svelte'),
    set: () => import('./views/Settings.svelte'),
  };
  let Screen = $state<any>(null);
  let loaded: View | null = null;
  let loadError = $state<string | null>(null);
  const Current = $derived<any>(Screen);
  $effect(() => {
    const v = nav.view;
    if (loaded === v) return;
    VIEWS[v]().then(m => { if (nav.view !== v) return; Screen = m.default; loaded = v; })
      .catch((err) => { loadError = String(err); });
  });
  // once the first screen is up, quietly fetch the others (the browser caches the chunks)
  $effect(() => {
    if (!Screen) return;
    const idle = (window as any).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1200));
    idle(() => { for (const [v, load] of Object.entries(VIEWS)) if (v !== loaded) load(); });
  });

  store.init();
  // the HTML splash (index.html) stays up until the saved data has loaded
  $effect(() => {
    if (!store.ready) return;
    const el = document.getElementById('splash');
    if (el) { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }
  });
  const typing = (e: Event) => /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
  const GO: Record<string, View> = { goSolve: 'solve', goTrain: 'train', goLibrary: 'lib', goDrills: 'drills', goSettings: 'set' };
  const ORDER: View[] = ['train', 'lib', 'solve', 'drills', 'set']; // the order the tabs sit in
  const cycle = (step: number) => nav.go(ORDER[(ORDER.indexOf(nav.view) + step + ORDER.length) % ORDER.length]);

  type Dir = 'up' | 'down' | 'left' | 'right';
  const ARROWS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  /** Arrow keys walk the buttons of the screen by position, so a keyboard alone can do everything. */
  function moveFocus(e: KeyboardEvent): boolean {
    const dir = ARROWS[e.code];
    if (!dir) return false;
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return false; // let the caret move
    const scope = document.querySelector('[role=dialog]') ?? document.querySelector('main');
    if (!scope) return false;
    const els = [...scope.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && !el.closest('[hidden]'));
    if (!els.length) return false;
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && active !== document.body && scope.contains(active);
    // nothing focused yet: the first press enters the page at the near edge
    if (!inside) {
      (dir === 'down' || dir === 'right' ? els[0] : els[els.length - 1]).focus();
      return true;
    }
    const r = active!.getBoundingClientRect();
    const boxes = els.map(el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    let best = -1, bestScore = Infinity;
    boxes.forEach((b, i) => {
      const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy;
      const primary = dir === 'down' ? dy : dir === 'up' ? -dy : dir === 'right' ? dx : -dx;
      if (primary <= 1) return; // only look in that direction
      const perp = dir === 'down' || dir === 'up' ? Math.abs(dx) : Math.abs(dy);
      const score = primary + perp * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) return false;
    els[best].focus();
    return true;
  }

  function onKey(e: KeyboardEvent) {
    if (typing(e) || !store.ready || nav.hintActive) return;
    if (store.is(e, 'back')) { if (nav.back()) e.preventDefault(); return; }
    if (!store.data.settings.introSeen) return;
    // a tab shortcut in the middle of a solve would throw the solve away: Esc stops the clock first
    if (store.timerRunning) return;
    for (const [cmd, v] of Object.entries(GO)) if (store.is(e, cmd)) { nav.go(v); e.preventDefault(); return; }
    if (store.is(e, 'cube')) { store.cubeHidden = !store.cubeHidden; e.preventDefault(); return; }
    if (store.is(e, 'tabPrev')) { cycle(-1); e.preventDefault(); return; }
    if (store.is(e, 'tabNext')) { cycle(1); e.preventDefault(); return; }
    if (moveFocus(e)) e.preventDefault();
  }
  const tab = (v: View) => ({ 'aria-current': nav.view === v ? ('page' as const) : undefined });
  // how many cases are actually due right now, shown on the Train tab
  const dueCount = $derived.by(() => {
    if (!store.ready) return 0;
    const now = Date.now();
    return Object.values(store.data.cards).filter(c => c.seen && c.due <= now).length;
  });
</script>

<svelte:window onkeydown={onKey} />

{#if store.ready}
  {#if store.loadError}
    <div class="banner" role="alert">
      <span style="flex:1;min-width:0"><b>Your saved data could not be read.</b> {store.loadError}. Anything you add now is saved normally.</span>
      <button class="btn" style="flex:none;min-height:36px" onclick={() => store.init()}>Try again</button>
    </div>
  {/if}
  {#if store.saveError}
    <div class="banner" role="alert">
      <span style="flex:1;min-width:0"><b>Changes are not being saved.</b> {store.saveError}. Your solves stay here while the app is open.</span>
      <button class="btn" style="flex:none;min-height:36px" onclick={() => store.flush()}>Try again</button>
    </div>
  {/if}
  <div inert={!store.data.settings.introSeen}>
    {#if Current}
      <Current />
    {:else if loadError}
      <main class="page">
        <div class="card col" role="alert" style="border-color:#FF6B6B;gap:10px">
          <div style="font-weight:800;color:#FF8A80">That screen could not load</div>
          <div class="mu">Probably a dropped connection on the first visit. Your data is untouched.</div>
          <div class="row" style="gap:8px">
            <button class="btn p" style="flex:1" onclick={() => { loadError = null; loaded = null; nav.go('solve'); }}>Try again</button>
          </div>
        </div>
      </main>
    {:else}<main class="page"><div class="mu">Loading…</div></main>{/if}

    <nav aria-label="Main">
      <button class:on={nav.view === 'train'} {...tab('train')} onclick={() => nav.go('train')}>
        Train{#if dueCount}<span class="badge" aria-label="{dueCount} cases due">{dueCount}</span>{/if}
      </button>
      <button class:on={nav.view === 'lib'} {...tab('lib')} onclick={() => nav.go('lib')}>Library</button>
      <div class="mid"><button class:on={nav.view === 'solve'} {...tab('solve')} onclick={() => nav.go('solve')}>Solve</button></div>
      <button class:on={nav.view === 'drills'} {...tab('drills')} onclick={() => nav.go('drills')}>Drills</button>
      <button class:on={nav.view === 'set'} {...tab('set')} onclick={() => nav.go('set')}>Settings</button>
    </nav>
  </div>

  {#if !store.data.settings.introSeen}
    <Intro onDone={() => store.update({ introSeen: true })} />
  {/if}
{/if}

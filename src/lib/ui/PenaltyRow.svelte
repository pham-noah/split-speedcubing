<script lang="ts">
  import { store } from '../store.svelte';
  import { codeLabel } from '../core/shortcuts';

  // The same +2 / DNF / Delete row as the timer screen, for whatever was recorded last.
  const { pen = '', onpen, ondelete }: {
    pen?: '+2' | 'DNF' | '';
    onpen: (p: '+2' | 'DNF' | '') => void;
    ondelete: () => void;
  } = $props();
</script>

<div class="row" role="group" aria-label="Penalty and delete" style="gap:8px">
  <button class="btn" class:on={pen === '+2'} aria-pressed={pen === '+2'} style="flex:1" onclick={() => onpen(pen === '+2' ? '' : '+2')}>
    +2<span class="pc-only"> ({codeLabel(store.key('plus2'))})</span>
  </button>
  <button class="btn" class:on={pen === 'DNF'} aria-pressed={pen === 'DNF'} style="flex:1" onclick={() => onpen(pen === 'DNF' ? '' : 'DNF')}>
    DNF<span class="pc-only"> ({codeLabel(store.key('dnf'))})</span>
  </button>
  <button class="btn" style="flex:1" onclick={ondelete}>
    Delete<span class="pc-only"> ({codeLabel(store.key('deleteLast'))})</span>
  </button>
</div>

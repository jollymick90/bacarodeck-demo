<script lang="ts">
  import { translate, type Entity } from '$lib/fields';
  let { plan }: { plan?: Entity } = $props();
  const preparation = $derived(String(plan?.status || 'not_started'));
  const interview = $derived(String(plan?.interviewStatus || 'unconfirmed'));
</script>

<span class="badges">
  <span class="badge" data-state={preparation}>Preparazione: {translate(preparation)}</span>
  <span class="badge" data-state={interview}>Intervista: {translate(interview)}</span>
</span>

<style>
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.4rem 0;
  }
  .badge {
    display: inline-block;
    border: 1px solid #c3cfdd;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.4;
    white-space: normal;
    color: #34465d;
    background: #edf1f6;
  }
  .badge[data-state='researching'],
  .badge[data-state='requested'] {
    color: #734900;
    background: #fff3d6;
    border-color: #e5c980;
  }
  .badge[data-state='ready'],
  .badge[data-state='confirmed'] {
    color: #174e83;
    background: #e6f1ff;
    border-color: #a8c8e8;
  }
  .badge[data-state='done'],
  .badge[data-state='completed'] {
    color: #235b38;
    background: #e6f4e9;
    border-color: #a8cdb2;
  }
  .badge[data-state='cancelled'] {
    color: #8a2933;
    background: #fdecef;
    border-color: #e7b5bc;
  }
</style>

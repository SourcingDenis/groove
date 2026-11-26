<script lang="ts">
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    format?: (v: number) => string;
    onChange: (v: number) => void;
  }
  let { label, value, min, max, step = 0.01, format = (v) => String(Math.round(v * 100) / 100), onChange }: Props = $props();
</script>

<label>
  <span class="name">{label}</span>
  <input type="range" {min} {max} {step} {value} oninput={(e) => onChange(+e.currentTarget.value)} />
  <output>{format(value)}</output>
</label>

<style>
  label { display: grid; grid-template-columns: 6.5em 1fr 3.6em; align-items: center; gap: 8px; min-height: 44px; }
  .name { font-size: 14px; color: var(--dim); }
  output { font-size: 14px; text-align: right; font-variant-numeric: tabular-nums; }
  input { width: 100%; height: 44px; margin: 0; accent-color: var(--accent); touch-action: pan-y; }
</style>

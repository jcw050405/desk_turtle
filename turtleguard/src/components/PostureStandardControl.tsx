import {
  POSTURE_STANDARD_CONFIGS,
  POSTURE_STANDARD_ORDER,
  type PostureStandard,
} from '../services/postureStandard';

interface PostureStandardControlProps {
  value: PostureStandard;
  disabled?: boolean;
  note?: string;
  onChange(value: PostureStandard): void;
}

export default function PostureStandardControl({
  value,
  disabled = false,
  note,
  onChange,
}: PostureStandardControlProps) {
  const index = POSTURE_STANDARD_ORDER.indexOf(value);
  const safeIndex = index === -1 ? 2 : index;
  const selected = POSTURE_STANDARD_CONFIGS[POSTURE_STANDARD_ORDER[safeIndex]];

  return (
    <div className="rounded-lg border border-[#2C2C2A]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#2C2C2A]/50">Posture standard</p>
          <p className="font-semibold text-[#2C2C2A]">{selected.label}</p>
        </div>
        <span className="rounded-md bg-[#2E7D63]/10 px-2 py-1 text-xs text-[#2E7D63]">
          {safeIndex + 1}/5
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={safeIndex}
        disabled={disabled}
        aria-label="Posture standard"
        onChange={(event) => onChange(POSTURE_STANDARD_ORDER[Number(event.target.value)])}
        className="mt-3 w-full accent-[#2E7D63]"
      />

      <div className="mt-1 flex justify-between text-xs text-[#2C2C2A]/50">
        <span>Sensitive</span>
        <span>Relaxed</span>
      </div>

      {note && <p className="mt-3 text-xs text-[#2C2C2A]/60">{note}</p>}
    </div>
  );
}

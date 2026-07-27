import type { VehicleType } from "@ev-router/shared";

interface Props {
  value: VehicleType;
  onChange: (v: VehicleType) => void;
}

const OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "gasoline", label: "Gasoline" },
  { value: "diesel", label: "Diesel" },
  { value: "ev", label: "EV" },
];

export function VehicleToggle({ value, onChange }: Props) {
  return (
    <div className="vehicle-toggle">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? "active" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

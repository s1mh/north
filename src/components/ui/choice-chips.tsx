type Option = { value: string; label: string; color?: string };

/** Escolha única em botões: no lugar do dropdown do sistema. Usa rádios reais, então funciona com teclado e FormData. */
export function ChoiceChips({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly Option[];
  defaultValue: string;
}) {
  return <fieldset className="auth-field chip-field">
    <legend>{label}</legend>
    <div className="chips">
      {options.map((option) => <label className="chip" key={option.value}>
        <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} />
        <span>
          {option.color && <i aria-hidden="true" style={{ background: option.color }} />}
          {option.label}
        </span>
      </label>)}
    </div>
  </fieldset>;
}

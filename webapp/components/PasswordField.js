import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, scorePassword, validatePassword } from '../lib/auth/contracts.js';
import { authInputClass, authLabelClass } from './AuthShell';

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];

/**
 * Password input with a show/hide toggle and a strength meter.
 *
 * The meter and the inline problem message come from lib/auth/contracts.js —
 * the same module the API routes validate with — so the client can never tell
 * someone a password is fine that the server will then reject.
 */
export default function PasswordField({
  id = 'password',
  label = 'Password',
  value,
  onChange,
  email = '',
  autoComplete = 'new-password',
  showMeter = true,
  required = true,
  placeholder = '••••••••',
}) {
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);

  const score = scorePassword(value);
  const problem = value ? validatePassword(value, { email }) : null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className={`${authLabelClass} mb-0`}>{label}</label>
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="text-xs font-semibold text-ink/45 transition hover:text-ink"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className={authInputClass}
        aria-describedby={showMeter ? `${id}-hint` : undefined}
      />

      {showMeter ? (
        <div id={`${id}-hint`} className="mt-2">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition ${
                  value && index < score ? STRENGTH_COLORS[score] : 'bg-ink/10'
                }`}
              />
            ))}
          </div>
          <p className={`mt-1.5 text-xs ${touched && problem ? 'text-red-600' : 'text-ink/45'}`}>
            {touched && problem
              ? problem
              : value
                ? `${STRENGTH_LABELS[score]} — longer is stronger.`
                : `At least ${PASSWORD_MIN_LENGTH} characters. A short phrase beats a clever word.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}

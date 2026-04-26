import type { ApiError } from '@/types/api';
import { fieldLabelFor } from '@/lib/api-errors';

type Props = {
  error: ApiError | null | undefined;
  fallback: string;
};

/**
 * `VALIDATION_FAILED` 등에서 `error.message` + `error.fields` 를 함께 표시.
 */
export default function ApiErrorDisplay({ error, fallback }: Props) {
  if (!error) return null;
  const message = error.message?.trim() ? error.message : fallback;
  const fields = error.fields;

  return (
    <div className="rounded-md border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
      <p className="font-medium text-red-100">{message}</p>
      {fields && fields.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1 pl-0.5 text-red-200/90">
          {fields.map((f) => (
            <li key={`${f.field}-${f.message}`}>
              <span className="text-neutral-300">{fieldLabelFor(f.field)}: </span>
              {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

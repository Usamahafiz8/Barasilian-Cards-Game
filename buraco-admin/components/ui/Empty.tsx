import { SearchX } from 'lucide-react';

interface Props {
  message?: string;
}

export default function Empty({ message = 'No results found.' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
      <SearchX size={28} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

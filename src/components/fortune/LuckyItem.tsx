interface LuckyItemProps {
  item: string;
}

export default function LuckyItem({ item }: LuckyItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--surface-subtle)] rounded-[var(--radius-lg)] mt-6">
      <span className="text-xl" aria-hidden="true">✨</span>
      <div>
        <p className="text-caption text-[var(--text-tertiary)]">행운의 장소 · 아이템</p>
        <p className="text-b1-semibold text-[var(--text-primary)] mt-0.5" lang="ja">
          {item}
        </p>
      </div>
    </div>
  );
}

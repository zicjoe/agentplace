interface AgentPlaceMarkProps {
  className?: string;
  alt?: string;
}

export function AgentPlaceMark({ className = 'w-7 h-7', alt = 'AgentPlace' }: AgentPlaceMarkProps) {
  return (
    <img
      src="/brand/agentplace-icon-512.png"
      alt={alt}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
}

interface AgentPlaceBrandProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}

export function AgentPlaceBrand({
  className = '',
  markClassName = 'w-8 h-6',
  textClassName = 'text-text font-semibold text-[15px] tracking-tight',
}: AgentPlaceBrandProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AgentPlaceMark className={markClassName} alt="" />
      <span className={textClassName}>AgentPlace</span>
    </span>
  );
}

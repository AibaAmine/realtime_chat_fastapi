type PresenceStatus = "online" | "away" | "offline";
type AvatarSize = 24 | 32 | 40 | 48;

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  presence?: PresenceStatus;
  className?: string;
}

const presenceColor: Record<PresenceStatus, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-text-muted",
};

function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Avatar({ src, alt, size = 40, presence, className }: AvatarProps) {
  const dotSize = Math.round(size * 0.28);

  return (
    <div className={`relative inline-flex shrink-0 ${className ?? ""}`} style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-bg-raised text-text-secondary"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          {initialsOf(alt)}
        </div>
      )}
      {presence && (
        <span
          className={`absolute rounded-full ring-2 ring-bg-elevated ${presenceColor[presence]}`}
          style={{
            width: dotSize,
            height: dotSize,
            right: -1,
            bottom: -1,
          }}
        />
      )}
    </div>
  );
}

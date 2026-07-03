interface TypingIndicatorProps {
  users: { userId: string; username: string }[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0].username} is typing`
      : users.length === 2
        ? `${users[0].username} and ${users[1].username} are typing`
        : `${users[0].username} and ${users.length - 1} others are typing`;

  return (
    <div className="px-4 py-1 text-sm italic text-text-secondary">
      {label}
      <span className="inline-block w-4 animate-pulse">...</span>
    </div>
  );
}

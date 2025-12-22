type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({
  className = "text-4xl",
  label = "Loading",
}: SpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin ${className}`}
      role="status"
      aria-label={label}
    >
      方
    </span>
  );
}

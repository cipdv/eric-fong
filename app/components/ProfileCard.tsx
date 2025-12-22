type ProfileCardProps = {
  name: string;
  about?: string | null;
  photoUrl?: string | null;
  className?: string;
};

export function ProfileCard({
  name,
  about,
  photoUrl,
  className = "",
}: ProfileCardProps) {
  return (
    <div
      className={`grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-start ${className}`}
    >
      {photoUrl ? (
        <div className="w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={`${name} profile photo`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="space-y-4 mt-10">
        <h1 className="text-xl font-semibold text-neutral-900">{name}</h1>
        <div className="space-y-2 text-base leading-7 text-neutral-800 whitespace-pre-line">
          {about || "More about this artist coming soon."}
        </div>
      </div>
    </div>
  );
}

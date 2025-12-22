import { Spinner } from "@/app/components/Spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-base text-neutral-600">
      <Spinner label="Loading register" />
    </div>
  );
}

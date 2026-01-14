"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions/profile";

type Props = {
  initialAbout?: string;
  initialPhoto?: string;
};

export default function ProfileEditor({
  initialAbout = "",
  initialPhoto,
}: Props) {
  const [about, setAbout] = useState(() => initialAbout ?? "");
  const [photoPreview, setPhotoPreview] = useState(initialPhoto || "");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0];
    if (nextFile) {
      setFile(nextFile);
      setPhotoPreview(URL.createObjectURL(nextFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);

    const formData = new FormData();
    formData.append("about", about);
    if (file) {
      formData.append("profilePhoto", file);
    }

    try {
      await updateProfileAction(formData);
      setStatus("success");
      setMessage("Profile updated.");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    } finally {
      setStatus((prev) => (prev === "success" ? "success" : "idle"));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-start"
    >
      <div className="space-y-3">
        <div className="w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPreview || "/1_1748550734_99480.webp"}
            alt="Profile preview"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700"
          >
            Change photo
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">
            About
          </label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={12}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Tell visitors about yourself..."
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {status === "loading" ? "Saving..." : "Update profile"}
          </button>
          {status === "success" && message && (
            <span className="text-sm text-green-700">{message}</span>
          )}
          {status === "error" && message && (
            <span className="text-sm text-red-600">{message}</span>
          )}
        </div>
      </div>
    </form>
  );
}

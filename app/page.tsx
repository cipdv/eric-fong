import Image from "next/image";

export default function Home() {
  return (
    <div className="pb-12">
      <div className="w-full max-w-5xl overflow-hidden ml-0 mr-auto">
        <Image
          src="/1_1748550734_99480.webp"
          alt="Painting placeholder"
          width={1400}
          height={1400}
          className="h-full w-full max-h-[85vh] object-contain"
          priority
        />
      </div>
    </div>
  );
}

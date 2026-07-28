export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] animate-pulse px-5 py-8 md:px-8 lg:py-10">
      <div className="mb-8 h-8 w-48 rounded-xl bg-[#eeeeee]" />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-72 rounded-xl border-2 border-[#eeeeee] bg-white" />
        <div className="h-72 rounded-xl border-2 border-[#eeeeee] bg-white" />
      </div>
    </div>
  );
}

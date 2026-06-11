export default function DashboardLoading() {
  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-72 bg-gray-100 rounded mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3"
          >
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
            <div className="h-3 w-1/3 bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

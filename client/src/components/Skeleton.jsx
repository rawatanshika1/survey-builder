export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse space-y-3">
      <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded mt-2" />
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BlockSkeleton({ height = "h-40" }) {
  return (
    <div
      className={`w-full ${height} bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse`}
    />
  );
}

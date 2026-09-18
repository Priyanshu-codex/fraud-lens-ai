interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width, height = "1rem", style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: "4px", ...style }}
    />
  );
}

export function MetricSkeleton() {
  return (
    <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
      <Skeleton width="60%" height="0.75rem" />
      <div style={{ marginTop: "0.75rem" }}>
        <Skeleton width="40%" height="2rem" />
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        <Skeleton width="50%" height="0.75rem" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: "1rem",
            padding: "0.875rem 1rem",
            borderBottom: "1px solid var(--color-border)",
            alignItems: "center",
          }}
        >
          <Skeleton width="80px" height="0.875rem" />
          <Skeleton width="120px" height="0.875rem" />
          <Skeleton width="80px" height="0.875rem" />
          <Skeleton width="60px" height="1.25rem" />
          <Skeleton width="100px" height="0.875rem" />
        </div>
      ))}
    </div>
  );
}

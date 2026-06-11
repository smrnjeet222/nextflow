/**
 * Deterministic mini node-graph thumbnail. Seeded by the workflow id so
 * every card gets a stable, unique "canvas" preview without storing images.
 * Pure SVG — safe to render from server or client components.
 */

const NODE_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MiniNode {
  x: number;
  y: number;
  color: string;
}

export default function GraphPreview({ seed }: { seed: string }) {
  const rand = mulberry32(hashSeed(seed));

  // 3–4 columns flowing left → right, 1–2 nodes per column
  const colCount = 3 + Math.floor(rand() * 2);
  const columns: MiniNode[][] = [];
  for (let c = 0; c < colCount; c++) {
    const nodeCount = c === 0 || c === colCount - 1 ? 1 : 1 + Math.floor(rand() * 2);
    const x = 24 + (c * 152) / (colCount - 1);
    const col: MiniNode[] = [];
    for (let n = 0; n < nodeCount; n++) {
      col.push({
        x,
        y: nodeCount === 1 ? 38 + (rand() - 0.5) * 28 : 22 + n * 44 + (rand() - 0.5) * 10,
        color: NODE_COLORS[Math.floor(rand() * NODE_COLORS.length)],
      });
    }
    columns.push(col);
  }

  const edges: { from: MiniNode; to: MiniNode }[] = [];
  for (let c = 0; c < columns.length - 1; c++) {
    for (const to of columns[c + 1]) {
      const from = columns[c][Math.floor(rand() * columns[c].length)];
      edges.push({ from, to });
    }
  }

  const NODE_W = 30;
  const NODE_H = 16;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#f7f7f8]"
      style={{
        backgroundImage: "radial-gradient(circle, #d8d8de 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      {/* soft violet wash, top-left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, rgba(124,58,237,0.08), transparent 60%)",
        }}
      />
      <svg
        viewBox="0 0 200 96"
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {edges.map(({ from, to }, i) => {
          const x1 = from.x + NODE_W / 2;
          const y1 = from.y;
          const x2 = to.x - NODE_W / 2;
          const y2 = to.y;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#c4b5fd"
              strokeWidth="1.5"
            />
          );
        })}
        {columns.flat().map((node, i) => (
          <g key={i}>
            <rect
              x={node.x - NODE_W / 2}
              y={node.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx="4"
              fill="white"
              stroke={node.color}
              strokeWidth="1.5"
            />
            <circle cx={node.x - NODE_W / 2 + 6} cy={node.y} r="2.2" fill={node.color} />
            <rect
              x={node.x - NODE_W / 2 + 11}
              y={node.y - 1.5}
              width={NODE_W - 16}
              height="3"
              rx="1.5"
              fill="#e5e7eb"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

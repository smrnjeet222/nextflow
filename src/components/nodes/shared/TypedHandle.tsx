import { Handle, HandleProps } from "@xyflow/react";
import { HandleDataType, DATA_TYPE_COLORS } from "@/lib/constants";

interface TypedHandleProps extends Omit<HandleProps, "id"> {
  id: string; // Enforce id as required
  dataType: HandleDataType;
  label?: string;
}

export default function TypedHandle({
  type,
  position,
  id,
  dataType,
  label,
  isConnectable = true,
  ...props
}: TypedHandleProps) {
  const colorConfig = DATA_TYPE_COLORS[dataType];
  const isTarget = type === "target";

  return (
    <div className={`relative flex items-center ${isTarget ? "flex-row" : "flex-row-reverse"} gap-1.5 group`}>
      <Handle
        type={type}
        position={position}
        id={id}
        isConnectable={isConnectable}
        style={{
          borderColor: colorConfig.hex,
          backgroundColor: "#ffffff",
          width: "9px",
          height: "9px",
          borderWidth: "2px",
          boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.8)`,
        }}
        {...props}
      />
      
      {/* Label displaying near the handle */}
      {label && (
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider select-none px-1">
          {label}
        </span>
      )}

      {/* Hover tooltip showing data type */}
      <div className={`absolute bottom-full ${isTarget ? "left-0" : "right-0"} mb-1 hidden group-hover:flex bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none z-50 whitespace-nowrap capitalize`}>
        {dataType} Input
      </div>
    </div>
  );
}

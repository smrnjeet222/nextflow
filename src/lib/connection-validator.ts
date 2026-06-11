import { Connection } from "@xyflow/react";
import { HandleDataType } from "./constants";

/**
 * Parses a handle ID and returns the data type.
 * Handle IDs are formatted as "fieldName:dataType" (e.g. "prompt:text" or "image_field:image")
 */
export function getDataTypeFromHandleId(handleId: string | null | undefined): HandleDataType {
  if (!handleId) return HandleDataType.ANY;
  const parts = handleId.split(":");
  if (parts.length >= 2) {
    const typeStr = parts[parts.length - 1];
    if (Object.values(HandleDataType).includes(typeStr as HandleDataType)) {
      return typeStr as HandleDataType;
    }
  }
  return HandleDataType.ANY;
}

/**
 * Validates a connection between two handles.
 * Rules:
 * 1. Target handle of type ANY accepts any source type.
 * 2. Otherwise, source data type must match target data type exactly.
 */
export function isValidConnection(connection: Connection): boolean {
  if (!connection.sourceHandle || !connection.targetHandle) return false;
  if (connection.source === connection.target) return false; // Prevent self-connections

  const sourceType = getDataTypeFromHandleId(connection.sourceHandle);
  const targetType = getDataTypeFromHandleId(connection.targetHandle);

  if (targetType === HandleDataType.ANY) return true;
  return sourceType === targetType;
}

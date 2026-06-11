import { Node, Edge } from "@xyflow/react";

/**
 * Checks if adding an edge between source and target would create a cycle.
 */
export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Edge[]
): boolean {
  if (sourceId === targetId) return true;

  // Build adjacency list of existing graph
  const adj: Record<string, string[]> = {};
  edges.forEach((edge) => {
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge.target);
  });

  // Add the proposed edge
  if (!adj[sourceId]) adj[sourceId] = [];
  adj[sourceId].push(targetId);

  // DFS cycle detection
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};

  function dfs(node: string): boolean {
    if (recStack[node]) return true; // Found a cycle
    if (visited[node]) return false;

    visited[node] = true;
    recStack[node] = true;

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    recStack[node] = false;
    return false;
  }

  // Check from all nodes
  const allNodes = new Set([...edges.map(e => e.source), ...edges.map(e => e.target), sourceId, targetId]);
  for (const node of allNodes) {
    if (dfs(node)) return true;
  }

  return false;
}

/**
 * Topologically sorts nodes in the workflow.
 * Returns an array of node IDs in execution order.
 * Throws an error if the graph has a cycle.
 */
export function topologicalSort<T extends Node>(nodes: T[], edges: Edge[]): T[] {
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  const nodeMap: Record<string, T> = {};

  // Initialize
  nodes.forEach((node) => {
    adj[node.id] = [];
    inDegree[node.id] = 0;
    nodeMap[node.id] = node;
  });

  // Build graph
  edges.forEach((edge) => {
    // Only count active nodes
    if (adj[edge.source] && adj[edge.target]) {
      adj[edge.source].push(edge.target);
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
    }
  });

  // Find all nodes with 0 in-degree
  const queue: string[] = [];
  nodes.forEach((node) => {
    if (inDegree[node.id] === 0) {
      queue.push(node.id);
    }
  });

  const sortedNodes: T[] = [];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (nodeMap[currId]) {
      sortedNodes.push(nodeMap[currId]);
    }

    const neighbors = adj[currId] || [];
    neighbors.forEach((neighbor) => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (sortedNodes.length !== nodes.length) {
    throw new Error("Cycle detected in graph! Workflow cannot be executed.");
  }

  return sortedNodes;
}

/**
 * Gets the direct dependencies of a given node.
 */
export function getNodeDependencies(nodeId: string, edges: Edge[]): string[] {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
}

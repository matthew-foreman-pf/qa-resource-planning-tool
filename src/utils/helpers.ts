import type { Pod, WorkItem } from '../types';

const podPrefixMap: Record<string, string> = {
  'pod-ww': 'WW',
  'pod-ps': 'PS',
  'pod-tp': 'TP',
  'pod-ss': 'SS',
  'pod-la': 'LA',
};

export function getPodPrefix(podId: string): string {
  return podPrefixMap[podId] || podId.slice(0, 2).toUpperCase();
}

export function getWorkItemLabel(wi: WorkItem): string {
  return `${getPodPrefix(wi.podId)}: ${wi.name}`;
}

export function getPodName(pods: Pod[], podId: string): string {
  return pods.find((p) => p.id === podId)?.name || podId;
}
